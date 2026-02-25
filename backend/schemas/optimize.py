# backend/schemas/optimize.py
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any


class OptimizeRequest(BaseModel):
    year: int
    month: int
    num_doctors: int

    holidays: List[int] = Field(default_factory=list)

    # JSON上キーが文字列になりがちなので str で受ける（routerでintに変換）
    unavailable: Dict[str, List[int]] = Field(default_factory=dict)

    # 固定不可曜日（毎週固定） doctor_id -> [weekday 0=Mon..6=Sun]
    fixed_unavailable_weekdays: Dict[str, List[int]] = Field(default_factory=dict)

    # 月跨ぎ4日間隔
    prev_month_worked_days: Dict[str, List[int]] = Field(default_factory=dict)
    prev_month_last_day: Optional[int] = None

    # 月間スコア上下限（floatで受ける。optimizer内部で*10して整数化）
    score_min: float = 0.5
    score_max: float = 4.5

    # 過去補正（医師数分。未指定なら0扱い）
    past_sat_counts: List[int] = Field(default_factory=list)
    past_sunhol_counts: List[int] = Field(default_factory=list)

    # 目的関数重み（仕様例 100/10/5）
    objective_weights: Dict[str, int] = Field(default_factory=lambda: {
        "month_fairness": 100,
        "past_sat_gap": 10,
        "past_sunhol_gap": 5,
    })

    # TODO: 固定枠/禁止組合せ/優先枠など（仕様の任意枠組み）


class OptimizeResponse(BaseModel):
    success: bool
    status: Optional[str] = None
    message: Optional[str] = None
    schedule: Optional[List[Dict[str, Any]]] = None
    scores: Optional[Dict[int, float]] = None