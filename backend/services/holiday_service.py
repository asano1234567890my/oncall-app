from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import List, Optional

import jpholiday
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.holiday import Holiday


@dataclass(frozen=True)
class HolidayItem:
    date: date
    name: str


def get_jp_holidays_for_year(year: int) -> List[HolidayItem]:
    """指定年の日本の祝日一覧を返す（date, name）。"""
    items: List[HolidayItem] = []
    for d, name in jpholiday.year_holidays(year):
        items.append(HolidayItem(date=d, name=name))
    items.sort(key=lambda x: x.date)
    return items


async def ensure_holidays_for_year(db: AsyncSession, year: int) -> int:
    """
    指定年のHolidayがDBに1件も無ければ、jpholidayから取得して一括INSERTする。
    戻り値: 追加した件数（既に存在した場合は0）
    """
    start = date(year, 1, 1)
    end = date(year + 1, 1, 1)

    exists_stmt = select(Holiday.id).where(Holiday.date >= start, Holiday.date < end).limit(1)
    exists_res = await db.execute(exists_stmt)
    if exists_res.scalar_one_or_none() is not None:
        return 0

    items = get_jp_holidays_for_year(year)
    if not items:
        return 0

    db.add_all([Holiday(date=i.date, name=i.name) for i in items])
    await db.commit()
    return len(items)


async def fetch_holidays(
    db: AsyncSession, *, year: Optional[int] = None, year_month: Optional[str] = None
) -> List[Holiday]:
    """year=2024 または year_month='2024-05' のどちらかで検索する。"""
    if year is None and year_month is None:
        raise ValueError("Either year or year_month is required")

    if year_month is not None:
        try:
            y_str, m_str = year_month.split("-")
            y = int(y_str)
            m = int(m_str)
            if not (1 <= m <= 12):
                raise ValueError
        except Exception:
            raise ValueError("year_month must be in 'YYYY-MM' format")

        start = date(y, m, 1)
        end = date(y + 1, 1, 1) if m == 12 else date(y, m + 1, 1)

        stmt = select(Holiday).where(Holiday.date >= start, Holiday.date < end).order_by(Holiday.date)
        res = await db.execute(stmt)
        return res.scalars().all()

    start = date(year, 1, 1)
    end = date(year + 1, 1, 1)
    stmt = select(Holiday).where(Holiday.date >= start, Holiday.date < end).order_by(Holiday.date)
    res = await db.execute(stmt)
    return res.scalars().all()