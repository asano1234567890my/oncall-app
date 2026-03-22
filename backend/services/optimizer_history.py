from __future__ import annotations

from datetime import date
from typing import Dict, Iterable
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import uuid as _uuid

from models.shift import ShiftAssignment
from services.holiday_service import get_jp_holidays_for_year
from services.settings_service import get_custom_holidays


DAY_SHIFT_TYPES = {"day", "day_shift", "日直"}
NIGHT_SHIFT_TYPES = {"night", "night_shift", "当直"}


def _shift_month(year: int, month: int, delta_months: int) -> tuple[int, int]:
    absolute_month = (year * 12) + (month - 1) + delta_months
    return absolute_month // 12, (absolute_month % 12) + 1


def _parse_custom_dates(
    values: Iterable[str],
    *,
    start_date: date,
    end_date: date,
) -> set[date]:
    parsed: set[date] = set()
    for raw in values:
        try:
            parsed_date = date.fromisoformat(str(raw))
        except ValueError:
            continue
        if start_date <= parsed_date < end_date:
            parsed.add(parsed_date)
    return parsed


async def build_holiday_dates(
    db: AsyncSession,
    *,
    hospital_id: _uuid.UUID,
    start_date: date,
    end_date: date,
) -> set[date]:
    holiday_dates: set[date] = set()
    for year in range(start_date.year, end_date.year + 1):
        holiday_dates.update(
            item.date
            for item in get_jp_holidays_for_year(year)
            if start_date <= item.date < end_date
        )

        custom = await get_custom_holidays(db, hospital_id, year)
        manual = _parse_custom_dates(
            custom.get("manual_holidays", []),
            start_date=start_date,
            end_date=end_date,
        )
        ignored = _parse_custom_dates(
            custom.get("ignored_holidays", []),
            start_date=start_date,
            end_date=end_date,
        )
        holiday_dates.update(manual)
        holiday_dates.difference_update(ignored)

    return holiday_dates


DEFAULT_SHIFT_SCORES = {
    "weekday_night": 1.0,
    "saturday_night": 1.5,
    "holiday_day": 0.5,
    "holiday_night": 1.0,
}


def score_historical_shift(
    *,
    shift_date: date,
    shift_type: str,
    holiday_dates: set[date],
    shift_scores: dict[str, float] | None = None,
) -> float:
    ss = shift_scores or DEFAULT_SHIFT_SCORES
    normalized = str(shift_type).strip()
    normalized_lower = normalized.lower()
    is_sunday_or_holiday = shift_date.weekday() == 6 or shift_date in holiday_dates

    if normalized in DAY_SHIFT_TYPES or normalized_lower in DAY_SHIFT_TYPES:
        return ss.get("holiday_day", 0.5) if is_sunday_or_holiday else 0.0

    if normalized in NIGHT_SHIFT_TYPES or normalized_lower in NIGHT_SHIFT_TYPES:
        if is_sunday_or_holiday:
            return ss.get("holiday_night", 1.0)
        return ss.get("saturday_night", 1.5) if shift_date.weekday() == 5 else ss.get("weekday_night", 1.0)

    return 0.0


def apply_history_score_baseline(
    raw_scores: Dict[UUID, float],
    history_counts: Dict[UUID, int],
) -> Dict[UUID, float]:
    experienced_scores = [
        score
        for doctor_id, score in raw_scores.items()
        if history_counts.get(doctor_id, 0) > 0 and score > 0
    ]
    baseline = (
        sum(experienced_scores) / len(experienced_scores)
        if experienced_scores
        else 0.0
    )

    corrected: Dict[UUID, float] = {}
    for doctor_id, score in raw_scores.items():
        if history_counts.get(doctor_id, 0) == 0 or score <= 0:
            corrected[doctor_id] = baseline
        else:
            corrected[doctor_id] = score
    return corrected


async def build_past_total_scores(
    db: AsyncSession,
    *,
    hospital_id: _uuid.UUID,
    doctor_ids: Iterable[UUID],
    target_year: int,
    target_month: int,
    history_months: int = 2,
    shift_scores: dict[str, float] | None = None,
) -> Dict[UUID, float]:
    doctor_id_list = list(dict.fromkeys(doctor_ids))
    if not doctor_id_list:
        return {}

    start_year, start_month = _shift_month(target_year, target_month, -history_months)
    history_start = date(start_year, start_month, 1)
    target_month_start = date(target_year, target_month, 1)

    holiday_dates = await build_holiday_dates(
        db,
        hospital_id=hospital_id,
        start_date=history_start,
        end_date=target_month_start,
    )

    stmt = (
        select(
            ShiftAssignment.doctor_id,
            ShiftAssignment.date,
            ShiftAssignment.shift_type,
        )
        .where(
            ShiftAssignment.doctor_id.in_(doctor_id_list),
            ShiftAssignment.date >= history_start,
            ShiftAssignment.date < target_month_start,
        )
        .order_by(ShiftAssignment.date, ShiftAssignment.doctor_id)
    )
    result = await db.execute(stmt)

    raw_scores: Dict[UUID, float] = {doctor_id: 0.0 for doctor_id in doctor_id_list}
    history_counts: Dict[UUID, int] = {doctor_id: 0 for doctor_id in doctor_id_list}

    for doctor_id, shift_date, shift_type in result.all():
        history_counts[doctor_id] += 1
        raw_scores[doctor_id] += score_historical_shift(
            shift_date=shift_date,
            shift_type=shift_type,
            holiday_dates=holiday_dates,
            shift_scores=shift_scores,
        )

    return apply_history_score_baseline(raw_scores, history_counts)