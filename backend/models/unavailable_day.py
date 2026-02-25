from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.db import Base


class UnavailableDay(Base):
    __tablename__ = "unavailable_days"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("doctors.id", ondelete="CASCADE"),
        nullable=False,
    )
    # 特定日不可の場合の具体的な日付（固定曜日のみの場合はNULL)
    date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # 0=月曜〜6=日曜。単発不可日の場合はNULL
    day_of_week: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # True: 毎週固定不可, False: 単発不可
    is_fixed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    doctor: Mapped["Doctor"] = relationship(back_populates="unavailable_days")

