"""
FastAPI application entrypoint and configuration.
"""
import asyncio
import os
from contextlib import asynccontextmanager
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import auth, dashboard, transactions
from app.chat import routes as chat_routes


async def _ensure_tables() -> None:
    """Create tables if not exist (MVP approach - use Alembic in production)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events.
    Start listening first so Cloud Run sees the container ready; run DB init in background.
    """
    # Run table creation in background so we don't block binding to PORT (Cloud Run timeout)
    asyncio.create_task(_ensure_tables())
    yield
    await engine.dispose()


# Create FastAPI app
app = FastAPI(
    title="Zefa Finance API",
    description="API do Zefa Finance (MVP). Utiliza autenticação via JWT (OAuth2 Password Bearer).",
    version="0.2.0",
    lifespan=lifespan,
)

# Configure CORS: accept JSON array or single origin (GCP env can be stored without brackets)
# Normalize: strip trailing slash so "https://ze-finance.vercel.app/" matches browser "https://ze-finance.vercel.app"
import json

def _normalize_origin(o: str) -> str:
    return (o or "").strip().rstrip("/")

_allowed_origins_raw = os.getenv("ALLOWED_ORIGINS", '["http://localhost:3000"]').strip()
try:
    _parsed = json.loads(_allowed_origins_raw)
    if not isinstance(_parsed, list):
        _parsed = [_allowed_origins_raw] if _allowed_origins_raw else ["http://localhost:3000"]
    allowed_origins = [_normalize_origin(o) for o in _parsed if o and isinstance(o, str)]
except (json.JSONDecodeError, ValueError, TypeError):
    allowed_origins = [_normalize_origin(o) for o in _allowed_origins_raw.split(",") if o.strip()]
if not allowed_origins:
    allowed_origins = ["http://localhost:3000"]

# CORSMiddleware needs exact origins; we pass normalized list (browser sends no trailing slash)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


class EnsureCORSHeadersMiddleware(BaseHTTPMiddleware):
    """Ensure CORS headers on every response (including 5xx). Match origin with trailing slash normalized."""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        origin = request.headers.get("origin")
        if origin and _normalize_origin(origin) in allowed_origins:
            response.headers.setdefault("Access-Control-Allow-Origin", origin)
            response.headers.setdefault("Access-Control-Allow-Credentials", "true")
        return response


app.add_middleware(EnsureCORSHeadersMiddleware)

# Include routers
app.include_router(auth.router)
app.include_router(transactions.router)
app.include_router(dashboard.router)
app.include_router(chat_routes.router)


@app.get("/")
async def root() -> dict:
    """Root endpoint."""
    return {"message": "Zefa Finance API", "version": "0.2.0"}


@app.get("/health")
async def health() -> dict:
    """Health check endpoint."""
    return {"status": "healthy"}
