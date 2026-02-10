"""
FastAPI application entrypoint and configuration.
"""
import asyncio
import json
import logging
import os
import traceback
from contextlib import asynccontextmanager
from decimal import Decimal

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database import Base, engine
from app.rate_limit import limiter, RATE_LIMIT_AVAILABLE
from app.routers import auth, dashboard, transactions, user
from app.chat import routes as chat_routes
from app.auth_utils import _validate_secret_key


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
    _validate_secret_key()
    # Run table creation in background so we don't block binding to PORT (Cloud Run timeout)
    asyncio.create_task(_ensure_tables())
    yield
    await engine.dispose()


# Configure logger for error handling
logger = logging.getLogger("zefa.api")


# Create FastAPI app
app = FastAPI(
    title="Zefa Finance API",
    description="API do Zefa Finance (MVP). Utiliza autenticação via JWT (OAuth2 Password Bearer).",
    version="0.2.0",
    lifespan=lifespan,
)
if RATE_LIMIT_AVAILABLE:
    from slowapi import _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS: accept JSON array or single origin (GCP env can be stored without brackets)
# Normalize: strip trailing slash so "https://ze-finance.vercel.app/" matches browser "https://ze-finance.vercel.app"
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


def _safe_500_response() -> JSONResponse:
    """Return a generic 500 response without exposing internal details."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Global handler for unexpected exceptions.
    Logs full traceback server-side and returns a safe generic message to the client.
    """
    logger.error(
        "Unhandled exception while processing request %s %s: %s",
        request.method,
        request.url.path,
        "".join(traceback.format_exception(type(exc), exc, exc.__traceback__)),
    )
    return _safe_500_response()


def _json_safe(obj: object) -> object:
    """Convert non-JSON-serializable values for error payloads."""
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_json_safe(v) for v in obj]
    return obj


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """
    Normalize validation errors into a compact, safe structure.
    Does not expose internal details, only field-level validation messages.
    """
    errors = exc.errors()
    logger.debug(
        "Request validation error on %s %s: %s",
        request.method,
        request.url.path,
        errors,
    )
    safe_errors = _json_safe(errors)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Request validation failed",
            "errors": safe_errors,
        },
    )

# Include routers
app.include_router(auth.router)
app.include_router(transactions.router)
app.include_router(dashboard.router)
app.include_router(user.router)
app.include_router(chat_routes.router)


@app.get("/")
async def root() -> dict:
    """Root endpoint."""
    return {"message": "Zefa Finance API", "version": "0.2.0"}


@app.get("/health")
async def health() -> dict:
    """Health check endpoint."""
    return {"status": "healthy"}
