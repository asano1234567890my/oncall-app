from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import get_settings
from routers import health


settings = get_settings()

app = FastAPI(title=settings.project_name)

# CORS 設定: Next.js (localhost:3000) からのアクセスを許可
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ルーターを登録
app.include_router(health.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "oncall backend"}

