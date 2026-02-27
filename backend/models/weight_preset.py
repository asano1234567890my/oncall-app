from __future__ import annotations

import uuid

from sqlalchemy import Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.db import Base


class WeightPreset(Base):
    __tablename__ = "weight_presets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)

    gap5: Mapped[int] = mapped_column(Integer, nullable=False)
    gap6: Mapped[int] = mapped_column(Integer, nullable=False)
    pre_clinic: Mapped[int] = mapped_column(Integer, nullable=False)
    sat_consec: Mapped[int] = mapped_column(Integer, nullable=False)
    score_balance: Mapped[int] = mapped_column(Integer, nullable=False)
    target: Mapped[int] = mapped_column(Integer, nullable=False)
    sunhol_3rd: Mapped[int] = mapped_column(Integer, nullable=False)