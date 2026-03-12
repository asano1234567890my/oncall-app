from __future__ import annotations

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from models.doctor import Doctor


async def bulk_set_doctor_lock_state(db: AsyncSession, *, is_locked: bool) -> int:
    result = await db.execute(
        update(Doctor)
        .where(Doctor.is_active.is_(True))
        .values(is_locked=is_locked)
    )
    updated_count = result.rowcount or 0
    if updated_count <= 0:
        raise ValueError("No active doctors found to update")

    await db.commit()
    return updated_count