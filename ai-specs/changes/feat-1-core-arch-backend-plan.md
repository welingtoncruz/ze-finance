## Backend Implementation Plan: feat-1 — Core Arch (Walking Skeleton)

This plan establishes the backend MVP core architecture (FastAPI Async + SQLAlchemy Async + JWT) that supports the end-to-end Walking Skeleton flow:

- Register → Login → Create/List/Delete Transactions → Dashboard Summary
- Enforce data isolation by authenticated `user_id`

### 1. Analysis & Design

- **Goal**: Ship a minimal but complete backend architecture that satisfies the MVP contract and allows the frontend to integrate with a real API and DB.
- **References (authoritative)**:
  - **API contract**: `ai-specs/specs/api-spec.yml`
  - **Data model**: `ai-specs/specs/data-model.md`
  - **Project overview**: `TECHNICAL_DOCUMENTATION.md`
- **Folder structure (created as part of this ticket; no code yet)**:
  - `backend/`
  - `backend/app/`
  - `backend/app/routers/`
  - `backend/tests/`
- **Files to be created in the implementation step**:
  - **App**: `backend/app/main.py`, `backend/app/database.py`, `backend/app/models.py`, `backend/app/schemas.py`, `backend/app/crud.py`, `backend/app/auth_utils.py`
  - **Routers**: `backend/app/routers/auth.py`, `backend/app/routers/transactions.py`, `backend/app/routers/dashboard.py`
  - **Tests**: `backend/tests/conftest.py`, `backend/tests/test_auth.py`, `backend/tests/test_transactions.py`, `backend/tests/test_dashboard.py`
  - **Infra**: `backend/requirements.txt`, `backend/Dockerfile`, `backend/.env.example`
- **Dependencies (pip)**:
  - **Runtime**: `fastapi`, `uvicorn`, `pydantic`, `sqlalchemy`, `asyncpg`
  - **Auth**: `python-jose[cryptography]` (JWT), `passlib[bcrypt]`, `python-multipart` (OAuth2 form endpoint)
  - **Testing**: `pytest`, `pytest-asyncio`, `httpx`
- **Environment variables** (baseline from `ai-specs/specs/development_guide.md`):
  - `DATABASE_URL`
  - `SECRET_KEY`
  - `ACCESS_TOKEN_EXPIRE_MINUTES`
  - `ALLOWED_ORIGINS`
  - (Plus a JWT algorithm constant such as `ALGORITHM=HS256`)

### 2. Data Layer (Models & Schemas)

#### Database changes

Implement the MVP entities:

- **User**
  - `id` (UUID v4, PK)
  - `email` (unique, max 255)
  - `hashed_password`
  - `full_name` (optional)
  - `created_at`
  - `last_login_at` (nullable)
- **Transaction**
  - `id` (UUID v4, PK)
  - `user_id` (UUID FK -> User)
  - `amount` (Decimal/Numeric, must be positive; sign defined by `type`)
  - `type` (INCOME | EXPENSE)
  - `category` (string)
  - `description` (optional)
  - `occurred_at` (business timestamp; defaults to now if missing)
  - `created_at` (audit timestamp)

Constraints & performance:

- Enforce `User.email` uniqueness
- Enforce FK integrity + cascade delete from User → Transaction
- Add an index on `(transactions.user_id, transactions.occurred_at)` for list + dashboard queries

Migration approach:

- MVP/dev bootstrap may use `Base.metadata.create_all()` (per `development_guide.md`)
- Switch to Alembic when schema evolution becomes necessary

#### Pydantic schemas (`schemas.py`)

Must match `ai-specs/specs/api-spec.yml`:

- **Auth**
  - `UserCreate`: `email`, `password` (min length 8)
  - `Token`: `access_token`, `token_type` (default `"bearer"`)
- **Transactions**
  - `TransactionCreate`: `amount` (>0), `type` (INCOME/EXPENSE), `category`, optional `description`, optional `occurred_at`
  - `TransactionResponse`: all fields from `TransactionCreate` plus `id`, `created_at`
- **Dashboard**
  - `DashboardSummary`: `total_balance`, `total_income`, `total_expense`, `by_category: list[CategoryMetric]`
  - `CategoryMetric`: `name`, `value`

Implementation note:

- Use Pydantic v2 `ConfigDict(from_attributes=True)` for ORM-to-schema serialization.

