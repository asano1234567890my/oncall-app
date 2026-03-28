"""add is_superadmin, created_at, last_login_at to hospitals + usage_events table

Revision ID: b3f1a2c4d5e6
Revises: d17de90b0197
Create Date: 2026-03-28
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "b3f1a2c4d5e6"
down_revision = "d17de90b0197"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- hospitals: is_superadmin ---
    op.add_column(
        "hospitals",
        sa.Column("is_superadmin", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.alter_column("hospitals", "is_superadmin", server_default=None)

    # --- hospitals: created_at ---
    op.add_column(
        "hospitals",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.alter_column("hospitals", "created_at", server_default=None)

    # --- hospitals: last_login_at ---
    op.add_column(
        "hospitals",
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )

    # --- usage_events table ---
    op.create_table(
        "usage_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("hospital_id", sa.UUID(), nullable=False),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("metadata", JSONB, nullable=True),
        sa.ForeignKeyConstraint(
            ["hospital_id"], ["hospitals.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_usage_events_hospital_type_date",
        "usage_events",
        ["hospital_id", "event_type", "created_at"],
    )
    op.create_index(
        "ix_usage_events_created_at",
        "usage_events",
        ["created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_usage_events_created_at", table_name="usage_events")
    op.drop_index("ix_usage_events_hospital_type_date", table_name="usage_events")
    op.drop_table("usage_events")
    op.drop_column("hospitals", "last_login_at")
    op.drop_column("hospitals", "created_at")
    op.drop_column("hospitals", "is_superadmin")
