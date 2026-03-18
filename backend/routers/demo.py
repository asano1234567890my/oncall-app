"""
POST /api/demo/optimize — 公開デモ用（認証不要・DB書き込みなし）
"""
from __future__ import annotations

import time
from collections import defaultdict
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

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


class DemoOptimizeRequest(BaseModel):
    num_doctors: int = Field(ge=2, le=15)
    year: int
    month: int
    holidays: List[int] = Field(default_factory=list)
    interval_days: int = Field(default=1, ge=0, le=5)
    max_saturday_nights: int = Field(default=2, ge=0, le=10)
    score_min: float = Field(default=3)
    score_max: float = Field(default=5)
    holiday_shift_mode: Optional[str] = None


@router.post("/optimize")
async def demo_optimize(req: DemoOptimizeRequest, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)

    try:
        hard_constraints: Dict[str, Any] = {
            "interval_days": req.interval_days,
            "max_saturday_nights": req.max_saturday_nights,
        }
        if req.holiday_shift_mode:
            hard_constraints["holiday_shift_mode"] = req.holiday_shift_mode

        optimizer = OnCallOptimizer(
            num_doctors=req.num_doctors,
            year=req.year,
            month=req.month,
            holidays=req.holidays,
            unavailable={},
            fixed_unavailable_weekdays={},
            prev_month_worked_days={},
            prev_month_last_day=0,
            previous_month_shifts=[],
            score_min=req.score_min,
            score_max=req.score_max,
            past_sat_counts={},
            past_sunhol_counts={},
            min_score_by_doctor={},
            max_score_by_doctor={},
            target_score_by_doctor={},
            past_total_scores={},
            sat_prev={},
            objective_weights={},
            hard_constraints=hard_constraints,
            locked_shifts=[],
        )

        optimizer.build_model()
        solve_result = optimizer.solve()

        if not solve_result.get("success"):
            raise HTTPException(
                status_code=400,
                detail=solve_result.get("message", "生成に失敗しました"),
            )

        # Map int indices to "医師N" names for display
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
        raise HTTPException(status_code=500, detail=str(e))
