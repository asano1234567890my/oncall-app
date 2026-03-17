from __future__ import annotations

from datetime import date
from typing import Any, Dict, Iterable, Optional

from sqlalchemy import select
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


async def get_custom_holidays(db: AsyncSession, year: int) -> Dict[str, Any]:
    key = _key_for_year(year)
    stmt = select(SystemSetting).where(SystemSetting.key == key)
    res = await db.execute(stmt)
    row: Optional[SystemSetting] = res.scalar_one_or_none()

    if row is None or row.value is None:
        return _default_value()

    value = dict(row.value)
    value.setdefault("manual_holidays", [])
    value.setdefault("ignored_holidays", [])
    return value


OPTIMIZER_CONFIG_KEY = "optimizer_config"


def _default_optimizer_config() -> Dict[str, Any]:
    return {"score_min": 0.5, "score_max": 4.5, "objective_weights": {}, "hard_constraints": {}}


async def get_optimizer_config(db: AsyncSession) -> Dict[str, Any]:
    stmt = select(SystemSetting).where(SystemSetting.key == OPTIMIZER_CONFIG_KEY)
    res = await db.execute(stmt)
    row: Optional[SystemSetting] = res.scalar_one_or_none()
    if row is None or row.value is None:
        return _default_optimizer_config()
    result = _default_optimizer_config()
    result.update(dict(row.value))
    return result


async def upsert_optimizer_config(db: AsyncSession, value: Dict[str, Any]) -> None:
    stmt = insert(SystemSetting).values(
        key=OPTIMIZER_CONFIG_KEY,
        value=value,
        description="Optimizer configuration (score ranges, weights, hard constraints)",
    ).on_conflict_do_update(
        index_elements=[SystemSetting.key],
        set_={"value": value, "description": "Optimizer configuration (score ranges, weights, hard constraints)"},
    )
    await db.execute(stmt)
    await db.commit()


async def upsert_custom_holidays(db: AsyncSession, year: int, value: Dict[str, Any]) -> None:
    key = _key_for_year(year)

    payload = {
        "manual_holidays": _normalize_holiday_values(
            value.get("manual_holidays", [])
        ),
        "ignored_holidays": _normalize_holiday_values(
            value.get("ignored_holidays", [])
        ),
    }

    stmt = insert(SystemSetting).values(
        key=key,
        value=payload,
        description="Custom holidays settings (manual_holidays / ignored_holidays)",
    ).on_conflict_do_update(
        index_elements=[SystemSetting.key],
        set_={
            "value": payload,
            "description": "Custom holidays settings (manual_holidays / ignored_holidays)",
        },
    )

    await db.execute(stmt)
    await db.commit()