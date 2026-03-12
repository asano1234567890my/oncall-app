import asyncio
from unittest.mock import AsyncMock

import pytest

from services.doctor_service import bulk_set_doctor_lock_state


class DummyResult:
    def __init__(self, rowcount: int | None):
        self.rowcount = rowcount


def test_bulk_set_doctor_lock_state_updates_active_doctors():
    db = AsyncMock()
    db.execute = AsyncMock(return_value=DummyResult(3))
    db.commit = AsyncMock()

    updated_count = asyncio.run(
        bulk_set_doctor_lock_state(db, is_locked=True)
    )

    assert updated_count == 3
    db.commit.assert_awaited_once()


def test_bulk_set_doctor_lock_state_raises_when_no_active_doctors():
    db = AsyncMock()
    db.execute = AsyncMock(return_value=DummyResult(0))
    db.commit = AsyncMock()

    with pytest.raises(ValueError, match="No active doctors found to update"):
        asyncio.run(bulk_set_doctor_lock_state(db, is_locked=False))

    db.commit.assert_not_awaited()