from collections.abc import AsyncIterator
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from .config import get_settings


def _build_engine_kwargs(database_url: str) -> tuple[str, dict]:
    """asyncpg非対応のクエリパラメータを除去し、connect_argsに変換する。"""
    if database_url.startswith("postgres://"):
        database_url = "postgresql+asyncpg://" + database_url[len("postgres://"):]
    elif database_url.startswith("postgresql://") and "+asyncpg" not in database_url:
        database_url = "postgresql+asyncpg://" + database_url[len("postgresql://"):]

    parsed = urlparse(database_url)
    params = parse_qs(parsed.query, keep_blank_values=True)
    ssl_needed = params.pop("sslmode", [""])[0] in ("require", "verify-ca", "verify-full")
    params.pop("channel_binding", None)
    new_query = urlencode({k: v[0] for k, v in params.items()})
    clean_url = urlunparse(parsed._replace(query=new_query))
    connect_args: dict = {"ssl": True} if ssl_needed else {}
    return clean_url, connect_args


settings = get_settings()
_db_url, _connect_args = _build_engine_kwargs(settings.database_url)

engine = create_async_engine(
    _db_url,
    echo=False,
    future=True,
    connect_args=_connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


class Base(DeclarativeBase):
    """Base class for SQLAlchemy ORM models."""

    pass


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency that provides a database session."""

    async with AsyncSessionLocal() as session:
        yield session

