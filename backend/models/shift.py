# backend/models/shift.py
from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.db import Base

class ShiftAssignment(Base):
    __tablename__ = "shift_assignments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # どの日付のシフトか
    date: Mapped[date] = mapped_column(Date, nullable=False)
    
    # どの医師のシフトか（Doctorテーブルとの紐付け）
    doctor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("doctors.id"), nullable=False)
    
    # どの種類のシフトか（例: "日直", "当直"）
    shift_type: Mapped[str] = mapped_column(String(20), nullable=False)

    # リレーション（コード上で医師情報を引き出しやすくするため）
    doctor: Mapped["Doctor"] = relationship()