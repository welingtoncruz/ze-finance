# Development Guide (Zefa Finance)

This guide explains how to set up the development environment, run the stack locally, and execute tests for the **Zefa Finance** MVP.

## Prerequisites

- **Python** 3.11+
- **Node.js** 18+
- **Docker Desktop** + **Docker Compose v2**

## Quick start (recommended)

### 1) Start the database (PostgreSQL via Docker)

From the repository root:

```bash
docker compose up -d db
```

Defaults:

- **Host**: `localhost`
- **Port**: `5433` (to avoid conflicts with local PostgreSQL)
- **Database**: `zefa_db`
- **User**: `postgres`
- **Password**: `postgres_password`

Optional database UI:

```bash
docker compose --profile tools up -d adminer
```

Adminer is available at `http://localhost:8080`.

### 2) Backend setup

```bash
cd backend
cp .env.example .env
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --env-file .env
```

Endpoints:

- API: `http://localhost:8000`
- Docs (Swagger): `http://localhost:8000/docs`
- Health: `http://localhost:8000/health`

### 3) Frontend setup

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Frontend: `http://localhost:3000`

## Environment variables

### Backend (`backend/.env`)

See `backend/.env.example` for all options. The most important:

- `DATABASE_URL`: must use `postgresql+asyncpg://...` (matches Docker Compose defaults)
- `SECRET_KEY`: JWT signing secret (change in production)
- `ACCESS_TOKEN_EXPIRE_MINUTES`: JWT expiration time
- `ALLOWED_ORIGINS`: JSON array string (e.g., `["http://localhost:3000"]`)

### AI chat agent configuration (backend)

You can configure API keys via environment variables:

- `OPENAI_API_KEY` (OpenAI)
- `ANTHROPIC_API_KEY` (Anthropic)
- `GEMINI_API_KEY` (Gemini)

If no key is set, you can temporarily set one via the API (stored in memory and expires after 60 minutes):

- `POST /chat/api-key`

### Frontend (`frontend/.env.local`)

- `NEXT_PUBLIC_API_BASE_URL`: backend base URL (default: `http://localhost:8000`)

## Tests

### Backend tests (Pytest)

Backend tests use an in-memory SQLite database and do not require Docker:

```bash
cd backend
python -m pytest -v
```

### Frontend tests

```bash
cd frontend
npm test
```

## Troubleshooting

### Database connection issues

- Check containers: `docker compose ps`
- View logs: `docker compose logs -f db`
- Ensure `DATABASE_URL` points to port `5433` when using Docker Compose defaults.

### Reset the database (dev only)

```bash
docker compose down -v
docker compose up -d db
```

