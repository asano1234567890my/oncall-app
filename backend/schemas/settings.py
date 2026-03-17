from __future__ import annotations

from typing import Any, Dict, List
from pydantic import BaseModel, Field


class CustomHolidaysValue(BaseModel):
    manual_holidays: List[str] = Field(default_factory=list)   # "YYYY-MM-DD"
    ignored_holidays: List[str] = Field(default_factory=list)  # "YYYY-MM-DD"


class CustomHolidaysUpsertRequest(BaseModel):
    year: int
    manual_holidays: List[str] = Field(default_factory=list)
    ignored_holidays: List[str] = Field(default_factory=list)


class CustomHolidaysResponse(BaseModel):
    year: int
    key: str
    value: CustomHolidaysValue


class OptimizerConfigRequest(BaseModel):
    score_min: float = 0.5
    score_max: float = 4.5
    objective_weights: Dict[str, Any] = Field(default_factory=dict)
    hard_constraints: Dict[str, Any] = Field(default_factory=dict)