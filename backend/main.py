# backend/main.py
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import get_settings
from routers import health, optimize, schedule, doctor, public_doctor # ★追加
import routers.holiday as holiday
import routers.settings as settings_router

settings = get_settings()

app = FastAPI(title=settings.project_name)

# --- 🚀 修正箇所：CORS（通信許可）設定の強化 ---
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

if hasattr(settings, "backend_cors_origins") and settings.backend_cors_origins:
    origins.extend(settings.backend_cors_origins)

frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    origins.append(frontend_url.strip("/"))

origins = list(set(origins))

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
app.include_router(public_doctor.router)  # ★追加
app.include_router(holiday.router)
app.include_router(settings_router.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "oncall backend"}