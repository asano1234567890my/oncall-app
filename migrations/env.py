import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

# --- ここからパスの設定 ---
import sys
import os
# プロジェクトのimport asyncio
import sys
import os
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

# ==========================================
# 1. パスの設定
# ==========================================
# プロジェクトルートから見て 'backend' フォルダをsys.pathの先頭に追加します。
# これにより、以降のインポートはすべて `backend/` 配下を起点として行えます。
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, backend_dir)

# ==========================================
# 2. アプリケーション設定とモデルのインポート
# ==========================================
# backendディレクトリがパスに追加されたため、`backend.` を省略してインポートします。
from core.config import settings
from core.db import Base  # ※ファイル名が core/db.py にあると仮定

# 【重要】Alembicにテーブルを認識させるため、モデルファイルを明示的にインポートします。
# ※ import models だけだと、models/__init__.py が空の場合テーブルを検知できません。
# 例: import models.user, import models.shift など、定義したファイルを並べてください。
import models


config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

async def run_migrations_online() -> None:
    """非同期エンジン用のオンラインマイグレーション実行"""
    
    # ==========================================
    # 3. URL動的セットの修正（落とし穴回避）
    # ==========================================
    # get_section() で取得した辞書に直接URLを書き込まないと、
    # async_engine_from_config に設定が伝搬しない場合があります。
    configuration = config.get_section(config.config_ini_section)
    if configuration is None:
        configuration = {}
        
    # ※厳守事項: settings.database_url は必ず "postgresql+asyncpg://..." から始まること
    configuration["sqlalchemy.url"] = settings.database_url

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
        
    await connectable.dispose()

def run_migrations_offline() -> None:
    """オフラインマイグレーション実行（通常はあまり使いません）"""
    url = settings.database_url
    context.configure(
        url=url, target_metadata=target_metadata, literal_binds=True, dialect_opts={"paramstyle": "named"}
    )
    with context.begin_transaction():
        context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())ルート（oncall-app）をパスに追加して backend を見つけられるようにする
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
# backend フォルダも直接追加（念のため）
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from backend.core.config import settings
from backend.core.db import Base
# モデルを読み込んでテーブル定義をAlembicに認識させる
import backend.models
# --- ここまで ---

config = context.config

# .envから読み込んだNeonのURLをセット
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

async def run_migrations_online() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()

if context.is_offline_mode():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    asyncio.run(run_migrations_online())