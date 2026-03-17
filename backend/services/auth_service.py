from __future__ import annotations

import uuid

import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.hospital import Hospital


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


async def get_hospital_by_name(db: AsyncSession, name: str) -> Hospital | None:
    result = await db.execute(select(Hospital).where(Hospital.name == name))
    return result.scalar_one_or_none()


async def get_hospital_by_id(db: AsyncSession, hospital_id: uuid.UUID) -> Hospital | None:
    result = await db.execute(select(Hospital).where(Hospital.id == hospital_id))
    return result.scalar_one_or_none()


async def create_hospital(db: AsyncSession, name: str, password: str) -> Hospital:
    hospital = Hospital(name=name, password_hash=hash_password(password))
    db.add(hospital)
    await db.commit()
    await db.refresh(hospital)
    return hospital


async def update_password(db: AsyncSession, hospital_id: uuid.UUID, new_password: str) -> None:
    hospital = await get_hospital_by_id(db, hospital_id)
    if hospital is None:
        raise ValueError("Hospital not found")
    hospital.password_hash = hash_password(new_password)
    await db.commit()
