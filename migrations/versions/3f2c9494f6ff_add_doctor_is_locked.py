"""add doctor is_locked

Revision ID: 3f2c9494f6ff
Revises: 7459e666945d
Create Date: 2026-03-02 02:16:40.685371

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3f2c9494f6ff'
down_revision: Union[str, Sequence[str], None] = '7459e666945d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 既存doctors行があるため、まず server_default=False を付けて追加して埋める
    op.add_column(
        'doctors',
        sa.Column('is_locked', sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    # DB側にデフォルトを残したくない場合は外す（任意だが、モデル側defaultに寄せるため外す）
    op.alter_column('doctors', 'is_locked', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('doctors', 'is_locked')