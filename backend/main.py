# backend/main.py
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from core.config import get_settings
from routers import health, optimize, schedule, doctor, public_doctor
from routers import auth as auth_router
import routers.holiday as holiday
import routers.demo as demo_router
import routers.settings as settings_router
import routers.import_image as import_image_router
import routers.shared_entry as shared_entry_router

settings = get_settings()

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title=settings.project_name)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

if hasattr(settings, "backend_cors_origins") and settings.backend_cors_origins:
    origins.extend(settings.backend_cors_origins)

frontend_url = os.getenv("FRONTEND_URL")
if frontend_url == "*":
    origins = ["*"]
elif frontend_url:
    origins.append(frontend_url.strip("/"))

origins = list(set(origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth_router.router)
app.include_router(optimize.router)
app.include_router(schedule.router)
app.include_router(doctor.router)
app.include_router(public_doctor.router)
app.include_router(holiday.router)
app.include_router(settings_router.router)
app.include_router(demo_router.router)
app.include_router(import_image_router.router)
app.include_router(shared_entry_router.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "oncall backend"}
