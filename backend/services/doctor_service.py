from __future__ import annotations

import uuid

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from models.doctor import Doctor


async def bulk_set_doctor_lock_state(
    db: AsyncSession, *, hospital_id: uuid.UUID, is_locked: bool
) -> int:
    result = await db.execute(
        update(Doctor)
        .where(Doctor.hospital_id == hospital_id, Doctor.is_active.is_(True), Doctor.is_external.is_(False))
        .values(is_locked=is_locked)
    )
    updated_count = result.rowcount or 0
    if updated_count <= 0:
        raise ValueError("No active doctors found to update")

    await db.commit()
    return updated_count