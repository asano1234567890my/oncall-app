"""ensure unavailable_days has shift target columns

Revision ID: 9d91c9b3e2f7
Revises: c3cddc2718ad
Create Date: 2026-03-10 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9d91c9b3e2f7"
down_revision: Union[str, Sequence[str], None] = "c3cddc2718ad"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    columns = _column_names("unavailable_days")

    if "target_shift" not in columns:
        op.add_column(
            "unavailable_days",
            sa.Column(
                "target_shift",
                sa.String(length=20),
                nullable=False,
                server_default=sa.text("'all'"),
            ),
        )
        op.alter_column("unavailable_days", "target_shift", server_default=None)

    if "is_soft_penalty" not in columns:
        op.add_column(
            "unavailable_days",
            sa.Column(
                "is_soft_penalty",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
        )
        op.alter_column(
            "unavailable_days",
            "is_soft_penalty",
            server_default=None,
        )


def downgrade() -> None:
    columns = _column_names("unavailable_days")

    if "is_soft_penalty" in columns:
        op.drop_column("unavailable_days", "is_soft_penalty")

    if "target_shift" in columns:
        op.drop_column("unavailable_days", "target_shift")