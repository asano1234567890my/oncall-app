from __future__ import annotations

import asyncio
import os
import sys
from logging.config import fileConfig
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

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
def _normalize_asyncpg_url(url: str) -> tuple[str, bool]:
    """URLを asyncpg 対応形式に変換し、SSL必要かどうかも返す。"""
    if url.startswith("postgres://"):
        url = "postgresql+asyncpg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://") and "+asyncpg" not in url:
        url = "postgresql+asyncpg://" + url[len("postgresql://"):]

    # asyncpg が解釈できないパラメータを除去し、SSL要否を検出する
    parsed = urlparse(url)
    params = parse_qs(parsed.query, keep_blank_values=True)
    ssl_needed = params.pop("sslmode", [""])[0] in ("require", "verify-ca", "verify-full")
    params.pop("channel_binding", None)
    new_query = urlencode({k: v[0] for k, v in params.items()})
    return urlunparse(parsed._replace(query=new_query)), ssl_needed


def load_database_url() -> tuple[str, bool]:
    # 1) まず環境変数を優先
    url = os.getenv("DATABASE_URL")
    if url:
        normalized, ssl = _normalize_asyncpg_url(url)
        return normalized, ssl

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


database_url, _ssl_required = load_database_url()
config.set_main_option("sqlalchemy.url", database_url)

# ------------------------------------------------------------
# Base.metadata を target_metadata にセット
# （autogenerateのためにモデルを import）
# ------------------------------------------------------------
from core.db import Base  # noqa: E402

# テーブル定義を確実に登録するため、モデルを明示 import
import models.hospital  # noqa: F401,E402
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
    connect_args: dict = {"ssl": True} if _ssl_required else {}
    connectable: AsyncEngine = create_async_engine(
        database_url,
        poolclass=pool.NullPool,
        future=True,
        connect_args=connect_args,
    )

    async with connectable.connect() as async_conn:
        await async_conn.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())