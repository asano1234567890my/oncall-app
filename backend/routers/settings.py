from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.db import get_db
from schemas.settings import (
    CustomHolidaysResponse,
    CustomHolidaysUpsertRequest,
    CustomHolidaysValue,
)
from services.settings_service import get_custom_holidays, upsert_custom_holidays

router = APIRouter(prefix="/api/settings", tags=["Settings"])


@router.get("/custom_holidays", response_model=CustomHolidaysResponse)
async def api_get_custom_holidays(
    year: int = Query(..., description="YYYY"),
    db: AsyncSession = Depends(get_db),
):
    if year < 1900 or year > 2200:
        raise HTTPException(status_code=400, detail="Invalid year")

    value = await get_custom_holidays(db, year)
    return {
        "year": year,
        "key": f"custom_holidays_{year}",
        "value": CustomHolidaysValue(**value),
    }


@router.post("/custom_holidays", response_model=CustomHolidaysResponse)
async def api_post_custom_holidays(
    req: CustomHolidaysUpsertRequest,
    db: AsyncSession = Depends(get_db),
):
    if req.year < 1900 or req.year > 2200:
        raise HTTPException(status_code=400, detail="Invalid year")

    value = {
        "manual_holidays": req.manual_holidays,
        "ignored_holidays": req.ignored_holidays,
    }

    await upsert_custom_holidays(db, req.year, value)

    # 返却は保存後の値（整形済み）
    saved = await get_custom_holidays(db, req.year)
    return {
        "year": req.year,
        "key": f"custom_holidays_{req.year}",
        "value": CustomHolidaysValue(**saved),
    }