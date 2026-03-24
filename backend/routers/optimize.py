import uuid

from fastapi import APIRouter, Depends, HTTPException
from typing import Any, Dict, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import get_current_hospital
from core.db import get_db
from models.doctor import Doctor
from schemas.optimize import (
    ConstraintDiagnostic, ConflictGroup, DiagnosticInfo,
    DiagnoseResponse, DiagnoseResult, OptimizeRequest, OptimizeResponse,
)
from services.optimizer import OnCallOptimizer
from services.optimizer_history import build_past_total_scores
from services.settings_service import get_optimizer_config

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

        # Load shift_scores from optimizer config
        optimizer_cfg = await get_optimizer_config(db, hospital_id)
        shift_scores = optimizer_cfg.get("shift_scores")

        historical_past_total_scores = await build_past_total_scores(
            db,
            hospital_id=hospital_id,
            doctor_ids=[doctor.id for doctor in doctors],
            target_year=req.year,
            target_month=req.month,
            shift_scores=shift_scores,
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
            shift_scores=shift_scores,
        )

        # Pre-validation: fast arithmetic checks before solving
        pre_errors = optimizer.pre_validate()
        if pre_errors:
            diagnostics = DiagnosticInfo(
                pre_check_errors=[ConstraintDiagnostic(**e) for e in pre_errors]
            )
            return OptimizeResponse(
                success=False,
                message="制約の設定に問題があります",
                diagnostics=diagnostics,
            )

        optimizer.build_model()
        solve_result = optimizer.solve()

        if not solve_result.get("success"):
            return OptimizeResponse(
                success=False,
                message=solve_result.get("message", "スケジュールを生成できませんでした"),
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


@router.post("/diagnose", response_model=DiagnoseResponse)
async def diagnose_constraints(
    req: OptimizeRequest,
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(get_db),
):
    """P1-2 Phase2: Diagnose why the model is infeasible."""
    import os

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
        idx_to_name: Dict[int, str] = {i: d.name for i, d in enumerate(doctors)}

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

        optimizer_cfg = await get_optimizer_config(db, hospital_id)
        shift_scores = optimizer_cfg.get("shift_scores")

        historical_past_total_scores = await build_past_total_scores(
            db, hospital_id=hospital_id,
            doctor_ids=[doctor.id for doctor in doctors],
            target_year=req.year, target_month=req.month,
            shift_scores=shift_scores,
        )
        merged_past_total_scores: Dict[str, float] = {
            str(doctor_id): score for doctor_id, score in historical_past_total_scores.items()
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
            year=req.year, month=req.month,
            holidays=req.holidays,
            unavailable=formatted_unavailable,
            fixed_unavailable_weekdays=formatted_fixed_weekdays,
            prev_month_worked_days=formatted_prev_month,
            prev_month_last_day=req.prev_month_last_day,
            previous_month_shifts=previous_month_shifts_idx,
            score_min=req.score_min, score_max=req.score_max,
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
            shift_scores=shift_scores,
        )

        # Run Phase 1 + 2 diagnosis
        diag_result = optimizer.diagnose(doctor_names=idx_to_name)
        phase_completed = diag_result.get("phase_completed", 2)

        # Phase 3: Gemini AI explanation (optional — skip if no API key)
        ai_explanation = None
        gemini_api_key = os.getenv("GEMINI_API_KEY", "")
        if gemini_api_key and diag_result.get("conflict_groups"):
            try:
                ai_explanation = _call_gemini_diagnosis(
                    year=req.year,
                    month=req.month,
                    num_doctors=req.num_doctors,
                    num_days=optimizer.num_days,
                    holidays=req.holidays,
                    conflict_groups=diag_result["conflict_groups"],
                    specific_violations=diag_result["specific_violations"],
                    human_insights=diag_result["human_insights"],
                    gemini_api_key=gemini_api_key,
                )
                phase_completed = 3
            except Exception:
                pass  # Gemini failure is non-critical

        return DiagnoseResponse(
            success=True,
            phase_completed=phase_completed,
            result=DiagnoseResult(
                conflict_groups=[ConflictGroup(**g) for g in diag_result["conflict_groups"]],
                specific_violations=diag_result["specific_violations"],
                human_insights=diag_result["human_insights"],
                ai_explanation=ai_explanation,
            ),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _call_gemini_diagnosis(
    year: int,
    month: int,
    num_doctors: int,
    num_days: int,
    holidays: list,
    conflict_groups: list,
    specific_violations: list,
    human_insights: list,
    gemini_api_key: str,
) -> str:
    """Phase 3: Call Gemini to generate natural language explanation."""
    import os
    from google import genai
    from google.genai import types

    gemini_model = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")

    # Build calendar context
    import datetime
    import calendar as cal
    weekday_count = {i: 0 for i in range(7)}
    for day in range(1, num_days + 1):
        wd = datetime.date(year, month, day).weekday()
        weekday_count[wd] += 1
    sundays = weekday_count[6]
    saturdays = weekday_count[5]

    conflicts_text = "\n".join(f"- {g['description_ja']}" for g in conflict_groups)
    violations_text = "\n".join(f"- {v}" for v in specific_violations)
    insights_text = "\n".join(f"- {h}" for h in human_insights) if human_insights else "特になし"

    prompt = f"""あなたは病院の当直表作成の専門家です。
以下のスケジュール制約の競合を、当直表担当の医師にわかりやすく説明してください。

【カレンダー情報】
- {year}年{month}月（{num_days}日間）
- 祝日: {len(holidays)}日
- 土曜: {saturdays}日、日曜: {sundays}日
- 医師数: {num_doctors}名

【競合している制約】
{conflicts_text}

【具体的な問題点】
{violations_text}

【人間的な観点からの気づき】
{insights_text}

上記を踏まえて、以下のルールで回答してください：
1. 300文字以内で、なぜこの組み合わせで解が出ないかを簡潔に説明
2. どの設定を変更すれば解決するか、具体的に1〜3個提案
3. カレンダーの文脈（GW、年末年始、祝日の多さなど）があれば触れる
4. 専門用語は使わず、当直表を作る医師が読んで理解できる言葉で書く
5. 箇条書きは使わず、自然な文章で書く"""

    client = genai.Client(api_key=gemini_api_key)
    response = client.models.generate_content(
        model=gemini_model,
        contents=[types.Part.from_text(text=prompt)],
        config=types.GenerateContentConfig(temperature=0.3),
    )
    return response.text.strip()
