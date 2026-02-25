from __future__ import annotations

from datetime import date
from typing import Any, Dict
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class HospitalCalendarBase(BaseModel):
    date: date
    day_type: str  # "平日" / "土曜" / "日祝" / "特別日" など
    required_shifts: Dict[str, Any]


class HospitalCalendarCreate(HospitalCalendarBase):
    pass


class HospitalCalendarRead(HospitalCalendarBase):
    id: UUID

    model_config = ConfigDict(from_attributes=True)

