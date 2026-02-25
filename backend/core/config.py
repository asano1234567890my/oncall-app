import os
from functools import lru_cache
from typing import List
from pydantic import BaseModel
from dotenv import load_dotenv

# 👇 これが超重要！ .env ファイルを探して読み込む魔法の呪文です
load_dotenv()

class Settings(BaseModel):
    """Application configuration settings."""

    project_name: str = "Oncall Scheduling API"

    backend_cors_origins: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # 👇 直貼りではなく、.env（環境変数）から安全に読み込む形に戻す！
    database_url: str = os.getenv("DATABASE_URL", "")

@lru_cache
def get_settings() -> Settings:
    """Return cached application settings."""
    return Settings()

settings = Settings()