from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.auth import create_access_token, get_current_hospital
from core.db import get_db
from models.doctor import Doctor
from models.hospital import Hospital
from models.system_setting import SystemSetting
from services.auth_service import (
    create_hospital,
    get_hospital_by_id,
    get_hospital_by_name,
    update_password,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["Auth"])


class LoginRequest(BaseModel):
    name: str
    password: str


class RegisterRequest(BaseModel):
    name: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    hospital_id: str
    hospital_name: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    hospital = await get_hospital_by_name(db, body.name)
    if hospital is None or not verify_password(body.password, hospital.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="病院名またはパスワードが正しくありません",
        )
    token = create_access_token(hospital.id)
    return TokenResponse(
        access_token=token,
        hospital_id=str(hospital.id),
        hospital_name=hospital.name,
    )


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    if len(body.name.strip()) < 2:
        raise HTTPException(status_code=400, detail="病院名は2文字以上必要です")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="パスワードは8文字以上必要です")

    existing = await get_hospital_by_name(db, body.name)
    if existing is not None:
        raise HTTPException(status_code=409, detail="その病院名はすでに登録されています")

    hospital = await create_hospital(db, body.name, body.password)
    token = create_access_token(hospital.id)
    return TokenResponse(
        access_token=token,
        hospital_id=str(hospital.id),
        hospital_name=hospital.name,
    )


@router.put("/password", status_code=200)
async def change_password(
    body: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(get_current_hospital),
):
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="新しいパスワードは8文字以上必要です")

    hospital = await get_hospital_by_id(db, hospital_id)
    if hospital is None or not verify_password(body.current_password, hospital.password_hash):
        raise HTTPException(status_code=401, detail="現在のパスワードが正しくありません")

    await update_password(db, hospital_id, body.new_password)
    return {"message": "パスワードを変更しました"}


# ── データエクスポート ──


@router.get("/export")
async def export_data(
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(get_current_hospital),
):
    """病院の全データをJSONでエクスポート。"""
    hospital = await get_hospital_by_id(db, hospital_id)
    if hospital is None:
        raise HTTPException(status_code=404, detail="病院が見つかりません")

    # 医師（不可日・シフト含む）
    doctors_result = await db.execute(
        select(Doctor)
        .where(Doctor.hospital_id == hospital_id)
        .options(selectinload(Doctor.unavailable_days), selectinload(Doctor.shift_assignments))
        .order_by(Doctor.name)
    )
    doctors = doctors_result.scalars().all()

    doctors_data = []
    for doc in doctors:
        doctors_data.append({
            "name": doc.name,
            "is_active": doc.is_active,
            "is_locked": doc.is_locked,
            "min_score": doc.min_score,
            "max_score": doc.max_score,
            "target_score": doc.target_score,
            "unavailable_days": [
                {
                    "date": ud.date.isoformat() if ud.date else None,
                    "day_of_week": ud.day_of_week,
                    "is_fixed": ud.is_fixed,
                    "target_shift": ud.target_shift,
                    "is_soft_penalty": ud.is_soft_penalty,
                }
                for ud in doc.unavailable_days
            ],
            "shift_assignments": [
                {
                    "date": sa.date.isoformat(),
                    "shift_type": sa.shift_type,
                }
                for sa in sorted(doc.shift_assignments, key=lambda s: s.date)
            ],
        })

    # システム設定
    settings_result = await db.execute(
        select(SystemSetting).where(SystemSetting.hospital_id == hospital_id)
    )
    settings = settings_result.scalars().all()
    settings_data = {s.key: s.value for s in settings}

    return {
        "hospital_name": hospital.name,
        "exported_at": __import__("datetime").datetime.now().isoformat(),
        "doctors": doctors_data,
        "settings": settings_data,
    }


# ── アカウント削除 ──


class DeleteAccountRequest(BaseModel):
    password: str


@router.delete("/account", status_code=200)
async def delete_account(
    body: DeleteAccountRequest,
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(get_current_hospital),
):
    """病院アカウントと全関連データを削除。パスワード確認必須。"""
    hospital = await get_hospital_by_id(db, hospital_id)
    if hospital is None or not verify_password(body.password, hospital.password_hash):
        raise HTTPException(status_code=401, detail="パスワードが正しくありません")

    # system_settings は DB CASCADE で自動削除されるが、ORM経由でも明示削除
    await db.execute(
        select(SystemSetting).where(SystemSetting.hospital_id == hospital_id)
    )
    from sqlalchemy import delete as sa_delete
    await db.execute(sa_delete(SystemSetting).where(SystemSetting.hospital_id == hospital_id))

    # Hospital削除（CASCADE: doctors → shifts, unavailable_days）
    await db.delete(hospital)
    await db.commit()

    return {"message": "アカウントを削除しました"}
