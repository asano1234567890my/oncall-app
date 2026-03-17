"""add hospitals multitenant

Revision ID: a1b2c3d4e5f6
Revises: 9d91c9b3e2f7
Create Date: 2026-03-17 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "9d91c9b3e2f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# 既存データをこの病院に割り当てる
EBINA_HOSPITAL_ID = "a0000000-0000-4000-8000-000000000001"
# 初期パスワード: EbinaHospital2024!
EBINA_HOSPITAL_HASH = "$2b$12$hk7Cgnnt78ll1L15mzG2m.uyoaTEjhBp3a6aLQ3qXJnvg5yvRE4pm"


def upgrade() -> None:
    # 1. hospitals テーブル作成
    op.create_table(
        "hospitals",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("password_hash", sa.String(length=200), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    # 2. Ebina Hospital を挿入
    op.execute(
        f"""
        INSERT INTO hospitals (id, name, password_hash)
        VALUES (
            '{EBINA_HOSPITAL_ID}',
            'Ebina Hospital',
            '{EBINA_HOSPITAL_HASH}'
        )
        """
    )

    # 3. doctors に hospital_id カラム追加（nullable）
    op.add_column(
        "doctors",
        sa.Column("hospital_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    # 4. 既存の doctors を Ebina Hospital に割り当て
    op.execute(
        f"UPDATE doctors SET hospital_id = '{EBINA_HOSPITAL_ID}'"
    )

    # 5. hospital_id を NOT NULL に変更
    op.alter_column("doctors", "hospital_id", nullable=False)

    # 6. doctors に FK 制約とインデックス追加
    op.create_foreign_key(
        "fk_doctors_hospital_id",
        "doctors",
        "hospitals",
        ["hospital_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_doctors_hospital_id", "doctors", ["hospital_id"])

    # 7. system_settings に hospital_id カラム追加（nullable）
    op.add_column(
        "system_settings",
        sa.Column("hospital_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    # 8. 既存の system_settings を Ebina Hospital に割り当て
    op.execute(
        f"UPDATE system_settings SET hospital_id = '{EBINA_HOSPITAL_ID}'"
    )

    # 9. hospital_id を NOT NULL に変更
    op.alter_column("system_settings", "hospital_id", nullable=False)

    # 10. system_settings に FK 制約追加
    op.create_foreign_key(
        "fk_system_settings_hospital_id",
        "system_settings",
        "hospitals",
        ["hospital_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_system_settings_hospital_id", "system_settings", ["hospital_id"])

    # 11. 旧 unique 制約（key のみ）を削除して複合 unique に変更
    op.drop_constraint("system_settings_key_key", "system_settings", type_="unique")
    op.create_unique_constraint(
        "uq_system_settings_hospital_key",
        "system_settings",
        ["hospital_id", "key"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_system_settings_hospital_key", "system_settings", type_="unique")
    op.create_unique_constraint("system_settings_key_key", "system_settings", ["key"])
    op.drop_index("ix_system_settings_hospital_id", table_name="system_settings")
    op.drop_constraint("fk_system_settings_hospital_id", "system_settings", type_="foreignkey")
    op.drop_column("system_settings", "hospital_id")

    op.drop_index("ix_doctors_hospital_id", table_name="doctors")
    op.drop_constraint("fk_doctors_hospital_id", "doctors", type_="foreignkey")
    op.drop_column("doctors", "hospital_id")

    op.drop_table("hospitals")
