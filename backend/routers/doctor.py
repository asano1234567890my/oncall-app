from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.db import get_db
from models.doctor import Doctor
from models.unavailable_day import UnavailableDay
from schemas.doctor import DoctorCreate, DoctorUpdate
from services.unavailable_day_service import (
    FixedWeekdayEntry,
    UnavailableDateEntry,
    replace_doctor_unavailable_days,
)

router = APIRouter(prefix="/api/doctors", tags=["Doctors"])


def _serialize_unavailable_day(unavailable_day: UnavailableDay) -> dict[str, object]:
    return {
        "id": str(unavailable_day.id),
        "doctor_id": str(unavailable_day.doctor_id),
        "date": unavailable_day.date,
        "day_of_week": unavailable_day.day_of_week,
        "is_fixed": unavailable_day.is_fixed,
        "target_shift": unavailable_day.target_shift,
        "is_soft_penalty": unavailable_day.is_soft_penalty,
    }


@router.get("/")
async def get_doctors(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Doctor)
        .options(selectinload(Doctor.unavailable_days))
        .order_by(Doctor.name)
    )
    doctors = result.scalars().all()

    return [
        {
            "id": str(doctor.id),
            "name": doctor.name,
            "experience_years": doctor.experience_years,
            "is_active": doctor.is_active,
            "min_score": doctor.min_score,
            "max_score": doctor.max_score,
            "target_score": doctor.target_score,
            "access_token": doctor.access_token,
            "is_locked": doctor.is_locked,
            "unavailable_days": [
                _serialize_unavailable_day(unavailable_day)
                for unavailable_day in (doctor.unavailable_days or [])
            ],
        }
        for doctor in doctors
    ]


@router.get("/{doctor_id}")
async def get_doctor(doctor_id: str, db: AsyncSession = Depends(get_db)):
    doctor_uuid = uuid.UUID(doctor_id)

    result = await db.execute(
        select(Doctor)
        .options(selectinload(Doctor.unavailable_days))
        .where(Doctor.id == doctor_uuid)
    )
    doctor = result.scalar_one_or_none()
    if doctor is None:
        raise HTTPException(status_code=404, detail="Doctor not found")

    return {
        "id": str(doctor.id),
        "name": doctor.name,
        "experience_years": doctor.experience_years,
        "is_active": doctor.is_active,
        "min_score": doctor.min_score,
        "max_score": doctor.max_score,
        "target_score": doctor.target_score,
        "access_token": doctor.access_token,
        "is_locked": doctor.is_locked,
        "unavailable_days": [
            _serialize_unavailable_day(unavailable_day)
            for unavailable_day in (doctor.unavailable_days or [])
        ],
    }


@router.post("/")
async def create_doctor(doc: DoctorCreate, db: AsyncSession = Depends(get_db)):
    try:
        new_doc = Doctor(
            name=doc.name,
            experience_years=doc.experience_years,
            is_active=doc.is_active,
            min_score=doc.min_score,
            max_score=doc.max_score,
            target_score=doc.target_score,
        )
        db.add(new_doc)

        await db.commit()
        await db.refresh(new_doc)

        return {
            "message": "医師を登録しました",
            "id": str(new_doc.id),
            "access_token": new_doc.access_token,
            "is_locked": new_doc.is_locked,
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{doctor_id}")
async def update_doctor(
    doctor_id: str, doc: DoctorUpdate, db: AsyncSession = Depends(get_db)
):
    doctor_uuid = uuid.UUID(doctor_id)

    print(
        f"DEBUG PUT: doctor_id={doctor_id}, "
        f"payload={doc.model_dump(exclude_unset=True)}"
    )

    try:
        result = await db.execute(select(Doctor).where(Doctor.id == doctor_uuid))
        doctor = result.scalar_one_or_none()
        if doctor is None:
            raise HTTPException(status_code=404, detail="Doctor not found")

        fields_set = doc.model_fields_set
        has_unavailable_dates = "unavailable_dates" in fields_set
        has_unavailable_days = "unavailable_days" in fields_set
        has_fixed_weekdays = "fixed_weekdays" in fields_set

        if has_unavailable_dates and has_unavailable_days:
            raise HTTPException(
                status_code=400,
                detail="Specify only one of unavailable_dates or unavailable_days",
            )

        payload = doc.model_dump(
            exclude_unset=True,
            exclude={
                "unavailable_dates",
                "unavailable_days",
                "fixed_weekdays",
                "unavailable_year",
                "unavailable_month",
            },
        )

        for key, value in payload.items():
            if value is not None:
                setattr(doctor, key, value)

        unavailable_entries: list[UnavailableDateEntry] | None = None
        if has_unavailable_dates:
            unavailable_entries = [
                UnavailableDateEntry(date=current_date)
                for current_date in (doc.unavailable_dates or [])
            ]
        elif has_unavailable_days:
            unavailable_entries = [
                UnavailableDateEntry(
                    date=item.date,
                    target_shift=item.target_shift,
                    is_soft_penalty=item.is_soft_penalty,
                )
                for item in (doc.unavailable_days or [])
            ]

        fixed_weekday_entries: list[FixedWeekdayEntry] | None = None
        if has_fixed_weekdays:
            fixed_weekday_entries = [
                FixedWeekdayEntry(
                    weekday=item.weekday,
                    target_shift=item.target_shift,
                )
                for item in (doc.fixed_weekdays or [])
            ]

        if has_unavailable_dates or has_unavailable_days or has_fixed_weekdays:
            try:
                await replace_doctor_unavailable_days(
                    db,
                    doctor_id=doctor_uuid,
                    unavailable_entries=unavailable_entries,
                    replace_date_entries=has_unavailable_dates or has_unavailable_days,
                    fixed_weekdays=fixed_weekday_entries,
                    replace_fixed_weekdays=has_fixed_weekdays,
                    unavailable_year=doc.unavailable_year,
                    unavailable_month=doc.unavailable_month,
                )
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc

        await db.commit()

        result = await db.execute(
            select(Doctor)
            .options(selectinload(Doctor.unavailable_days))
            .where(Doctor.id == doctor_uuid)
        )
        doctor = result.scalar_one_or_none()
        if doctor is None:
            raise HTTPException(status_code=404, detail="Doctor not found")

        return {
            "message": "医師情報を更新しました",
            "doctor": {
                "id": str(doctor.id),
                "name": doctor.name,
                "experience_years": doctor.experience_years,
                "is_active": doctor.is_active,
                "min_score": doctor.min_score,
                "max_score": doctor.max_score,
                "target_score": doctor.target_score,
                "access_token": doctor.access_token,
                "is_locked": doctor.is_locked,
                "unavailable_days": [
                    _serialize_unavailable_day(unavailable_day)
                    for unavailable_day in (doctor.unavailable_days or [])
                ],
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR PUT doctor_id={doctor_id}: {repr(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{doctor_id}")
async def delete_doctor(doctor_id: str, db: AsyncSession = Depends(get_db)):
    doctor_uuid = uuid.UUID(doctor_id)
    result = await db.execute(select(Doctor).where(Doctor.id == doctor_uuid))
    doctor = result.scalar_one_or_none()
    if doctor is not None:
        doctor.is_active = False
    await db.commit()
    return {"message": "削除しました"}