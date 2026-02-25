# backend/routers/optimize.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
from services.optimizer import OnCallOptimizer

router = APIRouter(prefix="/api/optimize", tags=["Optimize"])

# 1. Next.js から送られてくるリクエストの形（スキーマ）
class OptimizeRequest(BaseModel):
    year: int
    month: int
    num_doctors: int
    holidays: List[int] = []
    # 辞書のキーはJSONの仕様上文字列になるため、Dict[str, List[int]] で受け取る
    unavailable: Dict[str, List[int]] = {}

# 2. シフト生成のエンドポイント
@router.post("/")
async def generate_schedule(req: OptimizeRequest):
    try:
        # 文字列のキー("0", "1")を整数(0, 1)に変換
        formatted_unavailable = {int(k): v for k, v in req.unavailable.items()}

        # オプティマイザーを起動！
        optimizer = OnCallOptimizer(
            num_doctors=req.num_doctors,
            year=req.year,
            month=req.month,
            holidays=req.holidays,
            unavailable=formatted_unavailable
        )
        
        optimizer.build_model()
        result = optimizer.solve()

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])
            
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))