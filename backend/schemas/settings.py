from __future__ import annotations

from typing import List
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