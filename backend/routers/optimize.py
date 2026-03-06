from fastapi import APIRouter, HTTPException, Depends
from typing import Any, Dict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.db import get_db
from models.doctor import Doctor
from services.optimizer import OnCallOptimizer
from schemas.optimize import OptimizeRequest, OptimizeResponse

router = APIRouter(prefix="/api/optimize", tags=["Optimize"])


@router.post("/", response_model=OptimizeResponse)
async def generate_schedule(req: OptimizeRequest, db: AsyncSession = Depends(get_db)):
    try:
        # 0) Doctor一覧をDBから取得し、id(UUID)昇順で確定ソート → 双方向マッピング生成
        result = await db.execute(select(Doctor).order_by(Doctor.id))
        doctors = result.scalars().all()

        if len(doctors) < req.num_doctors:
            raise HTTPException(status_code=400, detail="num_doctors exceeds registered doctors")

        doctors = doctors[: req.num_doctors]

        # idx_to_uuid: {0: "<uuid>", ...}
        idx_to_uuid: Dict[int, str] = {i: str(d.id) for i, d in enumerate(doctors)}
        # uuid_to_idx: {"<uuid>": 0, ...}
        uuid_to_idx: Dict[str, int] = {str(d.id): i for i, d in enumerate(doctors)}

        def _key_to_idx(key: Any) -> int:
            k = str(key)

            # "0" 等の数字文字列は index として扱う
            if k.isdigit():
                idx = int(k)
                if 0 <= idx < req.num_doctors:
                    return idx
                raise HTTPException(status_code=400, detail=f"doctor index out of range: {k}")

            # UUID文字列は uuid_to_idx で変換
            if k in uuid_to_idx:
                return uuid_to_idx[k]

            # どちらでもない / 存在しない医師ID
            raise HTTPException(status_code=400, detail=f"unknown doctor key: {k}")

        def _remap_keys(src: Dict[str, Any]) -> Dict[int, Any]:
            out: Dict[int, Any] = {}
            for k, v in src.items():
                out[_key_to_idx(k)] = v
            return out

        # 1) 各辞書キーを正規化（int index 0..N-1 に統一）
        formatted_prev_month = _remap_keys(req.prev_month_worked_days)
        formatted_min_score = _remap_keys(req.min_score_by_doctor)
        formatted_max_score = _remap_keys(req.max_score_by_doctor)
        formatted_target_score = _remap_keys(req.target_score_by_doctor)
        formatted_past_total_scores = _remap_keys(req.past_total_scores)
        formatted_sat_prev = _remap_keys(req.sat_prev)

        # 2) unavailable / fixed_unavailable_weekdays はキー正規化 + 属性付与（ステルス実装）
        # - unavailable: {"date": day, "target_shift": "all", "is_soft_penalty": False}
        # - fixed: {"day_of_week": wd, "target_shift": "all", "is_soft_penalty": False}
        _u = _remap_keys(req.unavailable)  # -> Dict[int, List[int]]
        formatted_unavailable: Dict[int, Any] = {
            idx: [{"date": day, "target_shift": "all", "is_soft_penalty": False} for day in (days or [])]
            for idx, days in _u.items()
        }

        _fw = _remap_keys(req.fixed_unavailable_weekdays)  # -> Dict[int, List[int]]
        formatted_fixed_weekdays: Dict[int, Any] = {
            idx: [{"day_of_week": wd, "target_shift": "all", "is_soft_penalty": False} for wd in (wds or [])]
            for idx, wds in _fw.items()
        }

        # 目的関数の重み（Pydanticモデルから辞書に変換。v1/v2両対応）
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
        )

        optimizer.build_model()
        result = optimizer.solve()

        if not result.get("success"):
            raise HTTPException(
                status_code=400,
                detail=result.get("message", "最適化に失敗しました"),
            )

        # 3) Post-processing: schedule / scores を idx -> UUID に復元
        if isinstance(result.get("schedule"), list):
            for row in result["schedule"]:
                # 既存optimizer仕様: day_shift/night_shift に index(int) が入る想定
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

        if isinstance(result.get("scores"), dict):
            new_scores: Dict[str, Any] = {}
            for k, v in result["scores"].items():
                try:
                    idx = int(k)
                    new_scores[idx_to_uuid.get(idx, str(k))] = v
                except Exception:
                    # すでにUUIDキーなどならそのまま
                    new_scores[str(k)] = v
            result["scores"] = new_scores

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))