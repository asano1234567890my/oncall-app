from __future__ import annotations

from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class UnavailableDayBase(BaseModel):
    date: date | None = None
    day_of_week: int | None = None  # 0=月曜〜6=日曜
    is_fixed: bool


class UnavailableDayCreate(UnavailableDayBase):
    doctor_id: UUID


class UnavailableDayRead(UnavailableDayBase):
    id: UUID
    doctor_id: UUID

    model_config = ConfigDict(from_attributes=True)

