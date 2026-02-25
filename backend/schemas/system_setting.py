from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SystemSettingBase(BaseModel):
    key: str
    value: Any
    description: str


class SystemSettingCreate(SystemSettingBase):
    pass


class SystemSettingRead(SystemSettingBase):
    id: UUID

    model_config = ConfigDict(from_attributes=True)

