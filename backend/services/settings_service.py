from __future__ import annotations

from typing import Any, Dict, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert

from models.system_setting import SystemSetting


def _key_for_year(year: int) -> str:
    return f"custom_holidays_{year}"


def _default_value() -> Dict[str, Any]:
    return {"manual_holidays": [], "ignored_holidays": []}


async def get_custom_holidays(db: AsyncSession, year: int) -> Dict[str, Any]:
    key = _key_for_year(year)
    stmt = select(SystemSetting).where(SystemSetting.key == key)
    res = await db.execute(stmt)
    row: Optional[SystemSetting] = res.scalar_one_or_none()

    if row is None or row.value is None:
        return _default_value()

    # JSONBなのでdict想定。欠けていても初期値で補完
    value = dict(row.value)
    value.setdefault("manual_holidays", [])
    value.setdefault("ignored_holidays", [])
    return value


async def upsert_custom_holidays(db: AsyncSession, year: int, value: Dict[str, Any]) -> None:
    key = _key_for_year(year)

    payload = {
        "manual_holidays": value.get("manual_holidays", []),
        "ignored_holidays": value.get("ignored_holidays", []),
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