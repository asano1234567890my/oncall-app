"""AIガイド チャットAPI"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import get_current_hospital
from core.db import get_db
from models.guide_insight import GuideInsight
from schemas.guide import GuideChatRequest, GuideChatResponse
from services import guide_service, usage_service

router = APIRouter(prefix="/api/guide", tags=["guide"])

limiter = Limiter(key_func=get_remote_address)


@router.post("/chat", response_model=GuideChatResponse)
@limiter.limit("3/minute")
async def guide_chat(
    request: Request,
    req: GuideChatRequest,
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(get_db),
) -> GuideChatResponse:
    await usage_service.log_event(db, hospital_id, "guide_chat")
    reply, meta = await guide_service.chat(
        db,
        hospital_id,
        req.message,
        [m.model_dump() for m in req.history],
    )

    # Record insight (fire-and-forget)
    insight_id = None
    category = None
    if meta:
        try:
            insight = GuideInsight(
                hospital_id=hospital_id,
                category=meta["category"],
                summary=meta["summary"],
                feature_request=meta.get("feature_request"),
                user_message=req.message,
                ai_response=reply,
                created_at=datetime.now(timezone.utc),
            )
            db.add(insight)
            await db.flush()
            insight_id = str(insight.id)
            category = meta["category"]
        except Exception:
            pass  # Don't break chat for analytics failure

    return GuideChatResponse(reply=reply, insight_id=insight_id, category=category)


@router.patch("/{insight_id}/submit")
async def submit_insight(
    insight_id: uuid.UUID,
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """ユーザーが明示的に開発者へ送信したインサイトにフラグを立てる"""
    from sqlalchemy import select, update
    result = await db.execute(
        update(GuideInsight)
        .where(GuideInsight.id == insight_id, GuideInsight.hospital_id == hospital_id)
        .values(is_user_submitted=True)
    )
    await db.commit()
    return {"ok": True}
