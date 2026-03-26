# backend/routers/shared_entry.py — 共有入力ページ用API
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.db import get_db
from core.auth import get_current_hospital
from models.doctor import Doctor
from services.settings_service import get_system_setting, upsert_system_setting

router = APIRouter(prefix="/api/shared-entry", tags=["SharedEntry"])

SHARED_ENTRY_TOKEN_KEY = "shared_entry_token"


async def _get_or_create_token(db: AsyncSession, hospital_id: uuid.UUID) -> str:
    """病院の共有トークンを取得。なければ新規作成して返す。"""
    existing = await get_system_setting(db, hospital_id, SHARED_ENTRY_TOKEN_KEY)
    if existing and isinstance(existing, str):
        return existing
    token = uuid.uuid4().hex
    await upsert_system_setting(
        db, hospital_id, SHARED_ENTRY_TOKEN_KEY, token,
        description="Shared entry page token",
    )
    return token


@router.get("/token")
async def get_shared_entry_token(
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(get_db),
):
    """管理者用: 共有入力ページのトークンを取得（なければ自動発行）"""
    token = await _get_or_create_token(db, hospital_id)
    return {"token": token}


@router.post("/token/regenerate")
async def regenerate_shared_entry_token(
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(get_db),
):
    """管理者用: 共有入力ページのトークンを再発行"""
    token = uuid.uuid4().hex
    await upsert_system_setting(
        db, hospital_id, SHARED_ENTRY_TOKEN_KEY, token,
        description="Shared entry page token",
    )
    return {"token": token}


# ── 公開エンドポイント（認証不要） ──

@router.get("/public/{shared_token}/doctors")
async def get_doctors_by_shared_token(
    shared_token: str,
    db: AsyncSession = Depends(get_db),
):
    """共有トークンから病院を特定し、医師リスト（名前・ロック状態・個別トークン）を返す"""
    from models.system_setting import SystemSetting

    # トークンから hospital_id を逆引き
    result = await db.execute(
        select(SystemSetting).where(
            SystemSetting.key == SHARED_ENTRY_TOKEN_KEY,
            SystemSetting.value == shared_token,
        )
    )
    setting = result.scalar_one_or_none()
    if setting is None:
        raise HTTPException(status_code=404, detail="無効なURLです")

    hospital_id = setting.hospital_id

    # 医師リスト取得
    result = await db.execute(
        select(Doctor)
        .where(Doctor.hospital_id == hospital_id, Doctor.is_active == True)
        .order_by(Doctor.name)
    )
    doctors = result.scalars().all()

    # 管理者メッセージ・不可日上限も返す
    doctor_message = await get_system_setting(db, hospital_id, "doctor_message")
    unavail_day_limit_raw = await get_system_setting(db, hospital_id, "unavail_day_limit")
    unavail_day_limit = None
    if unavail_day_limit_raw is not None:
        try:
            unavail_day_limit = int(unavail_day_limit_raw)
        except (TypeError, ValueError):
            pass

    return {
        "doctors": [
            {
                "id": str(d.id),
                "name": d.name,
                "is_locked": d.is_locked,
                "access_token": d.access_token,
            }
            for d in doctors
        ],
        "doctor_message": doctor_message if isinstance(doctor_message, str) else None,
        "unavail_day_limit": unavail_day_limit,
    }
