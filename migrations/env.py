from __future__ import annotations

import asyncio
import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncEngine, async_engine_from_config

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ------------------------------------------------------------
# Path: import 起点を backend/ にする
# migrations/env.py の場所: oncall-app/migrations/env.py
# ------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parents[1]   # oncall-app
BACKEND_DIR = PROJECT_ROOT / "backend"              # oncall-app/backend
sys.path.insert(0, str(BACKEND_DIR))

# ------------------------------------------------------------
# backend/.env から DATABASE_URL を読む
# ------------------------------------------------------------
def _normalize_asyncpg_url(url: str) -> str:
    if url.startswith("postgres://"):
        return "postgresql+asyncpg://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + url[len("postgresql://") :]
    return url


def load_database_url() -> str:
    # 1) まず環境変数を優先
    url = os.getenv("DATABASE_URL")
    if url:
        return _normalize_asyncpg_url(url)

    # 2) backend/.env を読む
    try:
        from dotenv import load_dotenv  # type: ignore
    except Exception as e:
        raise RuntimeError(
            "python-dotenv が入っていません。次を実行してください:\n"
            "  python -m pip install python-dotenv"
        ) from e

    env_path = BACKEND_DIR / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path, override=False)

    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "DATABASE_URL が見つかりません。backend/.env に DATABASE_URL=... を設定してください。"
        )

    return _normalize_asyncpg_url(url)


database_url = load_database_url()
config.set_main_option("sqlalchemy.url", database_url)

# ------------------------------------------------------------
# Base.metadata を target_metadata にセット
# （autogenerateのためにモデルを import）
# ------------------------------------------------------------
from core.db import Base  # noqa: E402

# テーブル定義を確実に登録するため、モデルを明示 import
import models.doctor  # noqa: F401,E402
import models.shift  # noqa: F401,E402
import models.weight_preset  # noqa: F401,E402 

target_metadata = Base.metadata

# ------------------------------------------------------------
# Migrations
# ------------------------------------------------------------
def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable: AsyncEngine = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        future=True,
    )

    async with connectable.connect() as async_conn:
        await async_conn.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())