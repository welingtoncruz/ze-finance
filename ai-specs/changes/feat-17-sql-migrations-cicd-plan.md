# Backend Implementation Plan: feat 17 – SQL Migrations CI/CD (Step 3 + Alembic)

**Status: deferred.** The app is in testing phase; schema is managed with `Base.metadata.create_all()` on startup. Revisit this plan when you need versioned migrations (e.g. before production with real data).

---

## 1. Analysis & Design

- **Goal**: Introduce Alembic for schema migrations and run `alembic upgrade head` in Cloud Build (Step 3) before deploying the backend to Cloud Run. DATABASE_URL is read from GCP Secret Manager in the build pipeline so migrations apply to the same Neon DB used by the app.
- **Affected Files**:
  - **Created**: `backend/alembic.ini`, `backend/alembic/env.py`, `backend/alembic/script.py.mako`, `backend/alembic/versions/` (initial migration).
  - **Modified**: `backend/requirements.txt`, `backend/cloudbuild.yaml`, `backend/README.md`, `backend/.gitignore` (if needed), `PROJECT_DOCUMENTATION.md` / `TECHNICAL_DOCUMENTATION.md` (docs).
- **Dependencies**:
  - New pip: `alembic`, `psycopg2-binary` (sync driver for Alembic; app keeps `asyncpg`).
  - No new env vars: reuse `DATABASE_URL` (Cloud Build step gets it from Secret Manager).

---

## 2. Data Layer (Models & Schemas)

- **Database changes**: None to existing models. Alembic will reflect current `app.models` and produce an initial migration (or you generate it with `alembic revision --autogenerate -m "initial"`).
- **Migration strategy**:
  - **Local**: developer runs `alembic upgrade head` (or keeps using `create_all` until first migration exists).
  - **CI**: Cloud Build runs the built backend image with `alembic upgrade head` and `DATABASE_URL` from Secret Manager before deploy.
- **Pydantic**: No change to `schemas.py`.

---

## 3. Step 3 Design: Run Migrations in Cloud Build

### 3.1 How DATABASE_URL is provided

- **Secret Manager**: Store `DATABASE_URL` in GCP Secret Manager (already done for Cloud Run).
- **Cloud Build**: Use **availableSecrets** and **secretEnv** so the migration step runs with `DATABASE_URL` set without writing it to logs or disk.
  - In `cloudbuild.yaml` (top-level, under `options` or at root level as per Cloud Build schema):
    - `availableSecrets.secretManager`: one entry for `DATABASE_URL`.
    - In the migration step: `secretEnv: ['DATABASE_URL']`.
- **Exact reference**:  
  `versionName: projects/${PROJECT_ID}/secrets/DATABASE_URL/versions/latest`  
  and the step that runs Alembic sets `secretEnv: ['DATABASE_URL']`.

### 3.2 Exact command in the migration step

- **Command**: `alembic upgrade head`
- **How it runs**: Use the **same image** just built (e.g. `us-east1-docker.pkg.dev/${PROJECT_ID}/zefa-backend/zefa-api:${SHORT_SHA}`).
- **Step definition** (conceptually):
  - **id**: `migrate`
  - **name**: image built in step `build` (so the step runs that image).
  - **entrypoint**: `alembic`
  - **args**: `["upgrade", "head"]`
  - **secretEnv**: `['DATABASE_URL']`
  - **waitFor**: `['push']` (so image is in registry before running the migration container).
- **Deploy step**: `waitFor: ['migrate']` so deploy runs only after migrations succeed.

### 3.3 IAM

- The Cloud Build service account (e.g. `PROJECT_NUMBER@cloudbuild.gserviceaccount.com`) must have **Secret Manager Secret Accessor** on the `DATABASE_URL` secret so the migration step can receive it.

---

## 4. Alembic Configuration (Backend)

- **alembic.ini**:  
  - Set `script_location = alembic`.  
  - Leave `sqlalchemy.url` empty or a placeholder; the real URL is set in `env.py` from the environment (so CI and local both work).
- **alembic/env.py**:
  - Import `app.database.Base` and `app.models` (so all tables are registered).
  - Get URL from environment: `url = os.getenv("DATABASE_URL", "")`.
  - Convert to **sync** URL for Alembic: e.g. `url = url.replace("postgresql+asyncpg", "postgresql")` (Alembic will use `psycopg2`).
  - Call `config.set_main_option("sqlalchemy.url", url)` and set `target_metadata = Base.metadata`.
  - Use synchronous `run_migrations_online()` (standard Alembic pattern with `connect()` and `run_migrations()`).
- **Driver**: App keeps `asyncpg`; migrations use `psycopg2` (sync). No need to change the app’s `database.py` for Alembic.

---

## 5. API Layer

- No new endpoints. Migrations are run from the CLI/CI only.

---

## 6. Testing Strategy

- **tests/conftest.py**: Keep using in-memory SQLite and `Base.metadata.create_all` / `drop_all` for test DB setup (no Alembic in tests for MVP).
- **Optional**: Add a small test that runs `alembic upgrade head` against a temporary Postgres (e.g. test container) to validate migration scripts. Not required for MVP.

---

## 7. Step-by-Step Implementation Guide

1. **Add dependencies**: In `backend/requirements.txt` add `alembic` and `psycopg2-binary`.
2. **Scaffold Alembic**: Create `backend/alembic.ini` and `backend/alembic/env.py` (and `script.py.mako`), with `env.py` reading `DATABASE_URL` and converting to sync URL, and setting `target_metadata = Base.metadata` after importing `app.models`.
3. **Initial migration**: Run `alembic revision --autogenerate -m "initial"` from `backend/`, then commit the new file under `alembic/versions/`.
4. **Cloud Build**: In `backend/cloudbuild.yaml` add `availableSecrets` (Secret Manager `DATABASE_URL`) and a new step `migrate` that runs the built image with `alembic upgrade head` and `secretEnv: ['DATABASE_URL']`; set deploy step `waitFor: ['migrate']`.
5. **Docs**: Update `backend/README.md` and project/technical docs to describe the migration workflow (local: `alembic revision --autogenerate`, commit migrations; CI: Step 3 runs `alembic upgrade head` before deploy).
6. **Optional**: In `app/main.py`, keep `_ensure_tables()` for now so local dev without running Alembic still works; production will rely on Alembic in CI. Later you can remove `create_all` and require `alembic upgrade head` for local DB.

---

## 8. Validation Checklist

- [ ] Code follows PEP 8 and `snake_case`; type hints where relevant.
- [ ] `alembic upgrade head` runs locally with `DATABASE_URL` in `.env`.
- [ ] Cloud Build Step 3 runs after push and before deploy; deploy waits on `migrate`.
- [ ] Cloud Build service account has Secret Manager Secret Accessor for `DATABASE_URL`.
- [ ] No secrets in logs or in `cloudbuild.yaml` (only `secretEnv` reference).
