# backend/main.py
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import get_settings
from routers import health, optimize, schedule, doctor


settings = get_settings()

app = FastAPI(title=settings.project_name)

# --- 🚀 修正箇所：CORS（通信許可）設定の強化 ---
# 1. ローカル開発用のURL（念のため明記）
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# 2. 既存の設定 (config.py) に書かれているURLを追加
if hasattr(settings, "backend_cors_origins") and settings.backend_cors_origins:
    origins.extend(settings.backend_cors_origins)

# 3. デプロイ先の環境変数（FRONTEND_URL）に設定したVercelの本番URLを追加
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    origins.append(frontend_url.strip("/")) # 末尾の/があるとCORSエラーになるため除去

# 重複リストを整理
origins = list(set(origins))

# CORS 設定の適用
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ---------------------------------------------

# ルーターを登録
app.include_router(health.router)
app.include_router(optimize.router)
app.include_router(schedule.router)
app.include_router(doctor.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "oncall backend"}