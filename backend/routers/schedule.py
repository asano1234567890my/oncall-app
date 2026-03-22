from __future__ import annotations

import datetime
from typing import List, Optional
from uuid import UUID

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import get_current_hospital
from core.db import get_db
from models.doctor import Doctor
from models.shift import ShiftAssignment
from services.settings_service import (
    get_draft_schedule,
    upsert_draft_schedule,
    delete_draft_schedule,
)

from fastapi.responses import Response
from sqlalchemy.orm import selectinload

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


class SaveDraftRequest(BaseModel):
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


## ── ICS Feed (Google Calendar sync) ──


def _build_ics(doctor_name: str, hospital_name: str, assignments: list) -> str:
    """Build an iCalendar (.ics) string from shift assignments."""
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//ShifRaku//oncall-app//JP",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{doctor_name} 当直表",
    ]

    for a in assignments:
        shift_label = "日直" if _normalize_shift_type(a.shift_type) == "day" else "当直"
        d = a.date
        # Day shift: 8:30-17:00, Night shift: 17:00-next 8:30
        if _normalize_shift_type(a.shift_type) == "day":
            dtstart = f"{d.year:04d}{d.month:02d}{d.day:02d}T083000"
            dtend = f"{d.year:04d}{d.month:02d}{d.day:02d}T170000"
        else:
            next_day = d + datetime.timedelta(days=1)
            dtstart = f"{d.year:04d}{d.month:02d}{d.day:02d}T170000"
            dtend = f"{next_day.year:04d}{next_day.month:02d}{next_day.day:02d}T083000"

        uid = f"{d.isoformat()}-{_normalize_shift_type(a.shift_type)}-{doctor_name}@shiftraku"
        lines.extend([
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTART;TZID=Asia/Tokyo:{dtstart}",
            f"DTEND;TZID=Asia/Tokyo:{dtend}",
            f"SUMMARY:{shift_label}（{hospital_name}）",
            f"DESCRIPTION:{doctor_name} {shift_label}",
            "STATUS:CONFIRMED",
            "END:VEVENT",
        ])

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines)


@router.get("/ical/{doctor_token}")
async def get_ical_feed(
    doctor_token: str,
    db: AsyncSession = Depends(get_db),
):
    """ICSフィード — 医師個人の確定済みシフトを .ics 形式で返す。認証不要（トークンがアクセス権）。"""
    result = await db.execute(
        select(Doctor)
        .options(selectinload(Doctor.hospital))
        .where(Doctor.access_token == doctor_token)
    )
    doctor = result.scalar_one_or_none()
    if doctor is None:
        raise HTTPException(status_code=404, detail="Invalid token")

    # 過去3ヶ月〜未来6ヶ月のシフトを返す
    today = datetime.date.today()
    start = today.replace(day=1) - datetime.timedelta(days=90)
    end = today + datetime.timedelta(days=180)

    shift_result = await db.execute(
        select(ShiftAssignment)
        .where(
            ShiftAssignment.doctor_id == doctor.id,
            ShiftAssignment.date >= start,
            ShiftAssignment.date <= end,
        )
        .order_by(ShiftAssignment.date)
    )
    assignments = shift_result.scalars().all()

    hospital_name = doctor.hospital.name if doctor.hospital else "病院"
    ics_content = _build_ics(doctor.name, hospital_name, assignments)

    return Response(
        content=ics_content,
        media_type="text/calendar; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{doctor.name}_shifts.ics"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
    )


