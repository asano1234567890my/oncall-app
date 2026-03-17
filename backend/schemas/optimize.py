from datetime import date
from typing import Any, Dict, List, Optional, Union
from uuid import UUID

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator


class ObjectiveWeights(BaseModel):
    model_config = ConfigDict(extra="ignore")

    gap5: int = Field(100)
    gap6: int = Field(50)
    sat_consec: int = Field(80)
    score_balance: int = Field(30)
    target: int = Field(10)
    sunhol_fairness: int = Field(200)
    sunhol_3rd: int = Field(80)
    weekend_hol_3rd: int = Field(0)
    soft_unavailable: int = Field(100)

    month_fairness: int = Field(100)
    past_sat_gap: int = Field(10)
    past_sunhol_gap: int = Field(5)


class LockedShift(BaseModel):
    date: Union[date, str]
    shift_type: str
    doctor_id: UUID


class ShiftAssignmentPayload(BaseModel):
    date: Union[date, str]
    shift_type: str
    doctor_id: UUID


class OptimizeUnavailableEntry(BaseModel):
    date: Union[date, str, int]
    target_shift: Union[str, int] = "all"
    is_soft_penalty: bool = False


class OptimizeFixedWeekdayEntry(BaseModel):
    day_of_week: int = Field(validation_alias=AliasChoices("day_of_week", "weekday"))
    target_shift: Union[str, int] = "all"
    is_soft_penalty: bool = False


class HardConstraints(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    interval_days: Optional[int] = None
    max_shifts: Optional[int] = None
    max_saturday_nights: int = Field(default=1)
    max_sunhol_days: int = Field(default=2)
    max_sunhol_works: int = Field(default=3)
    prevent_sunhol_consecutive: bool = Field(default=True)
    respect_unavailable_days: bool = Field(default=True)
    strict_weekend_hol_max: bool = Field(default=False)
    max_weekend_holiday_works: Optional[int] = Field(default=None, alias="weekend_hol_max_count")
    holiday_shift_mode: str = Field(default="split")  # "split" or "combined"


class OptimizeRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    year: int
    month: int
    num_doctors: int

    holidays: List[int] = Field(default_factory=list)
    unavailable: Dict[str, List[Union[int, OptimizeUnavailableEntry]]] = Field(default_factory=dict)
    fixed_unavailable_weekdays: Dict[str, List[Union[int, OptimizeFixedWeekdayEntry]]] = Field(default_factory=dict)

    prev_month_worked_days: Dict[str, List[int]] = Field(default_factory=dict)
    prev_month_last_day: Optional[int] = None
    previous_month_shifts: Optional[List[ShiftAssignmentPayload]] = None

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
    hard_constraints: Dict[str, Any] = Field(default_factory=dict)
    locked_shifts: List[LockedShift] = Field(default_factory=list)

    @field_validator("past_sat_counts", "past_sunhol_counts", mode="before")
    @classmethod
    def normalize_optional_count_lists(cls, value: Any) -> Any:
        if value is None:
            return []
        return value

    @field_validator("sat_prev", "prev_month_worked_days", mode="before")
    @classmethod
    def normalize_optional_dict_fields(cls, value: Any) -> Any:
        if value is None:
            return {}
        return value

    @field_validator("hard_constraints", mode="before")
    @classmethod
    def validate_hard_constraints(cls, value: Any) -> Dict[str, Any]:
        if value is None:
            return {}
        if isinstance(value, dict) and not value:
            return {}

        constraints = HardConstraints.model_validate(value)
        return constraints.model_dump(exclude_unset=True)


class OptimizeResponse(BaseModel):
    success: bool
    status: Optional[str] = None
    message: Optional[str] = None
    schedule: Optional[List[Dict[str, Any]]] = None
    scores: Optional[Dict[str, float]] = None
