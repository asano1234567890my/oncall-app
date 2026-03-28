"""add email column to hospitals

Revision ID: d17de90b0197
Revises: 27efd28f6bd1
Create Date: 2026-03-28 11:54:37.155393

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd17de90b0197'
down_revision: Union[str, Sequence[str], None] = '27efd28f6bd1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('hospitals', sa.Column('email', sa.String(300), nullable=True))
    op.create_unique_constraint('uq_hospitals_email', 'hospitals', ['email'])


def downgrade() -> None:
    op.drop_constraint('uq_hospitals_email', 'hospitals', type_='unique')
    op.drop_column('hospitals', 'email')