@router.post("/save")
async def save_schedule(
    req: SaveScheduleRequest,
    hospital_id: uuid.UUID = Depends(get_current_hospital),
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
                select(Doctor.id).where(
                    Doctor.id.in_(assigned_doctor_ids),
                    Doctor.hospital_id == hospital_id,
                )
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

        # hospital_id経由でフィルタ（shift_assignmentsはdoctorに紐づく）
        hospital_doctor_ids = (
            await db.execute(
                select(Doctor.id).where(Doctor.hospital_id == hospital_id)
            )
        ).scalars().all()

        await db.execute(
            delete(ShiftAssignment).where(
                ShiftAssignment.date >= start_date,
                ShiftAssignment.date < end_date,
                ShiftAssignment.doctor_id.in_(hospital_doctor_ids),
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
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(get_db),
):
    if start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="start_date must be on or before end_date",
        )

    try:
        hospital_doctor_ids = (
            await db.execute(
                select(Doctor.id).where(Doctor.hospital_id == hospital_id)
            )
        ).scalars().all()

        result = await db.execute(
            select(ShiftAssignment)
            .where(
                ShiftAssignment.date >= start_date,
                ShiftAssignment.date <= end_date,
                ShiftAssignment.doctor_id.in_(hospital_doctor_ids),
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
async def delete_schedule(
    year: int,
    month: int,
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(get_db),
):
    """管理者用：指定月のシフトをDBから完全削除する。フロントエンドには非公開。"""
    try:
        start_date, end_date = _month_bounds(year, month)
        hospital_doctor_ids = (
            await db.execute(
                select(Doctor.id).where(Doctor.hospital_id == hospital_id)
            )
        ).scalars().all()
        await db.execute(
            delete(ShiftAssignment).where(
                ShiftAssignment.date >= start_date,
                ShiftAssignment.date < end_date,
                ShiftAssignment.doctor_id.in_(hospital_doctor_ids),
            )
        )
        await db.commit()
        return {"success": True, "message": f"{year}年{month}月のシフトを削除しました"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


## ── Draft Schedule ──


@router.get("/draft/{year}/{month}")
async def get_draft(
    year: int,
    month: int,
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(get_db),
):
    data = await get_draft_schedule(db, hospital_id, year, month)
    if data is None:
        return {"schedule": None, "saved_at": None}
    return {"schedule": data.get("schedule"), "saved_at": data.get("saved_at")}


@router.put("/draft/{year}/{month}")
async def save_draft(
    year: int,
    month: int,
    req: SaveDraftRequest,
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(get_db),
):
    schedule_data = [
        {"day": item.day, "day_shift": str(item.day_shift) if item.day_shift else None, "night_shift": str(item.night_shift) if item.night_shift else None}
        for item in req.schedule
    ]
    saved_at = await upsert_draft_schedule(db, hospital_id, year, month, schedule_data)
    return {"success": True, "saved_at": saved_at}


@router.delete("/draft/{year}/{month}")
async def remove_draft(
    year: int,
    month: int,
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(get_db),
):
    await delete_draft_schedule(db, hospital_id, year, month)
    return {"success": True}


@router.get("/{year}/{month}")
async def get_schedule(
    year: int,
    month: int,
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(get_db),
):
    try:
        import calendar as _calendar

        start_date, end_date = _month_bounds(year, month)
        hospital_doctor_ids = (
            await db.execute(
                select(Doctor.id).where(Doctor.hospital_id == hospital_id)
            )
        ).scalars().all()

        result = await db.execute(
            select(ShiftAssignment)
            .where(
                ShiftAssignment.date >= start_date,
                ShiftAssignment.date < end_date,
                ShiftAssignment.doctor_id.in_(hospital_doctor_ids),
            )
            .order_by(ShiftAssignment.date)
        )
        assignments = result.scalars().all()

        days_in_month = _calendar.monthrange(year, month)[1]
        formatted_data: dict = {
            day: {"day": day, "day_shift": None, "night_shift": None}
            for day in range(1, days_in_month + 1)
        }

        for assignment in assignments:
            day = assignment.date.day
            if _normalize_shift_type(assignment.shift_type) == "day":
                formatted_data[day]["day_shift"] = str(assignment.doctor_id)
            else:
                formatted_data[day]["night_shift"] = str(assignment.doctor_id)

        return sorted(formatted_data.values(), key=lambda item: item["day"])

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
