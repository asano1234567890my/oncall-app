from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from sqlalchemy import Date, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.db import Base


class HospitalCalendar(Base):
    __tablename__ = "hospital_calendar"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    date: Mapped[date] = mapped_column(Date, nullable=False, unique=True)
    # "平日" / "土曜" / "日祝" / "特別日" など
    day_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # 例: {"平日当直": 1} や {"日祝日直": 1, "日祝当直": 1}
    required_shifts: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)

