"""AIガイド チャットAPI"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import get_current_hospital
from core.db import get_db
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
    reply = await guide_service.chat(
        db,
        hospital_id,
        req.message,
        [m.model_dump() for m in req.history],
    )
    return GuideChatResponse(reply=reply)
