from __future__ import annotations

import re
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.auth import get_current_hospital
from core.db import get_db
from models.doctor import Doctor
from models.unavailable_day import UnavailableDay
from schemas.doctor import DoctorBulkLockUpdate, DoctorCreate, DoctorUpdate
from services.doctor_service import bulk_set_doctor_lock_state
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
async def get_doctors(
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Doctor)
        .options(selectinload(Doctor.unavailable_days))
        .where(Doctor.hospital_id == hospital_id)
    )
    doctors = sorted(
        result.scalars().all(),
        key=lambda d: [
            int(c) if c.isdigit() else c.lower()
            for c in re.split(r"(\d+)", d.name)
            if c
        ],
    )

    return [
        {
            "id": str(doctor.id),
            "name": doctor.name,
            "experience_years": doctor.experience_years,
            "is_active": doctor.is_active,
            "is_external": doctor.is_external,
            "min_score": doctor.min_score,
            "max_score": doctor.max_score,
            "target_score": doctor.target_score,
            "access_token": doctor.access_token,
            "is_locked": doctor.is_locked,
            "unavailable_days": [
                _serialize_unavailable_day(d) for d in (doctor.unavailable_days or [])
            ],
        }
        for doctor in doctors
    ]


@router.patch("/bulk-lock")
@router.post("/bulk-lock")
async def bulk_lock_doctors(
    payload: DoctorBulkLockUpdate,
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(get_db),
):
    try:
        updated_count = await bulk_set_doctor_lock_state(db, hospital_id=hospital_id, is_locked=payload.is_locked)
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update doctor lock state") from exc
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Unexpected error while updating doctor lock state") from exc

    return {
        "message": "医師の一括ロック状態を更新しました",
        "updated_count": updated_count,
        "is_locked": payload.is_locked,
    }


class BulkSoftenPayload(BaseModel):
    soften: bool = True


@router.patch("/bulk-soften")
async def bulk_soften_unavailable_days(
    payload: BulkSoftenPayload,
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(get_db),
):
    """個別不可日（is_fixed=False）の is_soft_penalty を一括変更。固定不可曜日は対象外。"""
    try:
        # Get all doctor IDs for this hospital
        doctor_result = await db.execute(
            select(Doctor.id).where(
                Doctor.hospital_id == hospital_id,
                Doctor.is_active != False,  # noqa: E712
            )
        )
        doctor_ids = [row[0] for row in doctor_result.all()]
        if not doctor_ids:
            return {"message": "対象の医師がいません", "updated_count": 0}

        # Update only date-based entries (is_fixed=False), skip fixed weekdays
        result = await db.execute(
            update(UnavailableDay)
            .where(
                UnavailableDay.doctor_id.in_(doctor_ids),
                UnavailableDay.is_fixed == False,  # noqa: E712
            )
            .values(is_soft_penalty=payload.soften)
        )
        await db.commit()

        action = "ソフト化" if payload.soften else "ハード化（復元）"
        return {
            "message": f"個別不可日を一括{action}しました（固定不可曜日は対象外）",
            "updated_count": result.rowcount,
            "soften": payload.soften,
        }
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail="一括更新に失敗しました") from exc


@router.get("/{doctor_id}")
async def get_doctor(
    doctor_id: str,
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(get_db),
):
    doctor_uuid = uuid.UUID(doctor_id)
    result = await db.execute(
        select(Doctor)
        .options(selectinload(Doctor.unavailable_days))
        .where(Doctor.id == doctor_uuid, Doctor.hospital_id == hospital_id)
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
            _serialize_unavailable_day(d) for d in (doctor.unavailable_days or [])
        ],
    }


@router.post("/")
async def create_doctor(
    doc: DoctorCreate,
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(get_db),
):
    try:
        new_doc = Doctor(
            hospital_id=hospital_id,
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


@router.post("/external")
async def create_external_doctor(
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(get_db),
):
    """外部医師（ダミー）を1人追加作成する"""
    try:
        result = await db.execute(
            select(func.count()).select_from(Doctor).where(
                Doctor.hospital_id == hospital_id,
                Doctor.is_external.is_(True),
            )
        )
        existing_count = result.scalar() or 0
        if existing_count >= 31:
            return {"message": "外部枠は既に上限（31人）です", "created": False}
        new_doc = Doctor(
            hospital_id=hospital_id,
            name=f"外部{existing_count + 1}",
            is_external=True,
            experience_years=0,
        )
        db.add(new_doc)
        await db.commit()
        await db.refresh(new_doc)
        return {
            "message": "外部枠を追加しました",
            "id": str(new_doc.id),
            "name": new_doc.name,
            "is_external": True,
        }
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{doctor_id}")
async def update_doctor(
    doctor_id: str,
    doc: DoctorUpdate,
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(get_db),
):
    doctor_uuid = uuid.UUID(doctor_id)

    try:
        result = await db.execute(
            select(Doctor).where(Doctor.id == doctor_uuid, Doctor.hospital_id == hospital_id)
        )
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
                FixedWeekdayEntry(weekday=item.weekday, target_shift=item.target_shift)
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
                    _serialize_unavailable_day(d) for d in (doctor.unavailable_days or [])
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
async def delete_doctor(
    doctor_id: str,
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(get_db),
):
    doctor_uuid = uuid.UUID(doctor_id)
    result = await db.execute(
        select(Doctor).where(Doctor.id == doctor_uuid, Doctor.hospital_id == hospital_id)
    )
    doctor = result.scalar_one_or_none()
    if doctor is not None:
        if doctor.is_external:
            raise HTTPException(status_code=400, detail="外部医師は削除できません")
        doctor.is_active = False
    await db.commit()
    return {"message": "削除しました"}


@router.delete("/{doctor_id}/hard")
async def hard_delete_doctor(
    doctor_id: str,
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(get_db),
):
    doctor_uuid = uuid.UUID(doctor_id)
    result = await db.execute(
        select(Doctor).where(Doctor.id == doctor_uuid, Doctor.hospital_id == hospital_id)
    )
    doctor = result.scalar_one_or_none()
    if doctor is None:
        raise HTTPException(status_code=404, detail="Doctor not found")
    if doctor.is_external:
        raise HTTPException(status_code=400, detail="外部医師は削除できません")
    await db.delete(doctor)
    await db.commit()
    return {"message": "物理削除しました"}
