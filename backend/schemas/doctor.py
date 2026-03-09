from __future__ import annotations

from datetime import date
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    model_validator,
)


TargetShift = Literal["all", "day", "night"]


class UnavailableDayBase(BaseModel):
    date: Optional[date] = None
    day_of_week: Optional[int] = None
    is_fixed: bool
    target_shift: TargetShift = "all"
    is_soft_penalty: bool = False


class UnavailableDayCreate(UnavailableDayBase):
    doctor_id: UUID


class UnavailableDayRead(UnavailableDayBase):
    id: UUID
    doctor_id: UUID
    model_config = ConfigDict(from_attributes=True)


class UnavailableDayUpdatePayload(BaseModel):
    date: date
    target_shift: TargetShift = "all"
    is_soft_penalty: bool = False


class FixedWeekdayUpdatePayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    weekday: int = Field(
        ...,
        ge=0,
        le=7,
        validation_alias=AliasChoices("weekday", "day_of_week"),
    )
    target_shift: TargetShift = "all"

    @model_validator(mode="before")
    @classmethod
    def coerce_legacy_int(cls, value):
        if isinstance(value, int):
            return {"weekday": value}
        return value


class DoctorBase(BaseModel):
    name: str
    experience_years: int = 0
    is_active: bool = True

    min_score: Optional[float] = None
    max_score: Optional[float] = None
    target_score: Optional[float] = None


class DoctorCreate(DoctorBase):
    pass


class DoctorUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: Optional[str] = None
    experience_years: Optional[int] = None
    is_active: Optional[bool] = None

    min_score: Optional[float] = None
    max_score: Optional[float] = None
    target_score: Optional[float] = None
    is_locked: Optional[bool] = None

    unavailable_dates: Optional[List[date]] = None
    unavailable_days: Optional[List[UnavailableDayUpdatePayload]] = None
    fixed_weekdays: Optional[List[FixedWeekdayUpdatePayload]] = None
    unavailable_year: Optional[int] = None
    unavailable_month: Optional[int] = None


class PublicDoctorUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    unavailable_dates: Optional[List[date]] = None
    unavailable_days: Optional[List[UnavailableDayUpdatePayload]] = None
    fixed_weekdays: Optional[List[FixedWeekdayUpdatePayload]] = None
    unavailable_year: Optional[int] = None
    unavailable_month: Optional[int] = None


class DoctorRead(DoctorBase):
    id: UUID
    access_token: str
    is_locked: bool
    unavailable_days: List[UnavailableDayRead] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)