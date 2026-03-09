from __future__ import annotations

import datetime
import uuid
from dataclasses import dataclass
from typing import Sequence

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from models.unavailable_day import UnavailableDay


@dataclass(frozen=True)
class UnavailableDateEntry:
    date: datetime.date
    target_shift: str = "all"
    is_soft_penalty: bool = False


def _month_bounds(year: int, month: int) -> tuple[datetime.date, datetime.date]:
    if year < 1900 or year > 2200:
        raise ValueError("unavailable_year must be between 1900 and 2200")
    if month < 1 or month > 12:
        raise ValueError("unavailable_month must be between 1 and 12")

    start_date = datetime.date(year, month, 1)
    if month == 12:
        end_date = datetime.date(year + 1, 1, 1)
    else:
        end_date = datetime.date(year, month + 1, 1)
    return start_date, end_date


def _resolve_target_month(
    unavailable_entries: Sequence[UnavailableDateEntry],
    unavailable_year: int | None,
    unavailable_month: int | None,
) -> tuple[datetime.date, datetime.date]:
    if (unavailable_year is None) != (unavailable_month is None):
        raise ValueError(
            "unavailable_year and unavailable_month must be provided together"
        )

    if unavailable_year is not None and unavailable_month is not None:
        start_date, end_date = _month_bounds(unavailable_year, unavailable_month)
        for entry in unavailable_entries:
            if not (start_date <= entry.date < end_date):
                raise ValueError(
                    "All unavailable dates must belong to unavailable_year/unavailable_month"
                )
        return start_date, end_date

    if not unavailable_entries:
        raise ValueError(
            "unavailable_year and unavailable_month are required when unavailable_dates is empty"
        )

    months = {(entry.date.year, entry.date.month) for entry in unavailable_entries}
    if len(months) != 1:
        raise ValueError("unavailable_dates must belong to a single month")

    year, month = months.pop()
    return _month_bounds(year, month)


async def replace_doctor_unavailable_days(
    db: AsyncSession,
    *,
    doctor_id: uuid.UUID,
    unavailable_entries: Sequence[UnavailableDateEntry] | None,
    replace_date_entries: bool,
    fixed_weekdays: Sequence[int] | None,
    replace_fixed_weekdays: bool,
    unavailable_year: int | None = None,
    unavailable_month: int | None = None,
) -> None:
    normalized_entries = list(unavailable_entries or [])

    if replace_date_entries:
        start_date, end_date = _resolve_target_month(
            normalized_entries,
            unavailable_year,
            unavailable_month,
        )
        await db.execute(
            delete(UnavailableDay).where(
                UnavailableDay.doctor_id == doctor_id,
                UnavailableDay.is_fixed.is_(False),
                UnavailableDay.date >= start_date,
                UnavailableDay.date < end_date,
            )
        )

        if normalized_entries:
            db.add_all(
                [
                    UnavailableDay(
                        doctor_id=doctor_id,
                        date=entry.date,
                        day_of_week=None,
                        is_fixed=False,
                        target_shift=entry.target_shift,
                        is_soft_penalty=entry.is_soft_penalty,
                    )
                    for entry in normalized_entries
                ]
            )

    if replace_fixed_weekdays:
        await db.execute(
            delete(UnavailableDay).where(
                UnavailableDay.doctor_id == doctor_id,
                UnavailableDay.is_fixed.is_(True),
            )
        )

        normalized_weekdays = sorted({int(weekday) for weekday in (fixed_weekdays or [])})
        for weekday in normalized_weekdays:
            if weekday < 0 or weekday > 6:
                raise ValueError("fixed_weekdays must contain values between 0 and 6")

        if normalized_weekdays:
            db.add_all(
                [
                    UnavailableDay(
                        doctor_id=doctor_id,
                        date=None,
                        day_of_week=weekday,
                        is_fixed=True,
                        target_shift="all",
                        is_soft_penalty=False,
                    )
                    for weekday in normalized_weekdays
                ]
            )