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
        
        # --- 統合版仕様：追加パラメータのキーを int に変換 ---
        formatted_min_score = {int(k): v for k, v in req.min_score_by_doctor.items()}
        formatted_max_score = {int(k): v for k, v in req.max_score_by_doctor.items()}
        formatted_target_score = {int(k): v for k, v in req.target_score_by_doctor.items()}
        formatted_past_total_scores = {int(k): v for k, v in req.past_total_scores.items()}
        formatted_sat_prev = {int(k): v for k, v in req.sat_prev.items()}

        # 目的関数の重み（Pydanticモデルから辞書に変換。v1/v2両対応）
        weights_dict = req.objective_weights.model_dump() if hasattr(req.objective_weights, 'model_dump') else req.objective_weights.dict()

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
            # --- 統合版仕様：追加パラメータをOptimizerに渡す ---
            min_score_by_doctor=formatted_min_score,
            max_score_by_doctor=formatted_max_score,
            target_score_by_doctor=formatted_target_score,
            past_total_scores=formatted_past_total_scores,
            sat_prev=formatted_sat_prev,
            objective_weights=weights_dict,
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