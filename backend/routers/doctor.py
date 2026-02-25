# backend/routers/doctor.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from pydantic import BaseModel
from typing import List
import uuid

from core.db import get_db
from models.doctor import Doctor

router = APIRouter(prefix="/api/doctors", tags=["Doctors"])

# --- 送られてくるデータの形を定義 ---
class DoctorCreate(BaseModel):
    name: str
    experience_years: int = 0

class DoctorUpdate(BaseModel):
    name: str

# 1. 取得API
@router.get("/")
async def get_doctors(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Doctor).order_by(Doctor.name))
    doctors = result.scalars().all()
    return [{"id": str(d.id), "name": d.name, "experience_years": d.experience_years} for d in doctors]

# ====================================================
# 2. 【ここが create_doctor です！】 医師の追加API
# ====================================================
@router.post("/")
async def create_doctor(doc: DoctorCreate, db: AsyncSession = Depends(get_db)):
    try:
        new_doc = Doctor(name=doc.name, experience_years=doc.experience_years)
        db.add(new_doc)
        
        await db.commit()       # DBに書き込む
        await db.refresh(new_doc) # 最新の状態に更新（重要！）
        
        print(f"DEBUG: 医師 {doc.name} を登録成功")
        return {"message": "医師を登録しました", "id": str(new_doc.id)}
        
    except Exception as e:
        await db.rollback()
        print(f"DEBUG ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# 3. 更新API
@router.put("/{doctor_id}")
async def update_doctor(doctor_id: str, doc: DoctorUpdate, db: AsyncSession = Depends(get_db)):
    await db.execute(
        update(Doctor).where(Doctor.id == uuid.UUID(doctor_id)).values(name=doc.name)
    )
    await db.commit()
    return {"message": "名前を更新しました"}

# 4. 削除API
@router.delete("/{doctor_id}")
async def delete_doctor(doctor_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(delete(Doctor).where(Doctor.id == uuid.UUID(doctor_id)))
    await db.commit()
    return {"message": "削除しました"}