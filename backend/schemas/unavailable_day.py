# backend/schemas/unavailable_day.py
from datetime import date
from typing import Optional

from pydantic import BaseModel


class UnavailableDayBase(BaseModel):
    # ✅ Python3.10 + Pydantic で確実に評価できる書き方に統一
    date: Optional[date] = None


class UnavailableDayCreate(UnavailableDayBase):
    doctor_id: int
    year: int
    month: int
    day: int


class UnavailableDayRead(UnavailableDayCreate):
    id: int

    class Config:
        from_attributes = True