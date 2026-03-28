from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import get_settings

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 30  # 30 days

security = HTTPBearer()


def create_access_token(hospital_id: uuid.UUID) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {"hospital_id": str(hospital_id), "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=ALGORITHM)


def get_current_hospital(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> uuid.UUID:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="認証が必要です",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        settings = get_settings()
        payload = jwt.decode(
            credentials.credentials, settings.jwt_secret_key, algorithms=[ALGORITHM]
        )
        hospital_id_str: str | None = payload.get("hospital_id")
        if hospital_id_str is None:
            raise exc
        return uuid.UUID(hospital_id_str)
    except (JWTError, ValueError):
        raise exc


async def get_current_superadmin(
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(None),  # placeholder, overridden below
) -> uuid.UUID:
    """is_superadmin=True の病院のみ許可する dependency。
    使用時は router で db dependency を注入すること:
        Depends(get_current_superadmin_dep(get_db))
    """
    raise NotImplementedError("Use get_current_superadmin_dep instead")


def get_current_superadmin_dep(get_db):
    """get_db を注入して superadmin チェック dependency を生成する。"""
    from models.hospital import Hospital

    async def _dep(
        hospital_id: uuid.UUID = Depends(get_current_hospital),
        db: AsyncSession = Depends(get_db),
    ) -> uuid.UUID:
        result = await db.execute(
            select(Hospital.is_superadmin).where(Hospital.id == hospital_id)
        )
        row = result.scalar_one_or_none()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="アクセス権限がありません",
            )
        return hospital_id

    return _dep
