from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.db import get_db
from models.doctor import Doctor
from models.unavailable_day import UnavailableDay
from schemas.doctor import PublicDoctorUpdate
from services.unavailable_day_service import (
    UnavailableDateEntry,
    replace_doctor_unavailable_days,
)

router = APIRouter(prefix="/api/public/doctors", tags=["Public"])


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


@router.get("/{access_token}")
async def get_doctor_by_token(access_token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Doctor)
        .options(selectinload(Doctor.unavailable_days))
        .where(Doctor.access_token == access_token)
    )
    doctor = result.scalar_one_or_none()
    if doctor is None:
        raise HTTPException(status_code=404, detail="Doctor not found")

    return {
        "id": str(doctor.id),
        "name": doctor.name,
        "experience_years": doctor.experience_years,
        "is_active": doctor.is_active,
        "is_locked": doctor.is_locked,
        "unavailable_days": [
            _serialize_unavailable_day(unavailable_day)
            for unavailable_day in (doctor.unavailable_days or [])
        ],
    }


@router.put("/{access_token}")
async def update_doctor_by_token(
    access_token: str, payload: PublicDoctorUpdate, db: AsyncSession = Depends(get_db)
):
    print(
        f"DEBUG PUBLIC PUT: access_token={access_token}, "
        f"payload={payload.model_dump(exclude_unset=True)}"
    )

    try:
        result = await db.execute(
            select(Doctor).where(Doctor.access_token == access_token)
        )
        doctor = result.scalar_one_or_none()
        if doctor is None:
            raise HTTPException(status_code=404, detail="Doctor not found")

        if doctor.is_locked is True:
            raise HTTPException(status_code=403, detail="入力期間は終了しています（Locked）")

        fields_set = payload.model_fields_set
        has_unavailable_dates = "unavailable_dates" in fields_set
        has_unavailable_days = "unavailable_days" in fields_set
        has_fixed_weekdays = "fixed_weekdays" in fields_set

        if has_unavailable_dates and has_unavailable_days:
            raise HTTPException(
                status_code=400,
                detail="Specify only one of unavailable_dates or unavailable_days",
            )

        unavailable_entries: list[UnavailableDateEntry] | None = None
        if has_unavailable_dates:
            unavailable_entries = [
                UnavailableDateEntry(date=current_date)
                for current_date in (payload.unavailable_dates or [])
            ]
        elif has_unavailable_days:
            unavailable_entries = [
                UnavailableDateEntry(
                    date=item.date,
                    target_shift=item.target_shift,
                    is_soft_penalty=item.is_soft_penalty,
                )
                for item in (payload.unavailable_days or [])
            ]

        if has_unavailable_dates or has_unavailable_days or has_fixed_weekdays:
            try:
                await replace_doctor_unavailable_days(
                    db,
                    doctor_id=doctor.id,
                    unavailable_entries=unavailable_entries,
                    replace_date_entries=has_unavailable_dates or has_unavailable_days,
                    fixed_weekdays=payload.fixed_weekdays if has_fixed_weekdays else None,
                    replace_fixed_weekdays=has_fixed_weekdays,
                    unavailable_year=payload.unavailable_year,
                    unavailable_month=payload.unavailable_month,
                )
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc

        await db.commit()

        result = await db.execute(
            select(Doctor)
            .options(selectinload(Doctor.unavailable_days))
            .where(Doctor.id == doctor.id)
        )
        doctor = result.scalar_one_or_none()
        if doctor is None:
            raise HTTPException(status_code=404, detail="Doctor not found")

        return {
            "message": "公開URLから休み希望を更新しました",
            "doctor": {
                "id": str(doctor.id),
                "name": doctor.name,
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
        print(f"ERROR PUBLIC PUT access_token={access_token}: {repr(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))