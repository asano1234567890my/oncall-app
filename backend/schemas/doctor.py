from __future__ import annotations

from datetime import date
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class UnavailableDayBase(BaseModel):
    # 1日単位の不可日（任意）
    date: Optional[date] = None

    # 固定不可曜日（任意）: 0=月曜〜6=日曜
    # ※ `int | None` だと環境によってPydanticが評価で落ちることがあるので Optional[int] に統一
    day_of_week: Optional[int] = None

    # 固定設定かどうか（必須）
    is_fixed: bool


class UnavailableDayCreate(UnavailableDayBase):
    doctor_id: UUID


class UnavailableDayRead(UnavailableDayBase):
    id: UUID
    doctor_id: UUID

    model_config = ConfigDict(from_attributes=True)


class DoctorBase(BaseModel):
    name: str
    experience_years: int
    is_active: bool = True


class DoctorCreate(DoctorBase):
    pass


class DoctorRead(DoctorBase):
    id: UUID
    unavailable_days: List[UnavailableDayRead] = []

    model_config = ConfigDict(from_attributes=True)