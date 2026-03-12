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
    await db.commit()
    return result.rowcount or 0