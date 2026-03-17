from __future__ import annotations

import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.db import get_db
from models.doctor import Doctor
from models.shift import ShiftAssignment

router = APIRouter(prefix="/api/schedule", tags=["Schedule"])

DAY_SHIFT_LABEL = chr(0x65E5) + chr(0x76F4)
NIGHT_SHIFT_LABEL = chr(0x5F53) + chr(0x76F4)


class ShiftData(BaseModel):
    day: int
    day_shift: Optional[UUID] = None
    night_shift: Optional[UUID] = None


class SaveScheduleRequest(BaseModel):
    year: int
    month: int
    num_doctors: int
    schedule: List[ShiftData]


class RangeShiftItem(BaseModel):
    date: str
    shift_type: str
    doctor_id: str


def _month_bounds(year: int, month: int) -> tuple[datetime.date, datetime.date]:
    start_date = datetime.date(year, month, 1)
    if month == 12:
        end_date = datetime.date(year + 1, 1, 1)
    else:
        end_date = datetime.date(year, month + 1, 1)
    return start_date, end_date


def _normalize_shift_type(raw_shift_type: str) -> str:
    if raw_shift_type in {DAY_SHIFT_LABEL, "day", "day_shift"}:
        return "day"
    if raw_shift_type in {NIGHT_SHIFT_LABEL, "night", "night_shift"}:
        return "night"
    return str(raw_shift_type)


@router.post("/save")
async def save_schedule(
    req: SaveScheduleRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        assigned_doctor_ids = {
            doctor_id
            for item in req.schedule
            for doctor_id in (item.day_shift, item.night_shift)
            if doctor_id is not None
        }

        if assigned_doctor_ids:
            result = await db.execute(
                select(Doctor.id).where(Doctor.id.in_(assigned_doctor_ids))
            )
            existing_doctor_ids = set(result.scalars().all())
            missing_doctor_ids = assigned_doctor_ids - existing_doctor_ids
            if missing_doctor_ids:
                missing_values = ", ".join(
                    sorted(str(doctor_id) for doctor_id in missing_doctor_ids)
                )
                raise HTTPException(
                    status_code=400,
                    detail=f"Unknown doctor_id in schedule: {missing_values}",
                )

        start_date, end_date = _month_bounds(req.year, req.month)

        await db.execute(
            delete(ShiftAssignment).where(
                ShiftAssignment.date >= start_date,
                ShiftAssignment.date < end_date,
            )
        )

        new_assignments = []
        for item in req.schedule:
            current_date = datetime.date(req.year, req.month, item.day)

            if item.day_shift is not None:
                new_assignments.append(
                    ShiftAssignment(
                        date=current_date,
                        doctor_id=item.day_shift,
                        shift_type=DAY_SHIFT_LABEL,
                    )
                )

            if item.night_shift is not None:
                new_assignments.append(
                    ShiftAssignment(
                        date=current_date,
                        doctor_id=item.night_shift,
                        shift_type=NIGHT_SHIFT_LABEL,
                    )
                )

        db.add_all(new_assignments)
        await db.commit()

        return {
            "success": True,
            "message": "\u30b7\u30d5\u30c8\u3092\u30c7\u30fc\u30bf\u30d9\u30fc\u30b9\u306b\u4fdd\u5b58\u3057\u307e\u3057\u305f\uff01",
            "saved_count": len(new_assignments),
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"DEBUG Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/range", response_model=List[RangeShiftItem])
async def get_schedule_range(
    start_date: datetime.date,
    end_date: datetime.date,
    db: AsyncSession = Depends(get_db),
):
    if start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="start_date must be on or before end_date",
        )

    try:
        result = await db.execute(
            select(ShiftAssignment)
            .where(
                ShiftAssignment.date >= start_date,
                ShiftAssignment.date <= end_date,
            )
            .order_by(
                ShiftAssignment.date,
                ShiftAssignment.shift_type,
                ShiftAssignment.doctor_id,
            )
        )
        assignments = result.scalars().all()

        return [
            {
                "date": assignment.date.isoformat(),
                "shift_type": _normalize_shift_type(assignment.shift_type),
                "doctor_id": str(assignment.doctor_id),
            }
            for assignment in assignments
        ]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{year}/{month}")
async def delete_schedule(year: int, month: int, db: AsyncSession = Depends(get_db)):
    """管理者用：指定月のシフトをDBから完全削除する。フロントエンドには非公開。"""
    try:
        start_date, end_date = _month_bounds(year, month)
        await db.execute(
            delete(ShiftAssignment).where(
                ShiftAssignment.date >= start_date,
                ShiftAssignment.date < end_date,
            )
        )
        await db.commit()
        return {"success": True, "message": f"{year}年{month}月のシフトを削除しました"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{year}/{month}")
async def get_schedule(year: int, month: int, db: AsyncSession = Depends(get_db)):
    try:
        start_date, end_date = _month_bounds(year, month)

        result = await db.execute(
            select(ShiftAssignment)
            .where(
                ShiftAssignment.date >= start_date,
                ShiftAssignment.date < end_date,
            )
            .order_by(ShiftAssignment.date)
        )
        assignments = result.scalars().all()

        formatted_data = {}
        for assignment in assignments:
            day = assignment.date.day
            if day not in formatted_data:
                formatted_data[day] = {
                    "day": day,
                    "day_shift": None,
                    "night_shift": None,
                }

            if _normalize_shift_type(assignment.shift_type) == "day":
                formatted_data[day]["day_shift"] = str(assignment.doctor_id)
            else:
                formatted_data[day]["night_shift"] = str(assignment.doctor_id)

        return sorted(formatted_data.values(), key=lambda item: item["day"])

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