### 3. Business Logic (`crud.py` / Services)

#### Auth

- **create_user(db: AsyncSession, user_in: UserCreate) -> User**
  - Check email uniqueness
  - Hash password
  - Insert user + commit
- **authenticate_user(db: AsyncSession, email: str, password: str) -> User | None**
  - Fetch by email
  - Verify password
  - Update `last_login_at` on success

#### JWT utilities (`auth_utils.py`)

- **create_access_token(user_id: UUID, ...) -> str**
  - Claims: `sub` (user_id), `exp` (expiry)
  - Sign with `SECRET_KEY`
- **get_current_user** dependency
  - Validate bearer token
  - Load user (or user_id) for protected routes

#### Transactions

- **create_user_transaction(db: AsyncSession, tx_in: TransactionCreate, user_id: UUID) -> Transaction**
  - Validate `amount > 0`
  - Insert with `user_id` + commit
- **list_user_transactions(db: AsyncSession, user_id: UUID, limit: int = 50) -> list[Transaction]**
  - Filter by `user_id`
  - Order by `occurred_at desc` (or `created_at desc`) + limit
- **delete_user_transaction(db: AsyncSession, transaction_id: UUID, user_id: UUID) -> bool**
  - Delete where `id` AND `user_id` match
  - Return false if nothing deleted (to map to 404)

#### Dashboard

- **get_dashboard_summary(db: AsyncSession, user_id: UUID) -> DashboardSummary**
  - Aggregate totals (income, expense)
  - Compute balance \(balance = income - expense\)
  - Group by `category` for `by_category`
  - Document whether category breakdown includes EXPENSE-only or both (choose one and keep consistent)

### 4. API Layer (`routers/` and `main.py`)

Endpoints must match `ai-specs/specs/api-spec.yml`:

- **POST `/auth/register`** (public)
  - Status: `201`
  - Response: `Token`
- **POST `/token`** (public, OAuth2 form)
  - Status: `200`
  - Response: `Token`
- **GET `/transactions?limit=50`** (protected)
  - Status: `200`
  - Response: `list[TransactionResponse]`
- **POST `/transactions`** (protected)
  - Status: `201`
  - Response: `TransactionResponse`
- **DELETE `/transactions/{transaction_id}`** (protected)
  - Status: `204` (empty body)
- **GET `/dashboard/summary`** (protected)
  - Status: `200`
  - Response: `DashboardSummary`

Cross-cutting:

- Configure CORS from `ALLOWED_ORIGINS`
- Keep routes thin: validation in schemas + orchestration in CRUD/services

### 5. Testing Strategy (`tests/`)

- **`backend/tests/test_auth.py`**
  - Register returns `201` + token
  - Duplicate email returns `400`
  - Login returns `200` + token; invalid credentials return `401`
- **`backend/tests/test_transactions.py`**
  - Authorized create returns `201`
  - Authorized list returns only own transactions (isolation)
  - Delete enforces ownership (not found if not owned)
- **`backend/tests/test_dashboard.py`**
  - Summary totals correct after creating transactions
  - Category breakdown aggregates correctly
- **`backend/tests/conftest.py`**
  - Async test client fixture
  - Test DB strategy (SQLite async or disposable Postgres) with isolation

### 6. Step-by-Step Implementation Guide

1. Create backend scaffolding files: `requirements.txt`, `Dockerfile`, `.env.example`.
2. Implement async DB setup in `database.py` (engine + session + dependency).
3. Implement `models.py` (User, Transaction, constraints, indexes).
4. Implement `schemas.py` aligned to OpenAPI contract.
5. Implement auth primitives in `auth_utils.py` (hashing + JWT + `get_current_user`).
6. Implement CRUD operations in `crud.py` (auth, transactions, dashboard aggregates).
7. Implement routers and wire them into `main.py`, including CORS and MVP `create_all`.
8. Implement integration tests and run `pytest`.
9. Re-check docs alignment; only update specs if the contract truly changes.

### 7. Validation Checklist

- [ ] Uses async SQLAlchemy patterns (`AsyncSession`, `await`).
- [ ] Type hints everywhere.
- [ ] Passwords hashed with bcrypt; never returned.
- [ ] JWT expiration enforced; bearer auth protects required routes.
- [ ] All transaction operations filter by authenticated `user_id`.
- [ ] Integration tests cover the Walking Skeleton flow.
