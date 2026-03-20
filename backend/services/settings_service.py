from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Any, Dict, Iterable, List, Optional

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from models.system_setting import SystemSetting


def _key_for_year(year: int) -> str:
    return f"custom_holidays_{year}"


def _default_value() -> Dict[str, Any]:
    return {"manual_holidays": [], "ignored_holidays": []}


def _normalize_holiday_values(values: Iterable[Any]) -> list[str]:
    normalized: set[str] = set()
    for raw in values:
        try:
            parsed = date.fromisoformat(str(raw))
        except ValueError as exc:
            raise ValueError(f"Invalid holiday date: {raw}") from exc
        normalized.add(parsed.isoformat())
    return sorted(normalized)


async def get_custom_holidays(db: AsyncSession, hospital_id: uuid.UUID, year: int) -> Dict[str, Any]:
    key = _key_for_year(year)
    stmt = select(SystemSetting).where(
        SystemSetting.hospital_id == hospital_id,
        SystemSetting.key == key,
    )
    res = await db.execute(stmt)
    row: Optional[SystemSetting] = res.scalar_one_or_none()

    if row is None or row.value is None:
        return _default_value()

    value = dict(row.value)
    value.setdefault("manual_holidays", [])
    value.setdefault("ignored_holidays", [])
    return value


async def get_system_setting(db: AsyncSession, hospital_id: uuid.UUID, key: str) -> Any:
    stmt = select(SystemSetting).where(
        SystemSetting.hospital_id == hospital_id,
        SystemSetting.key == key,
    )
    res = await db.execute(stmt)
    row: Optional[SystemSetting] = res.scalar_one_or_none()
    if row is None or row.value is None:
        return None
    return row.value


async def upsert_system_setting(
    db: AsyncSession, hospital_id: uuid.UUID, key: str, value: Any, description: str = ""
) -> None:
    stmt = insert(SystemSetting).values(
        hospital_id=hospital_id,
        key=key,
        value=value,
        description=description or f"System setting: {key}",
    ).on_conflict_do_update(
        constraint="uq_system_settings_hospital_key",
        set_={"value": value, "description": description or f"System setting: {key}"},
    )
    await db.execute(stmt)
    await db.commit()


OPTIMIZER_CONFIG_KEY = "optimizer_config"


def _default_optimizer_config() -> Dict[str, Any]:
    return {
        "score_min": 0.5,
        "score_max": 4.5,
        "objective_weights": {},
        "hard_constraints": {},
        "shift_scores": {
            "weekday_night": 1.0,
            "saturday_night": 1.5,
            "holiday_day": 0.5,
            "holiday_night": 1.0,
        },
    }


async def get_optimizer_config(db: AsyncSession, hospital_id: uuid.UUID) -> Dict[str, Any]:
    stmt = select(SystemSetting).where(
        SystemSetting.hospital_id == hospital_id,
        SystemSetting.key == OPTIMIZER_CONFIG_KEY,
    )
    res = await db.execute(stmt)
    row: Optional[SystemSetting] = res.scalar_one_or_none()
    if row is None or row.value is None:
        return _default_optimizer_config()
    result = _default_optimizer_config()
    result.update(dict(row.value))
    return result


async def upsert_optimizer_config(db: AsyncSession, hospital_id: uuid.UUID, value: Dict[str, Any]) -> None:
    stmt = insert(SystemSetting).values(
        hospital_id=hospital_id,
        key=OPTIMIZER_CONFIG_KEY,
        value=value,
        description="Optimizer configuration (score ranges, weights, hard constraints)",
    ).on_conflict_do_update(
        constraint="uq_system_settings_hospital_key",
        set_={"value": value, "description": "Optimizer configuration (score ranges, weights, hard constraints)"},
    )
    await db.execute(stmt)
    await db.commit()


async def upsert_custom_holidays(
    db: AsyncSession, hospital_id: uuid.UUID, year: int, value: Dict[str, Any]
) -> None:
    key = _key_for_year(year)

    payload = {
        "manual_holidays": _normalize_holiday_values(value.get("manual_holidays", [])),
        "ignored_holidays": _normalize_holiday_values(value.get("ignored_holidays", [])),
    }

    stmt = insert(SystemSetting).values(
        hospital_id=hospital_id,
        key=key,
        value=payload,
        description="Custom holidays settings (manual_holidays / ignored_holidays)",
    ).on_conflict_do_update(
        constraint="uq_system_settings_hospital_key",
        set_={
            "value": payload,
            "description": "Custom holidays settings (manual_holidays / ignored_holidays)",
        },
    )

    await db.execute(stmt)
    await db.commit()


# ── Draft Schedule ──

DRAFT_SCHEDULE_KEY_PREFIX = "draft_schedule"


def _draft_key(year: int, month: int) -> str:
    return f"{DRAFT_SCHEDULE_KEY_PREFIX}_{year}_{month:02d}"


async def get_draft_schedule(
    db: AsyncSession, hospital_id: uuid.UUID, year: int, month: int
) -> Optional[Dict[str, Any]]:
    value = await get_system_setting(db, hospital_id, _draft_key(year, month))
    if value is None:
        return None
    return dict(value)


async def upsert_draft_schedule(
    db: AsyncSession,
    hospital_id: uuid.UUID,
    year: int,
    month: int,
    schedule_data: List[Dict[str, Any]],
) -> str:
    saved_at = datetime.now(timezone.utc).isoformat()
    value = {"schedule": schedule_data, "saved_at": saved_at}
    await upsert_system_setting(
        db, hospital_id, _draft_key(year, month), value,
        description=f"Draft schedule for {year}-{month:02d}",
    )
    return saved_at


async def delete_draft_schedule(
    db: AsyncSession, hospital_id: uuid.UUID, year: int, month: int
) -> None:
    key = _draft_key(year, month)
    await db.execute(
        delete(SystemSetting).where(
            SystemSetting.hospital_id == hospital_id,
            SystemSetting.key == key,
        )
    )
    await db.commit()
