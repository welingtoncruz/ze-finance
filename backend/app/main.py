"""
FastAPI application entrypoint and configuration.
"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import auth, dashboard, transactions


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events.
    Creates database tables on startup (MVP approach - use Alembic in production).
    """
    # Create tables (MVP approach - replace with Alembic migrations later)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield
    
    # Shutdown logic (if needed)
    await engine.dispose()


# Create FastAPI app
app = FastAPI(
    title="Zefa Finance API",
    description="API do Zefa Finance (MVP). Utiliza autenticação via JWT (OAuth2 Password Bearer).",
    version="0.2.0",
    lifespan=lifespan,
)

# Configure CORS
allowed_origins_str = os.getenv("ALLOWED_ORIGINS", '["http://localhost:3000"]')
# Simple parsing for JSON array string (for MVP)
try:
    import json
    allowed_origins = json.loads(allowed_origins_str)
except (json.JSONDecodeError, ValueError):
    # Fallback to default if parsing fails
    allowed_origins = ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(transactions.router)
app.include_router(dashboard.router)


@app.get("/")
async def root() -> dict:
    """Root endpoint."""
    return {"message": "Zefa Finance API", "version": "0.2.0"}


@app.get("/health")
async def health() -> dict:
    """Health check endpoint."""
    return {"status": "healthy"}
