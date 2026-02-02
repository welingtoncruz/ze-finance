## 📋 Backend Implementation Plan: feat-2 — Config Database (Docker + Postgres + First Local Run)

### 1. Analysis & Design
* **Goal**: Provide a repeatable, first-time local setup for the backend using **PostgreSQL 15 via Docker Compose**, aligned with the project’s Walking Skeleton (FE → API → DB). Ensure developers can run `db` + `backend` locally with minimal friction.
* **Constraints / Notes**:
  * The backend reads configuration from environment variables (e.g., `DATABASE_URL`, `SECRET_KEY`).
  * Prefer **Docker Compose** for Postgres to guarantee consistency across machines.
  * Keep MVP migration strategy: `Base.metadata.create_all()` on startup is acceptable (already used).
* **Affected Files**:
  * `docker-compose.yml` (repo root) — create
  * `backend/.env.example` — update if needed to match `docker-compose.yml` defaults
  * `backend/README.md` (optional) — create quick start commands
  * `TECHNICAL_DOCUMENTATION.md` and/or `ai-specs/specs/development_guide.md` (optional) — update to reflect the actual docker compose workflow and commands
* **Dependencies**:
  * Docker Desktop + Docker Compose v2 (`docker compose ...`)
  * Image: `postgres:15`
  * Optional tooling: `adminer` or `pgadmin` service (dev-only)
* **Environment variables**:
  * `DATABASE_URL` (must point to `postgresql+asyncpg://...`)
  * `SECRET_KEY`
  * `ACCESS_TOKEN_EXPIRE_MINUTES`
  * `ALGORITHM` (e.g., `HS256`)
  * `ALLOWED_ORIGINS` (e.g., `["http://localhost:3000"]`)

---

### 2. Data Layer (Database Setup)
* **Database Changes**:
  * No schema changes in this ticket.
  * Provide a local Postgres instance with persistent volume for dev.
* **Migration strategy**:
  * Keep `Base.metadata.create_all()` for MVP/dev bootstrap.
  * Document when to migrate to Alembic (future).

---

### 3. Business Logic (`crud.py` / Services)
* No changes required in this ticket.
* The focus is infrastructure and first-run ergonomics.

---

### 4. API Layer (How backend connects to DB)
* No route changes required in this ticket.
* Ensure the **local run command** reliably loads environment variables:
  * Prefer `uvicorn` with `--env-file backend/.env` (no code changes needed).
  * Example:
    * `cd backend`
    * `python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --env-file .env`

---

### 5. Testing Strategy (`tests/`)
* **Goal**: Make sure tests run without requiring Docker Postgres.
* **Approach**:
  * Keep integration tests using SQLite in-memory (already aligned with standards).
  * Add a short “DB smoke test” checklist for Docker DB (manual verification):
    * Start `db`
    * Start backend
    * Call `/health`
    * Register + login + create/list/delete transaction + dashboard summary

---

### 6. Step-by-Step Implementation Guide
1. **Create** `docker-compose.yml` in repo root with a `db` service:
   * Image: `postgres:15`
   * Port mapping: `5432:5432`
   * Volume: `zefa_postgres_data:/var/lib/postgresql/data`
   * Env: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
   * Healthcheck: `pg_isready`
2. **Align** `backend/.env.example` with Compose defaults:
   * Ensure `DATABASE_URL=postgresql+asyncpg://postgres:postgres_password@localhost:5432/zefa_db`
   * Keep `ALLOWED_ORIGINS` as JSON array string
3. **Document first-run commands** (prefer adding `backend/README.md`):
   * Start DB: `docker compose up -d db`
   * Copy env file: `cd backend && copy .env.example .env` (Windows) / `cp` (macOS/Linux)
   * Run API: `python -m uvicorn app.main:app --reload --env-file .env`
   * Run tests: `python -m pytest -v`
4. **(Optional) Add a DB admin UI** in `docker-compose.yml`:
   * `adminer` (lightweight) exposed at `http://localhost:8080`
5. **Validate** with a minimal manual E2E run:
   * `/docs` loads
   * `/auth/register` returns token (201)
   * `/token` returns token (200)
   * Protected endpoints work with `Authorization: Bearer <token>`

---

### 7. Validation Checklist
- [ ] Docker Compose starts Postgres 15 locally and exposes port 5432
- [ ] `backend/.env.example` matches Compose credentials and DB name
- [ ] Backend can be started with `--env-file .env` without manual env export
- [ ] `/health` returns 200
- [ ] Register/Login/Transactions/Dashboard work against Docker Postgres
- [ ] `pytest` still runs locally without requiring Docker
- [ ] Documentation updated (if commands or expectations changed)

