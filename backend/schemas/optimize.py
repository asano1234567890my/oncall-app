from datetime import date
from typing import Any, Dict, List, Optional, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ObjectiveWeights(BaseModel):
    model_config = ConfigDict(extra="ignore")

    gap5: int = Field(100)
    gap6: int = Field(50)
    sat_consec: int = Field(80)
    score_balance: int = Field(30)
    target: int = Field(10)
    sunhol_fairness: int = Field(200)
    sunhol_3rd: int = Field(80)
    soft_unavailable: int = Field(100)

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
    unavailable: Dict[str, List[int]] = Field(default_factory=dict)
    fixed_unavailable_weekdays: Dict[str, List[int]] = Field(default_factory=dict)

    prev_month_worked_days: Dict[str, List[int]] = Field(default_factory=dict)
    prev_month_last_day: Optional[int] = None

    score_min: float = 0.5
    score_max: float = 4.5

    past_sat_counts: List[int] = Field(default_factory=list)
    past_sunhol_counts: List[int] = Field(default_factory=list)

    min_score_by_doctor: Dict[str, float] = Field(default_factory=dict)
    max_score_by_doctor: Dict[str, float] = Field(default_factory=dict)
    target_score_by_doctor: Dict[str, float] = Field(default_factory=dict)
    past_total_scores: Dict[str, float] = Field(default_factory=dict, description="Historical cumulative score")

    sat_prev: Dict[str, bool] = Field(default_factory=dict)
    objective_weights: ObjectiveWeights = Field(default_factory=ObjectiveWeights)
    locked_shifts: List[LockedShift] = Field(default_factory=list)


class OptimizeResponse(BaseModel):
    success: bool
    status: Optional[str] = None
    message: Optional[str] = None
    schedule: Optional[List[Dict[str, Any]]] = None
    scores: Optional[Dict[str, float]] = None