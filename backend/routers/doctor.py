# backend/routers/doctor.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
import uuid

from core.db import get_db
from models.doctor import Doctor
from schemas.doctor import DoctorCreate, DoctorUpdate  # ★ここが重要

router = APIRouter(prefix="/api/doctors", tags=["Doctors"])


# 1. 取得API
@router.get("/")
async def get_doctors(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Doctor).order_by(Doctor.name))
    doctors = result.scalars().all()
    # 既存の返却形式を維持しつつ、追加カラムも返す
    return [
        {
            "id": str(d.id),
            "name": d.name,
            "experience_years": d.experience_years,
            "min_score": d.min_score,
            "max_score": d.max_score,
            "target_score": d.target_score,
        }
        for d in doctors
    ]


# 2. 医師の追加API
@router.post("/")
async def create_doctor(doc: DoctorCreate, db: AsyncSession = Depends(get_db)):
    try:
        new_doc = Doctor(
            name=doc.name,
            experience_years=doc.experience_years,
            is_active=doc.is_active,
            # ★追加：スコア3項目も保存
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


# 3. 更新API
@router.put("/{doctor_id}")
async def update_doctor(doctor_id: str, doc: DoctorUpdate, db: AsyncSession = Depends(get_db)):
    # ★送られてきた項目だけ更新（None は更新対象外）
    values = {k: v for k, v in doc.model_dump().items() if v is not None}
    if not values:
        return {"message": "更新する項目がありません"}

    await db.execute(
        update(Doctor).where(Doctor.id == uuid.UUID(doctor_id)).values(**values)
    )
    await db.commit()
    return {"message": "医師情報を更新しました"}


# 4. 削除API
@router.delete("/{doctor_id}")
async def delete_doctor(doctor_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(delete(Doctor).where(Doctor.id == uuid.UUID(doctor_id)))
    await db.commit()
    return {"message": "削除しました"}