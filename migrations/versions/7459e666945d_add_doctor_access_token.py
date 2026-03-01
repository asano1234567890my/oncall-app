"""add doctor access_token

Revision ID: 7459e666945d
Revises: e617c9afe632
Create Date: 2026-03-02 01:32:49.513859

"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7459e666945d'
down_revision: Union[str, Sequence[str], None] = 'e617c9afe632'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1) まず NULL 許可で列追加（既存行があるため）
    op.add_column('doctors', sa.Column('access_token', sa.String(length=64), nullable=True))

    # 2) 既存 Doctor 行の access_token を埋める
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id FROM doctors")).fetchall()
    for (doctor_id,) in rows:
        bind.execute(
            sa.text("UPDATE doctors SET access_token = :t WHERE id = :id"),
            {"t": uuid.uuid4().hex, "id": doctor_id},
        )

    # 3) NOT NULL 化
    op.alter_column('doctors', 'access_token', nullable=False)

    # 4) UNIQUE + INDEX 作成（autogenerateが作った名前を踏襲）
    op.create_index(op.f('ix_doctors_access_token'), 'doctors', ['access_token'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_doctors_access_token'), table_name='doctors')
    op.drop_column('doctors', 'access_token')