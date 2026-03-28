"""利用イベント記録ヘルパー（fire-and-forget方式）"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from models.usage_event import UsageEvent

logger = logging.getLogger(__name__)


async def log_event(
    db: AsyncSession,
    hospital_id: uuid.UUID,
    event_type: str,
    metadata: dict | None = None,
) -> None:
    """利用イベントを記録する。失敗してもメイン処理を止めない。"""
    try:
        event = UsageEvent(
            hospital_id=hospital_id,
            event_type=event_type,
            created_at=datetime.now(timezone.utc),
            metadata_=metadata,
        )
        db.add(event)
        await db.flush()
    except Exception:
        logger.warning("Failed to log usage event: %s", event_type, exc_info=True)
