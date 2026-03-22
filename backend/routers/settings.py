from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import get_current_hospital
from core.db import get_db
from schemas.settings import (
    CustomHolidaysResponse,
    CustomHolidaysUpsertRequest,
    CustomHolidaysValue,
    OptimizerConfigRequest,
    SystemSettingUpsertRequest,
)
from services.settings_service import (
    get_custom_holidays,
    get_optimizer_config,
    get_system_setting,
    upsert_custom_holidays,
    upsert_optimizer_config,
    upsert_system_setting,
)

router = APIRouter(prefix="/api/settings", tags=["Settings"])


@router.get("/custom_holidays", response_model=CustomHolidaysResponse)
async def api_get_custom_holidays(
    year: int = Query(..., description="YYYY"),
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(get_db),
):
    if year < 1900 or year > 2200:
        raise HTTPException(status_code=400, detail="Invalid year")
    value = await get_custom_holidays(db, hospital_id, year)
    return {
        "year": year,
        "key": f"custom_holidays_{year}",
        "value": CustomHolidaysValue(**value),
    }


@router.post("/custom_holidays", response_model=CustomHolidaysResponse)
@router.put("/custom_holidays", response_model=CustomHolidaysResponse)
async def api_upsert_custom_holidays(
    req: CustomHolidaysUpsertRequest,
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(get_db),
):
    if req.year < 1900 or req.year > 2200:
        raise HTTPException(status_code=400, detail="Invalid year")

    value = {
        "manual_holidays": req.manual_holidays,
        "ignored_holidays": req.ignored_holidays,
    }

    try:
        await upsert_custom_holidays(db, hospital_id, req.year, value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    saved = await get_custom_holidays(db, hospital_id, req.year)
    return {
        "year": req.year,
        "key": f"custom_holidays_{req.year}",
        "value": CustomHolidaysValue(**saved),
    }


@router.get("/optimizer_config")
async def api_get_optimizer_config(
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(get_db),
):
    return await get_optimizer_config(db, hospital_id)


@router.put("/optimizer_config")
async def api_upsert_optimizer_config(
    req: OptimizerConfigRequest,
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(get_db),
):
    value = {
        "score_min": req.score_min,
        "score_max": req.score_max,
        "objective_weights": req.objective_weights,
        "hard_constraints": req.hard_constraints,
    }
    await upsert_optimizer_config(db, hospital_id, value)
    return await get_optimizer_config(db, hospital_id)


@router.get("/kv/{key}")
async def api_get_system_setting(
    key: str,
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(get_db),
):
    if len(key) > 100:
        raise HTTPException(status_code=400, detail="Key too long")
    value = await get_system_setting(db, hospital_id, key)
    return {"key": key, "value": value}


@router.put("/kv/{key}")
async def api_upsert_system_setting(
    key: str,
    req: SystemSettingUpsertRequest,
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(get_db),
):
    if len(key) > 100:
        raise HTTPException(status_code=400, detail="Key too long")
    await upsert_system_setting(db, hospital_id, key, req.value)
    return {"key": key, "value": req.value}
