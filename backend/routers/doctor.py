from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
import uuid

from core.db import get_db
from models.doctor import Doctor
from models.unavailable_day import UnavailableDay
from schemas.doctor import DoctorCreate, DoctorUpdate

router = APIRouter(prefix="/api/doctors", tags=["Doctors"])


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
            "id": str(d.id),
            "name": d.name,
            "experience_years": d.experience_years,
            "is_active": d.is_active,
            "min_score": d.min_score,
            "max_score": d.max_score,
            "target_score": d.target_score,
            "access_token": d.access_token,
            "is_locked": d.is_locked,  # ★追加
            "unavailable_days": [
                {
                    "id": str(u.id),
                    "doctor_id": str(u.doctor_id),
                    "date": u.date,
                    "day_of_week": u.day_of_week,
                    "is_fixed": u.is_fixed,
                }
                for u in (d.unavailable_days or [])
            ],
        }
        for d in doctors
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
        "is_locked": doctor.is_locked,  # ★追加
        "unavailable_days": [
            {
                "id": str(u.id),
                "doctor_id": str(u.doctor_id),
                "date": u.date,
                "day_of_week": u.day_of_week,
                "is_fixed": u.is_fixed,
            }
            for u in (doctor.unavailable_days or [])
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
            # access_token / is_locked は default
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

        payload = doc.model_dump(exclude_unset=True)

        has_unavailable_dates = "unavailable_dates" in payload
        has_fixed_weekdays = "fixed_weekdays" in payload

        unavailable_dates = payload.pop("unavailable_dates", None)
        fixed_weekdays = payload.pop("fixed_weekdays", None)

        # ★管理者は is_locked に関係なく更新可能（現状ロジック維持）
        # Doctor本体の更新：Noneは無視（False/0は更新OK）
        for k, v in payload.items():
            if v is not None:
                setattr(doctor, k, v)

        if has_unavailable_dates or has_fixed_weekdays:
            await db.execute(
                delete(UnavailableDay).where(UnavailableDay.doctor_id == doctor_uuid)
            )

            new_rows: list[UnavailableDay] = []

            for d in (unavailable_dates or []):
                new_rows.append(
                    UnavailableDay(
                        doctor_id=doctor_uuid,
                        date=d,
                        day_of_week=None,
                        is_fixed=False,
                    )
                )

            for w in (fixed_weekdays or []):
                new_rows.append(
                    UnavailableDay(
                        doctor_id=doctor_uuid,
                        date=None,
                        day_of_week=int(w),
                        is_fixed=True,
                    )
                )

            if new_rows:
                db.add_all(new_rows)

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
                "is_locked": doctor.is_locked,  # ★追加
                "unavailable_days": [
                    {
                        "id": str(u.id),
                        "doctor_id": str(u.doctor_id),
                        "date": u.date,
                        "day_of_week": u.day_of_week,
                        "is_fixed": u.is_fixed,
                    }
                    for u in (doctor.unavailable_days or [])
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
