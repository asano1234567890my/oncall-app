from __future__ import annotations

import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.db import get_db
from models.doctor import Doctor
from models.shift import ShiftAssignment

router = APIRouter(prefix="/api/schedule", tags=["Schedule"])


class ShiftData(BaseModel):
    day: int
    day_shift: Optional[UUID] = None
    night_shift: Optional[UUID] = None


class SaveScheduleRequest(BaseModel):
    year: int
    month: int
    num_doctors: int
    schedule: List[ShiftData]


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

        start_date = datetime.date(req.year, req.month, 1)
        if req.month == 12:
            end_date = datetime.date(req.year + 1, 1, 1)
        else:
            end_date = datetime.date(req.year, req.month + 1, 1)

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
                        shift_type="日直",
                    )
                )

            if item.night_shift is not None:
                new_assignments.append(
                    ShiftAssignment(
                        date=current_date,
                        doctor_id=item.night_shift,
                        shift_type="当直",
                    )
                )

        db.add_all(new_assignments)
        await db.commit()

        return {
            "success": True,
            "message": "シフトをデータベースに保存しました！",
            "saved_count": len(new_assignments),
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"DEBUG Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{year}/{month}")
async def get_schedule(year: int, month: int, db: AsyncSession = Depends(get_db)):
    try:
        start_date = datetime.date(year, month, 1)
        if month == 12:
            end_date = datetime.date(year + 1, 1, 1)
        else:
            end_date = datetime.date(year, month + 1, 1)

        result = await db.execute(
            select(ShiftAssignment)
            .options(selectinload(ShiftAssignment.doctor))
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

            if assignment.shift_type == "日直":
                formatted_data[day]["day_shift"] = assignment.doctor.name
            else:
                formatted_data[day]["night_shift"] = assignment.doctor.name

        return sorted(formatted_data.values(), key=lambda item: item["day"])

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))