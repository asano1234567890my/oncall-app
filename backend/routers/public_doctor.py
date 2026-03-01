from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from core.db import get_db
from models.doctor import Doctor
from models.unavailable_day import UnavailableDay
from schemas.doctor import PublicDoctorUpdate

router = APIRouter(prefix="/api/public/doctors", tags=["Public"])


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
        "is_locked": doctor.is_locked,  # ★追加（公開側でも見えるとUXが良い）
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


@router.put("/{access_token}")
async def update_doctor_by_token(
    access_token: str, payload: PublicDoctorUpdate, db: AsyncSession = Depends(get_db)
):
    print(
        f"DEBUG PUBLIC PUT: access_token={access_token}, "
        f"payload={payload.model_dump(exclude_unset=True)}"
    )

    try:
        # Doctor取得（トークン一致）
        result = await db.execute(select(Doctor).where(Doctor.access_token == access_token))
        doctor = result.scalar_one_or_none()
        if doctor is None:
            raise HTTPException(status_code=404, detail="Doctor not found")

        # ★要件：ロック中は更新禁止
        if doctor.is_locked is True:
            raise HTTPException(status_code=403, detail="入力期間は終了しています（Locked）")

        data = payload.model_dump(exclude_unset=True)

        # 空配列でも全置換したいのでキー存在で判定
        has_unavailable_dates = "unavailable_dates" in data
        has_fixed_weekdays = "fixed_weekdays" in data

        unavailable_dates = data.get("unavailable_dates", None)
        fixed_weekdays = data.get("fixed_weekdays", None)

        # Full Replace（commit 1回）
        if has_unavailable_dates or has_fixed_weekdays:
            await db.execute(delete(UnavailableDay).where(UnavailableDay.doctor_id == doctor.id))

            new_rows: list[UnavailableDay] = []

            for d in (unavailable_dates or []):
                new_rows.append(
                    UnavailableDay(
                        doctor_id=doctor.id,
                        date=d,
                        day_of_week=None,
                        is_fixed=False,
                    )
                )

            for w in (fixed_weekdays or []):
                new_rows.append(
                    UnavailableDay(
                        doctor_id=doctor.id,
                        date=None,
                        day_of_week=int(w),
                        is_fixed=True,
                    )
                )

            if new_rows:
                db.add_all(new_rows)

        await db.commit()

        # 返却はEager Load付きで再取得
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
        print(f"ERROR PUBLIC PUT access_token={access_token}: {repr(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))