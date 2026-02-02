# Zefa Finance Backend

FastAPI backend for Zefa Finance MVP.

## Prerequisites

- Python 3.11+
- Docker Desktop + Docker Compose v2
- pip (Python package manager)

## Quick Start

### 1. Start PostgreSQL Database

From the repository root:

```bash
docker compose up -d db
```

This starts PostgreSQL 15 in a Docker container with persistent storage on port **5433** (to avoid conflicts with other PostgreSQL instances).

### 2. Configure Environment Variables

Copy the example environment file:

**Windows:**
```bash
cd backend
copy .env.example .env
```

**macOS/Linux:**
```bash
cd backend
cp .env.example .env
```

Edit `.env` if you need to change any values (defaults work with Docker Compose).

### 3. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 4. Run the API Server

```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --env-file .env
```

The API will be available at:
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Health Check: http://localhost:8000/health

### 5. Run Tests

Tests use SQLite in-memory database and don't require Docker:

```bash
python -m pytest -v
```

## Database Management

### Access Database Admin UI (Optional)

Start Adminer (lightweight database admin tool):

```bash
docker compose --profile tools up -d adminer
```

Access Adminer at: http://localhost:8080

Connection details:
- System: PostgreSQL
- Server: db
- Username: postgres
- Password: postgres_password
- Database: zefa_db

### Stop Database

```bash
docker compose down
```

To remove volumes (deletes all data):

```bash
docker compose down -v
```

## Environment Variables

See `.env.example` for all available environment variables:

- `DATABASE_URL`: PostgreSQL connection string (must use `postgresql+asyncpg://`)
- `SECRET_KEY`: JWT signing secret (change in production)
- `ACCESS_TOKEN_EXPIRE_MINUTES`: JWT token expiration time
- `ALGORITHM`: JWT algorithm (default: HS256)
- `ALLOWED_ORIGINS`: JSON array of allowed CORS origins

## Development Notes

- Database tables are created automatically on startup using `Base.metadata.create_all()` (MVP approach)
- Migrate to Alembic when schema evolution becomes necessary
- All database operations are async (SQLAlchemy Async + AsyncPG)

## Troubleshooting

### Database Connection Issues

1. Ensure Docker Compose is running: `docker compose ps`
2. Check database logs: `docker compose logs db`
3. Verify `DATABASE_URL` in `.env` matches Docker Compose credentials and port (default: 5433)
4. Ensure port 5433 is not already in use

### Port Already in Use

The default configuration uses port **5433** to avoid conflicts. If port 5433 is also in use:
- Stop the conflicting service, or
- Change the port mapping in `docker-compose.yml` (e.g., `"5434:5432"`)
- Update `DATABASE_URL` in `.env` to use the new port (e.g., `localhost:5434`)
