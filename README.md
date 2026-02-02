# Ze Finance (Zefa Finance)

This repository contains the **technical specs and Cursor workflow framework** for the Ze Finance (Zefa Finance) project.

## Documentation index

- **Technical documentation (single entry point)**: `TECHNICAL_DOCUMENTATION.md`
- **Development guide**: `ai-specs/specs/development_guide.md`
- **API contract (OpenAPI)**: `ai-specs/specs/api-spec.yml`
- **Data model**: `ai-specs/specs/data-model.md`

## Cursor workflow (commands in chat)

Use the `/` commands in Cursor chat:

- **Plan first**
  - `/plan-backend-ticket` — create a backend implementation plan (no code yet)
  - `/plan-frontend-ticket` — create a frontend implementation plan (no code yet)
- **Implement after the plan**
  - `/develop-backend`
  - `/develop-frontend`
- **Documentation updates**
  - `/update-docs`

Project rules used by the framework live in `.cursor/rules/`.

## Standards (summary)

- **Walking Skeleton first**: end-to-end flow before over-engineering.
- **Strict typing**: Python type hints + no `any` in TypeScript.
- **Language rule**: technical artifacts in **English**; user-facing UI text in **Portuguese (pt-BR)**.

## Repository status

This repo contains:
- **Backend**: FastAPI application in `backend/`
- **Frontend**: Next.js application in `frontend/`
- **Specs and automation framework**: in `ai-specs/` and `.cursor/`

## Quick start

### Prerequisites

- **Python 3.11+** (for backend)
- **Node.js 18+** (for frontend)
- **Docker Desktop + Docker Compose v2** (for database)

### 1. Start Database with Docker

From the repository root:

```bash
docker compose up -d db
```

This starts PostgreSQL 15 in a Docker container:
- **Port**: `5433` (to avoid conflicts with local PostgreSQL)
- **Database**: `zefa_db`
- **User**: `postgres`
- **Password**: `postgres_password`
- **Persistent storage**: Data is stored in a Docker volume

**Optional - Database Admin UI (Adminer):**
```bash
docker compose --profile tools up -d adminer
```
Access Adminer at http://localhost:8080 (use the same credentials as above).

**Useful Docker commands:**
```bash
# Stop database
docker compose stop db

# Start database
docker compose start db

# View logs
docker compose logs -f db

# Remove database container and volume (⚠️ deletes data)
docker compose down -v
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --env-file .env
```

**Backend Docker (optional):**
If you prefer to run the backend in Docker:

```bash
cd backend
docker build -t zefa-backend .
docker run -p 8000:8000 --env-file .env zefa-backend
```

**Note:** For development, running locally with `--reload` is recommended for hot-reloading.

### 3. Frontend Setup

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

The frontend will be available at http://localhost:3000 and the backend API at http://localhost:8000.

### 4. Verify Setup

1. Check database is running: `docker compose ps`
2. Backend API docs: http://localhost:8000/docs
3. Frontend: http://localhost:3000

## Docker Details

### Docker Compose Services

The project includes a `docker-compose.yml` file with the following services:

**Database Service (`db`):**
- **Image**: `postgres:15`
- **Container name**: `zefa_postgres`
- **Port mapping**: `5433:5432` (host:container)
- **Volume**: Persistent storage for database data
- **Health check**: Automatic health monitoring
- **Auto-restart**: Enabled

**Adminer Service (`adminer` - optional):**
- **Image**: `adminer:latest`
- **Container name**: `zefa_adminer`
- **Port**: `8080`
- **Profile**: `tools` (must be explicitly started)
- **Purpose**: Web-based database administration UI

### Docker Volumes

- `zefa_postgres_data`: Persistent storage for PostgreSQL data
  - Data persists even if containers are removed
  - To completely reset: `docker compose down -v`

### Backend Dockerfile

The backend includes a `Dockerfile` for containerized deployment:

- **Base image**: `python:3.11-slim`
- **Exposed port**: `8000`
- **Includes**: PostgreSQL client tools
- **Use case**: Production deployments or consistent development environments

**Build and run:**
```bash
cd backend
docker build -t zefa-backend .
docker run -p 8000:8000 --env-file .env zefa-backend
```

### Troubleshooting Docker

**Database connection issues:**
- Verify container is running: `docker compose ps`
- Check logs: `docker compose logs db`
- Ensure port 5433 is not in use by another service

**Reset database:**
```bash
# Stop and remove containers and volumes (⚠️ deletes all data)
docker compose down -v

# Start fresh
docker compose up -d db
```

**View database logs:**
```bash
docker compose logs -f db
```
