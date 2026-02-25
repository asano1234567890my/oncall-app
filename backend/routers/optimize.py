# backend/routers/optimize.py
from fastapi import APIRouter, HTTPException

from services.optimizer import OnCallOptimizer
from schemas.optimize import OptimizeRequest, OptimizeResponse

router = APIRouter(prefix="/api/optimize", tags=["Optimize"])


@router.post("/", response_model=OptimizeResponse)
async def generate_schedule(req: OptimizeRequest):
    try:
        # "0","1" などのキーを int に変換
        formatted_unavailable = {int(k): v for k, v in req.unavailable.items()}
        formatted_fixed_weekdays = {int(k): v for k, v in req.fixed_unavailable_weekdays.items()}
        formatted_prev_month = {int(k): v for k, v in req.prev_month_worked_days.items()}

        optimizer = OnCallOptimizer(
            num_doctors=req.num_doctors,
            year=req.year,
            month=req.month,
            holidays=req.holidays,
            unavailable=formatted_unavailable,
            fixed_unavailable_weekdays=formatted_fixed_weekdays,
            prev_month_worked_days=formatted_prev_month,
            prev_month_last_day=req.prev_month_last_day,
            score_min=req.score_min,
            score_max=req.score_max,
            past_sat_counts=req.past_sat_counts,
            past_sunhol_counts=req.past_sunhol_counts,
            objective_weights=req.objective_weights,
        )

        optimizer.build_model()
        result = optimizer.solve()

        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("message", "最適化に失敗しました"))

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))