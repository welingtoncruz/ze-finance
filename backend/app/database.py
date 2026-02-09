"""
Database configuration and session management for async SQLAlchemy.
"""
import os
from typing import AsyncGenerator
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base

# Get database URL from environment
_raw_database_url = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres_password@localhost:5433/zefa_db"
)

# Strip ssl/sslmode from URL so SQLAlchemy doesn't pass sslmode to asyncpg (asyncpg expects ssl in connect_args)
_parsed = urlparse(_raw_database_url)
_query = parse_qs(_parsed.query)
_query.pop("ssl", None)
_query.pop("sslmode", None)
_new_query = urlencode({k: v[0] if len(v) == 1 else v for k, v in _query.items()}, doseq=True)
DATABASE_URL = urlunparse((_parsed.scheme, _parsed.netloc, _parsed.path, _parsed.params, _new_query or "", _parsed.fragment))

# SSL for remote DBs (Neon); skip for localhost to avoid breaking local dev
_use_ssl = "localhost" not in _raw_database_url and "127.0.0.1" not in _raw_database_url

# Create async engine (timeout; ssl for Neon)
engine = create_async_engine(
    DATABASE_URL,
    echo=False,  # Set to True for SQL query logging in development
    future=True,
    connect_args={
        "timeout": 10,  # asyncpg connection timeout in seconds
        **({"ssl": True} if _use_ssl else {}),  # Neon requires SSL; asyncpg rejects sslmode from URL
    },
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Base class for models
Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency for FastAPI routes to get database session.
    Yields an async database session and ensures it's closed after use.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
