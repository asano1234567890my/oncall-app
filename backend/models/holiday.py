from __future__ import annotations

import uuid
from sqlalchemy import Date, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.db import Base


class Holiday(Base):
    __tablename__ = "holidays"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    date: Mapped[object] = mapped_column(
        Date,
        unique=True,
        index=True,
        nullable=False,
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="",
    )