from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.db import get_db
from schemas.holiday import HolidayResponse
from services.holiday_service import ensure_holidays_for_year, fetch_holidays

router = APIRouter(prefix="/api/holidays", tags=["Holidays"])


@router.get("/", response_model=list[HolidayResponse])
async def list_holidays(
    year: int | None = Query(default=None, description="例: 2024"),
    year_month: str | None = Query(default=None, description="例: 2024-05"),
    db: AsyncSession = Depends(get_db),
):
    if year is None and year_month is None:
        raise HTTPException(status_code=400, detail="Either 'year' or 'year_month' is required")
    if year is not None and year_month is not None:
        raise HTTPException(status_code=400, detail="Specify only one of 'year' or 'year_month'")

    # 初期投入（存在しなければ投入）
    try:
        if year is not None:
            await ensure_holidays_for_year(db, year)
        else:
            y = int(year_month.split("-")[0])
            await ensure_holidays_for_year(db, y)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 取得
    try:
        holidays = await fetch_holidays(db, year=year, year_month=year_month)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return holidays