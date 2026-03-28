from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import delete as sa_delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.auth import create_access_token, get_current_hospital
from core.db import get_db
from models.doctor import Doctor
from models.hospital import Hospital
from models.shift import ShiftAssignment
from models.system_setting import SystemSetting
from models.transfer_code import TransferCode
from models.unavailable_day import UnavailableDay
from services.auth_service import (
    create_hospital,
    get_hospital_by_email,
    get_hospital_by_id,
    get_hospital_by_name,
    get_hospital_by_name_or_email,
    update_password,
    verify_password,
)
from services.usage_service import log_event

router = APIRouter(prefix="/api/auth", tags=["Auth"])


class LoginRequest(BaseModel):
    name: str  # 施設名 or メールアドレス
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    hospital_id: str
    hospital_name: str
    has_email: bool = False


class UpdateEmailRequest(BaseModel):
    email: str


class UpdateNameRequest(BaseModel):
    name: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    hospital = await get_hospital_by_name_or_email(db, body.name)
    if hospital is None or not verify_password(body.password, hospital.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="病院名（またはメールアドレス）かパスワードが正しくありません",
        )
    token = create_access_token(hospital.id)
    # last_login_at 更新 + イベント記録
    hospital.last_login_at = datetime.now(timezone.utc)
    await log_event(db, hospital.id, "login")
    await db.commit()
    return TokenResponse(
        access_token=token,
        hospital_id=str(hospital.id),
        hospital_name=hospital.name,
        has_email=hospital.email is not None,
    )


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    if len(body.name.strip()) < 2:
        raise HTTPException(status_code=400, detail="病院名は2文字以上必要です")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="パスワードは8文字以上必要です")

    email = body.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="有効なメールアドレスを入力してください")

    existing = await get_hospital_by_name(db, body.name)
    if existing is not None:
        raise HTTPException(status_code=409, detail="その病院名はすでに登録されています")

    existing_email = await get_hospital_by_email(db, email)
    if existing_email is not None:
        raise HTTPException(status_code=409, detail="そのメールアドレスはすでに登録されています")

    hospital = await create_hospital(db, body.name, body.password, email=email)
    token = create_access_token(hospital.id)
    await log_event(db, hospital.id, "register")
    await db.commit()
    return TokenResponse(
        access_token=token,
        hospital_id=str(hospital.id),
        hospital_name=hospital.name,
        has_email=True,
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


# ── アカウント情報 ──


@router.get("/me")
async def get_me(
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(get_current_hospital),
):
    hospital = await get_hospital_by_id(db, hospital_id)
    if hospital is None:
        raise HTTPException(status_code=404, detail="病院が見つかりません")
    return {
        "hospital_id": str(hospital.id),
        "hospital_name": hospital.name,
        "email": hospital.email,
        "has_email": hospital.email is not None,
        "plan": hospital.plan,
    }


@router.put("/email", status_code=200)
async def update_email(
    body: UpdateEmailRequest,
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(get_current_hospital),
):
    email = body.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="有効なメールアドレスを入力してください")

    existing = await get_hospital_by_email(db, email)
    if existing is not None and existing.id != hospital_id:
        raise HTTPException(status_code=409, detail="そのメールアドレスはすでに登録されています")

    hospital = await get_hospital_by_id(db, hospital_id)
    if hospital is None:
        raise HTTPException(status_code=404, detail="病院が見つかりません")

    hospital.email = email
    await db.commit()
    return {"message": "メールアドレスを登録しました", "email": email}


@router.put("/name", status_code=200)
async def update_name(
    body: UpdateNameRequest,
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(get_current_hospital),
):
    name = body.name.strip()
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="病院名は2文字以上必要です")

    hospital = await get_hospital_by_id(db, hospital_id)
    if hospital is None:
        raise HTTPException(status_code=404, detail="病院が見つかりません")

    if hospital.email is None:
        raise HTTPException(status_code=400, detail="メールアドレスを先に登録してください（病院名変更にはメアド登録が必要です）")

    existing = await get_hospital_by_name(db, name)
    if existing is not None and existing.id != hospital_id:
        raise HTTPException(status_code=409, detail="その病院名はすでに使用されています")

    hospital.name = name
    await db.commit()
    return {"message": "病院名を変更しました", "hospital_name": name}


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


