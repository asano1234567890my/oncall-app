# backend/routers/doctor.py
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


# 1. 取得API（一覧）
@router.get("/")
async def get_doctors(db: AsyncSession = Depends(get_db)):
    # ★ Eager Load 徹底
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


# 2. 取得API（単一）
@router.get("/{doctor_id}")
async def get_doctor(doctor_id: str, db: AsyncSession = Depends(get_db)):
    doctor_uuid = uuid.UUID(doctor_id)

    # ★ Eager Load 徹底
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


# 3. 医師の追加API
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

        return {"message": "医師を登録しました", "id": str(new_doc.id)}

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# 4. 更新API（★改修）
@router.put("/{doctor_id}")
async def update_doctor(
    doctor_id: str, doc: DoctorUpdate, db: AsyncSession = Depends(get_db)
):
    """
    スコア等の更新に加えて、unavailable_dates / fixed_weekdays を受け取った場合は
    UnavailableDay を全削除→再作成する（Full Replace）。
    ※ SQLAlchemy AsyncSession はSELECTでもautobeginするため、db.begin()は使わず commit を1回にする
    """
    doctor_uuid = uuid.UUID(doctor_id)

    # ■ 1. デバッグログ（先頭）
    print(
        f"DEBUG PUT: doctor_id={doctor_id}, "
        f"payload={doc.model_dump(exclude_unset=True)}"
    )

    try:
        # Doctor取得（存在確認）
        result = await db.execute(select(Doctor).where(Doctor.id == doctor_uuid))
        doctor = result.scalar_one_or_none()
        if doctor is None:
            raise HTTPException(status_code=404, detail="Doctor not found")

        # 「送信されたキーだけ」を扱う（未送信は触らない）
        payload = doc.model_dump(exclude_unset=True)

        # 空配列でも全置換したいので「キー存在」で判定
        has_unavailable_dates = "unavailable_dates" in payload
        has_fixed_weekdays = "fixed_weekdays" in payload

        unavailable_dates = payload.pop("unavailable_dates", None)
        fixed_weekdays = payload.pop("fixed_weekdays", None)

        # Doctor本体の更新：None は無視（フロントのnull送信・NOT NULL対策）
        for k, v in payload.items():
            if v is not None:
                setattr(doctor, k, v)

        # ■ 2. Full Replace（1トランザクション = commit 1回で確定）
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

        # ■ 3. Eager Load 徹底：更新後は selectinload付きで再取得して返す
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


# 5. 削除API
@router.delete("/{doctor_id}")
async def delete_doctor(doctor_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(delete(Doctor).where(Doctor.id == uuid.UUID(doctor_id)))
    await db.commit()
    return {"message": "削除しました"}