from functools import lru_cache
import os
from typing import List

from pydantic import BaseModel


class Settings(BaseModel):
    """Application configuration settings."""

    project_name: str = "Oncall Scheduling API"

    # Next.js フロントエンドなど、CORS で許可するオリジン
    backend_cors_origins: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # 今後、実際の接続情報を .env / 環境変数で上書きする想定
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://user:password@localhost:5432/oncall_db",
    )


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings."""

    return Settings()

