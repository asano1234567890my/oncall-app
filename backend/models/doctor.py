from __future__ import annotations

import uuid

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.db import Base


class Doctor(Base):
    __tablename__ = "doctors"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    experience_years: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    unavailable_days: Mapped[list["UnavailableDay"]] = relationship(
        back_populates="doctor",
        cascade="all, delete-orphan",
    )

    # ★追加: Doctor削除時に紐づくShiftAssignmentも連鎖削除
    shift_assignments: Mapped[list["ShiftAssignment"]] = relationship(
        back_populates="doctor",
        cascade="all, delete-orphan",
        passive_deletes=True,  # ★DB側 ondelete="CASCADE" と併用（FK違反を防ぎやすい）
    )