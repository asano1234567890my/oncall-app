from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import create_access_token, get_current_hospital
from core.db import get_db
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
