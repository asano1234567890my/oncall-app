"""
POST /api/demo/optimize — 公開デモ用（認証不要・DB書き込みなし）
"""
from __future__ import annotations

import calendar
import time
from collections import defaultdict
from datetime import date
from typing import Any, Dict, List, Optional

import jpholiday
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from schemas.optimize import ConstraintDiagnostic, DiagnosticInfo
from services.optimizer import OnCallOptimizer

router = APIRouter(prefix="/api/demo", tags=["Demo"])

# ── シンプルなレート制限（プロセス内メモリ） ──
_rate_limits: Dict[str, List[float]] = defaultdict(list)
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX = 3


def _check_rate_limit(client_ip: str) -> None:
    now = time.time()
    timestamps = _rate_limits[client_ip]
    # Remove expired entries
    _rate_limits[client_ip] = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW]
    if len(_rate_limits[client_ip]) >= RATE_LIMIT_MAX:
        raise HTTPException(status_code=429, detail="レート制限: 1分間に3回までです")
    _rate_limits[client_ip].append(now)


def _undo_rate_limit(client_ip: str) -> None:
    """生成失敗時にカウントを1つ取り消す"""
    if _rate_limits[client_ip]:
        _rate_limits[client_ip].pop()


class DemoOptimizeRequest(BaseModel):
    num_doctors: int = Field(ge=2, le=15)
    year: int
    month: int
    holidays: List[int] = Field(default_factory=list)
    interval_days: int = Field(default=2, ge=0, le=7)
    max_saturday_nights: int = Field(default=2, ge=0, le=99)
    max_sunhol_works: Optional[int] = Field(default=None, ge=1, le=10)
    score_min: float = Field(default=3)
    score_max: float = Field(default=6)
    holiday_shift_mode: Optional[str] = None
    objective_weights: Optional[Dict[str, Any]] = None
    target_score_by_doctor: Optional[Dict[str, float]] = None
    min_score_by_doctor: Optional[Dict[str, float]] = None
    max_score_by_doctor: Optional[Dict[str, float]] = None
    shift_scores: Optional[Dict[str, float]] = None


@router.post("/optimize")
async def demo_optimize(req: DemoOptimizeRequest, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)

    try:
        # 祝日が未指定なら jpholiday から自動取得
        holidays = req.holidays
        if not holidays:
            num_days = calendar.monthrange(req.year, req.month)[1]
            holidays = [
                d
                for d in range(1, num_days + 1)
                if jpholiday.is_holiday(date(req.year, req.month, d))
            ]

        hard_constraints: Dict[str, Any] = {
            "interval_days": req.interval_days,
            "max_saturday_nights": req.max_saturday_nights,
        }
        if req.max_sunhol_works is not None:
            hard_constraints["max_sunhol_works"] = req.max_sunhol_works
        if req.holiday_shift_mode:
            hard_constraints["holiday_shift_mode"] = req.holiday_shift_mode

        # JSON keys are strings; optimizer expects int keys
        def _int_keys(d: Optional[Dict[str, float]]) -> Dict[int, float]:
            return {int(k): v for k, v in (d or {}).items()}

        optimizer = OnCallOptimizer(
            num_doctors=req.num_doctors,
            year=req.year,
            month=req.month,
            holidays=holidays,
            unavailable={},
            fixed_unavailable_weekdays={},
            prev_month_worked_days={},
            prev_month_last_day=0,
            previous_month_shifts=[],
            score_min=req.score_min,
            score_max=req.score_max,
            past_sat_counts={},
            past_sunhol_counts={},
            min_score_by_doctor=_int_keys(req.min_score_by_doctor),
            max_score_by_doctor=_int_keys(req.max_score_by_doctor),
            target_score_by_doctor=_int_keys(req.target_score_by_doctor),
            past_total_scores={},
            sat_prev={},
            objective_weights=req.objective_weights or {},
            hard_constraints=hard_constraints,
            locked_shifts=[],
            shift_scores=req.shift_scores,
        )

        # Pre-validation
        pre_errors = optimizer.pre_validate()
        if pre_errors:
            _undo_rate_limit(client_ip)
            return {
                "success": False,
                "message": "制約の設定に問題があります",
                "diagnostics": DiagnosticInfo(
                    pre_check_errors=[ConstraintDiagnostic(**e) for e in pre_errors]
                ).model_dump(),
            }

        optimizer.build_model()
        solve_result = optimizer.solve(time_limit_seconds=3.0)

        if not solve_result.get("success"):
            _undo_rate_limit(client_ip)
            return {
                "success": False,
                "message": solve_result.get("message", "スケジュールを生成できませんでした"),
            }

        # Map int indices to "demo_N" IDs for display
        if isinstance(solve_result.get("schedule"), list):
            for row in solve_result["schedule"]:
                if row.get("day_shift") is not None:
                    try:
                        idx = int(row["day_shift"])
                        row["day_shift"] = f"demo_{idx}"
                    except Exception:
                        pass
                if row.get("night_shift") is not None:
                    try:
                        idx = int(row["night_shift"])
                        row["night_shift"] = f"demo_{idx}"
                    except Exception:
                        pass

        if isinstance(solve_result.get("scores"), dict):
            new_scores: Dict[str, float] = {}
            for k, v in solve_result["scores"].items():
                try:
                    new_scores[f"demo_{int(k)}"] = v
                except Exception:
                    new_scores[str(k)] = v
            solve_result["scores"] = new_scores

        return solve_result

    except HTTPException:
        raise
    except Exception as e:
        _undo_rate_limit(client_ip)
        raise HTTPException(status_code=500, detail=str(e))
