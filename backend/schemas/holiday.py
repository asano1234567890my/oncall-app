from __future__ import annotations

from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class HolidayBase(BaseModel):
    date: date
    name: str


class HolidayCreate(HolidayBase):
    pass


class HolidayResponse(HolidayBase):
    id: UUID
    model_config = ConfigDict(from_attributes=True)