import uuid

from fastapi import APIRouter, Depends, HTTPException
from typing import Any, Dict, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import get_current_hospital
from core.db import get_db
from models.doctor import Doctor
from schemas.optimize import OptimizeRequest, OptimizeResponse
from services.optimizer import OnCallOptimizer
from services.optimizer_history import build_past_total_scores

router = APIRouter(prefix="/api/optimize", tags=["Optimize"])


def _model_dump_like(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump()
    if hasattr(value, "dict"):
        return value.dict()
    return value


def _serialize_scalar(value: Any) -> Any:
    return value.isoformat() if hasattr(value, "isoformat") else value


def _normalize_unavailable_item(item: Any) -> Optional[Dict[str, Any]]:
    item = _model_dump_like(item)

    if isinstance(item, int):
        return {"date": item, "target_shift": "all", "is_soft_penalty": False}

    if not isinstance(item, dict):
        return None

    raw_date = item.get("date")
    if raw_date is None:
        return None

    return {
        "date": _serialize_scalar(raw_date),
        "target_shift": item.get("target_shift", "all"),
        "is_soft_penalty": bool(item.get("is_soft_penalty", False)),
    }


def _normalize_fixed_weekday_item(item: Any) -> Optional[Dict[str, Any]]:
    item = _model_dump_like(item)

    if isinstance(item, int):
        return {"day_of_week": item, "target_shift": "all", "is_soft_penalty": False}

    if not isinstance(item, dict):
        return None

    raw_day_of_week = item.get("day_of_week", item.get("weekday"))
    if raw_day_of_week is None:
        return None

    return {
        "day_of_week": raw_day_of_week,
        "target_shift": item.get("target_shift", "all"),
        "is_soft_penalty": bool(item.get("is_soft_penalty", False)),
    }


@router.post("/", response_model=OptimizeResponse)
async def generate_schedule(
    req: OptimizeRequest,
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(
            select(Doctor)
            .where(Doctor.hospital_id == hospital_id, Doctor.is_active.is_(True))
            .order_by(Doctor.id)
        )
        doctors = result.scalars().all()

        if len(doctors) < req.num_doctors:
            raise HTTPException(status_code=400, detail="num_doctors exceeds registered active doctors")

        doctors = doctors[: req.num_doctors]

        idx_to_uuid: Dict[int, str] = {i: str(d.id) for i, d in enumerate(doctors)}
        uuid_to_idx: Dict[str, int] = {str(d.id): i for i, d in enumerate(doctors)}

        def _key_to_idx(key: Any) -> int:
            k = str(key)

            if k.isdigit():
                idx = int(k)
                if 0 <= idx < req.num_doctors:
                    return idx
                raise HTTPException(status_code=400, detail=f"doctor index out of range: {k}")

            if k in uuid_to_idx:
                return uuid_to_idx[k]

            raise HTTPException(status_code=400, detail=f"unknown doctor key: {k}")

        def _remap_keys(src: Dict[str, Any]) -> Dict[int, Any]:
            out: Dict[int, Any] = {}
            for k, v in src.items():
                out[_key_to_idx(k)] = v
            return out

        historical_past_total_scores = await build_past_total_scores(
            db,
            hospital_id=hospital_id,
            doctor_ids=[doctor.id for doctor in doctors],
            target_year=req.year,
            target_month=req.month,
        )
        merged_past_total_scores: Dict[str, float] = {
            str(doctor_id): score
            for doctor_id, score in historical_past_total_scores.items()
        }
        merged_past_total_scores.update(req.past_total_scores)

        formatted_prev_month = _remap_keys(req.prev_month_worked_days)
        formatted_min_score = _remap_keys(req.min_score_by_doctor)
        formatted_max_score = _remap_keys(req.max_score_by_doctor)
        formatted_target_score = _remap_keys(req.target_score_by_doctor)
        formatted_past_total_scores = _remap_keys(merged_past_total_scores)
        formatted_sat_prev = _remap_keys(req.sat_prev)

        locked_shifts_idx = [
            {
                "date": _serialize_scalar(locked.date),
                "shift_type": locked.shift_type,
                "doctor_idx": _key_to_idx(locked.doctor_id),
            }
            for locked in req.locked_shifts
        ]

        previous_month_shifts_idx = [
            {
                "date": _serialize_scalar(shift.date),
                "shift_type": shift.shift_type,
                "doctor_idx": _key_to_idx(shift.doctor_id),
            }
            for shift in (req.previous_month_shifts or [])
        ]

        _u = _remap_keys(req.unavailable)
        formatted_unavailable: Dict[int, Any] = {
            idx: [
                normalized
                for item in (items or [])
                for normalized in [_normalize_unavailable_item(item)]
                if normalized is not None
            ]
            for idx, items in _u.items()
        }

        _fw = _remap_keys(req.fixed_unavailable_weekdays)
        formatted_fixed_weekdays: Dict[int, Any] = {
            idx: [
                normalized
                for item in (items or [])
                for normalized in [_normalize_fixed_weekday_item(item)]
                if normalized is not None
            ]
            for idx, items in _fw.items()
        }

        weights_dict = (
            req.objective_weights.model_dump()
            if hasattr(req.objective_weights, "model_dump")
            else req.objective_weights.dict()
        )

        optimizer = OnCallOptimizer(
            num_doctors=req.num_doctors,
            year=req.year,
            month=req.month,
            holidays=req.holidays,
            unavailable=formatted_unavailable,
            fixed_unavailable_weekdays=formatted_fixed_weekdays,
            prev_month_worked_days=formatted_prev_month,
            prev_month_last_day=req.prev_month_last_day,
            previous_month_shifts=previous_month_shifts_idx,
            score_min=req.score_min,
            score_max=req.score_max,
            past_sat_counts=req.past_sat_counts,
            past_sunhol_counts=req.past_sunhol_counts,
            min_score_by_doctor=formatted_min_score,
            max_score_by_doctor=formatted_max_score,
            target_score_by_doctor=formatted_target_score,
            past_total_scores=formatted_past_total_scores,
            sat_prev=formatted_sat_prev,
            objective_weights=weights_dict,
            hard_constraints=req.hard_constraints,
            locked_shifts=locked_shifts_idx,
        )

        optimizer.build_model()
        solve_result = optimizer.solve()

        if not solve_result.get("success"):
            raise HTTPException(
                status_code=400,
                detail=solve_result.get("message", "Optimization failed"),
            )

        if isinstance(solve_result.get("schedule"), list):
            for row in solve_result["schedule"]:
                if row.get("day_shift") is not None:
                    try:
                        idx = int(row["day_shift"])
                        row["day_shift"] = idx_to_uuid.get(idx, row["day_shift"])
                    except Exception:
                        pass

                if row.get("night_shift") is not None:
                    try:
                        idx = int(row["night_shift"])
                        row["night_shift"] = idx_to_uuid.get(idx, row["night_shift"])
                    except Exception:
                        pass

        if isinstance(solve_result.get("scores"), dict):
            new_scores: Dict[str, float] = {}
            for k, v in solve_result["scores"].items():
                try:
                    idx = int(k)
                    new_scores[idx_to_uuid.get(idx, str(k))] = v
                except Exception:
                    new_scores[str(k)] = v
            solve_result["scores"] = new_scores

        return solve_result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
