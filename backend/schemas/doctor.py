from __future__ import annotations

from datetime import date
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class UnavailableDayBase(BaseModel):
    date: Optional[date] = None
    day_of_week: Optional[int] = None
    is_fixed: bool

    # ★追加
    target_shift: str = "all"
    is_soft_penalty: bool = False
    

class UnavailableDayCreate(UnavailableDayBase):
    doctor_id: UUID


class UnavailableDayRead(UnavailableDayBase):
    id: UUID
    doctor_id: UUID
    model_config = ConfigDict(from_attributes=True)


class DoctorBase(BaseModel):
    name: str
    experience_years: int = 0   # ★必須→デフォルト0に変更
    is_active: bool = True

    min_score: Optional[float] = None
    max_score: Optional[float] = None
    target_score: Optional[float] = None


class DoctorCreate(DoctorBase):
    pass


class DoctorUpdate(BaseModel):
    name: Optional[str] = None
    experience_years: Optional[int] = None
    is_active: Optional[bool] = None

    min_score: Optional[float] = None
    max_score: Optional[float] = None
    target_score: Optional[float] = None

    # ★追加：管理者がロック状態を変更できる
    is_locked: Optional[bool] = None

    unavailable_dates: Optional[List[date]] = None
    fixed_weekdays: Optional[List[int]] = None


class PublicDoctorUpdate(BaseModel):
    unavailable_dates: Optional[List[date]] = None
    fixed_weekdays: Optional[List[int]] = None


class DoctorRead(DoctorBase):
    id: UUID
    access_token: str

    # ★追加：レスポンスに is_locked を含める
    is_locked: bool

    unavailable_days: List[UnavailableDayRead] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)