# ── データ引き継ぎ ──


class TransferCodeResponse(BaseModel):
    code: str
    expires_at: str


class TransferImportRequest(BaseModel):
    code: str


@router.post("/transfer-code", response_model=TransferCodeResponse)
async def generate_transfer_code(
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(get_current_hospital),
):
    """引き継ぎコードを発行（24時間有効）。既存コードがあれば置換。"""
    # 既存コード削除
    await db.execute(
        sa_delete(TransferCode).where(TransferCode.hospital_id == hospital_id)
    )

    code = secrets.token_urlsafe(9)  # 12文字
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    tc = TransferCode(
        hospital_id=hospital_id,
        code=code,
        expires_at=expires_at,
    )
    db.add(tc)
    await db.commit()

    return TransferCodeResponse(code=code, expires_at=expires_at.isoformat())


@router.post("/transfer-import", status_code=200)
async def transfer_import(
    body: TransferImportRequest,
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(get_current_hospital),
):
    """引き継ぎコードで別アカウントのデータを取り込む。既存データは上書き。"""
    # コード検索
    result = await db.execute(
        select(TransferCode).where(TransferCode.code == body.code)
    )
    tc = result.scalar_one_or_none()
    if tc is None:
        raise HTTPException(status_code=400, detail="無効な引き継ぎコードです")
    if tc.expires_at < datetime.now(timezone.utc):
        await db.delete(tc)
        await db.commit()
        raise HTTPException(status_code=400, detail="引き継ぎコードの有効期限が切れています")
    if tc.hospital_id == hospital_id:
        raise HTTPException(status_code=400, detail="自分自身のコードは使用できません")

    source_hospital_id = tc.hospital_id

    # ── ソースデータ読み込み ──
    src_doctors_result = await db.execute(
        select(Doctor)
        .where(Doctor.hospital_id == source_hospital_id)
        .options(selectinload(Doctor.unavailable_days), selectinload(Doctor.shift_assignments))
    )
    src_doctors = src_doctors_result.scalars().all()

    src_settings_result = await db.execute(
        select(SystemSetting).where(SystemSetting.hospital_id == source_hospital_id)
    )
    src_settings = src_settings_result.scalars().all()

    # ── ターゲットの既存データ削除 ──
    # doctors削除でshift_assignments, unavailable_daysもCASCADE削除
    await db.execute(sa_delete(SystemSetting).where(SystemSetting.hospital_id == hospital_id))
    await db.execute(sa_delete(Doctor).where(Doctor.hospital_id == hospital_id))

    # ── データコピー ──
    doctors_count = 0
    for src_doc in src_doctors:
        new_doc = Doctor(
            hospital_id=hospital_id,
            name=src_doc.name,
            is_active=src_doc.is_active,
            is_locked=src_doc.is_locked,
            access_token=secrets.token_urlsafe(32),
            min_score=src_doc.min_score,
            max_score=src_doc.max_score,
            target_score=src_doc.target_score,
        )
        db.add(new_doc)
        await db.flush()  # new_doc.id を確定

        for ud in src_doc.unavailable_days:
            db.add(UnavailableDay(
                doctor_id=new_doc.id,
                date=ud.date,
                day_of_week=ud.day_of_week,
                is_fixed=ud.is_fixed,
                target_shift=ud.target_shift,
                is_soft_penalty=ud.is_soft_penalty,
            ))

        for sa in src_doc.shift_assignments:
            db.add(ShiftAssignment(
                doctor_id=new_doc.id,
                date=sa.date,
                shift_type=sa.shift_type,
            ))

        doctors_count += 1

    for s in src_settings:
        db.add(SystemSetting(
            hospital_id=hospital_id,
            key=s.key,
            value=s.value,
        ))

    # 使用済みコード削除
    await db.delete(tc)
    await db.commit()

    return {"message": f"データを取り込みました（医師{doctors_count}名）", "doctors_count": doctors_count}
