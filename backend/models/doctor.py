from __future__ import annotations

import uuid

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.db import Base


class Doctor(Base):
    __tablename__ = "doctors"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("hospitals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    experience_years: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # ★マジックリンク用トークン
    access_token: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        index=True,
        nullable=False,
        default=lambda: uuid.uuid4().hex,
    )

    # ★追加：休み希望入力ロック（締め切り）
    is_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # スコア
    min_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    target_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    hospital: Mapped["Hospital"] = relationship(back_populates="doctors")

    unavailable_days: Mapped[list["UnavailableDay"]] = relationship(
        back_populates="doctor",
        cascade="all, delete-orphan",
    )

    # 既に導入済みの想定（前回のCASCADE対応）
    shift_assignments: Mapped[list["ShiftAssignment"]] = relationship(
        back_populates="doctor",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )