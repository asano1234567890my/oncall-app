# backend/schemas/optimize.py
from datetime import date
from typing import Any, Dict, List, Optional, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ObjectiveWeights(BaseModel):
    """目的関数の重み設定（ソフト制約の強さ）"""
    model_config = ConfigDict(extra="ignore")

    # OR-Tools制約のため、floatではなくintで定義します
    gap5: int = Field(100, description="勤務後5日目の勤務回避")
    gap6: int = Field(50, description="勤務後6日目の勤務回避")
    sat_consec: int = Field(80, description="2ヶ月連続の土曜当直回避")
    score_balance: int = Field(30, description="過去スコアを含めた公平性")
    target: int = Field(10, description="個別ターゲットスコアへの近似")
    sunhol_3rd: int = Field(80, description="日祝勤務3回目へのペナルティ")
    soft_unavailable: int = Field(100, description="ソフト不可日の回避")

    # 既存の重み（後方互換性のため残す）
    month_fairness: int = Field(100)
    past_sat_gap: int = Field(10)
    past_sunhol_gap: int = Field(5)


class LockedShift(BaseModel):
    date: Union[date, str]
    shift_type: str
    doctor_id: UUID


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

    # --- ここから統合版仕様による追加フィールド ---

    # 医師ごとのスコア・目標設定（strキーで受ける）
    min_score_by_doctor: Dict[str, float] = Field(default_factory=dict)
    max_score_by_doctor: Dict[str, float] = Field(default_factory=dict)
    target_score_by_doctor: Dict[str, float] = Field(default_factory=dict)
    past_total_scores: Dict[str, float] = Field(default_factory=dict, description="過去数ヶ月の累計スコア")

    # 前月土曜当直フラグ (strキー)
    sat_prev: Dict[str, bool] = Field(default_factory=dict)

    # 目的関数重み（辞書からPydanticモデルに変更し、デフォルト値を定義）
    objective_weights: ObjectiveWeights = Field(default_factory=ObjectiveWeights)

    # 一部ロック済み勤務（routerで doctor_id(UUID) -> doctor_idx(int) へ変換）
    locked_shifts: List[LockedShift] = Field(default_factory=list)

    # TODO: 固定枠/禁止組合せ/優先枠など（仕様の任意枠組み）


class OptimizeResponse(BaseModel):
    success: bool
    status: Optional[str] = None
    message: Optional[str] = None
    schedule: Optional[List[Dict[str, Any]]] = None
    scores: Optional[Dict[str, float]] = None