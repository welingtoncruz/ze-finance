## 📋 Backend Implementation Plan: feat-18 — Refresh token to improve UX

### 1. Analysis & Design
* **Goal**: Introduce a refresh token mechanism so users stay authenticated across sessions and short backend restarts without needing to log in again frequently, while keeping security acceptable for the MVP.
* **Current State**:
  * `POST /token` and `POST /auth/register` return a short-lived JWT access token created by `create_access_token` in `auth_utils.py`.
  * Frontend stores the access token in `localStorage` (`zefa_token`) and injects it via Axios interceptor; on `401` the interceptor clears the token and redirects to `/login`.
  * There is **no refresh token**, so any expiration forces a new login.
* **High-Level Strategy**:
  * Keep access tokens **short-lived** (e.g., 15 minutes) and introduce a **long-lived refresh token** (e.g., 7–30 days) to obtain new access tokens without asking for credentials again.
  * Store refresh tokens server-side (DB table linked to `User`) and expose:
    * `POST /auth/refresh` — exchanges a valid refresh token for a new access token.
    * `POST /auth/logout` — revokes the current refresh token(s).
  * Deliver refresh tokens via **HTTP-only cookies** to avoid exposing them to JS; keep access tokens in the response body to preserve the current frontend flow.
  * Support a simple **“remember me”** flag that controls the refresh token’s lifetime.
* **Affected Files**:
  * `backend/app/models.py` (new `RefreshToken` or equivalent table).
  * `backend/app/schemas.py` (optional: request/response schemas for refresh/logout).
  * `backend/app/auth_utils.py` (helpers to create/verify/rotate refresh tokens).
  * `backend/app/routers/auth.py` (new routes: `/auth/refresh`, `/auth/logout`; adjust login to issue refresh token + cookie).
  * `backend/app/main.py` (ensure CORS/config allows credentials if needed).
  * Database migration docs / future Alembic migration notes.
* **Dependencies**:
  * No new external Python packages required; reuse existing JWT + SQLAlchemy stack.
  * Might adjust environment variables:
    * `REFRESH_TOKEN_EXPIRE_DAYS` (e.g., default 7).
    * `REFRESH_TOKEN_EXPIRE_DAYS_REMEMBER_ME` (e.g., default 30).

### 2. Data Layer (Models & Schemas)
* **Database Changes**:
  * Add `RefreshToken` model in `models.py`:
    * Fields (example):
      * `id`: primary key.
      * `user_id`: FK to `User.id`.
      * `token_hash`: hashed representation of the refresh token (do not store raw token).
      * `created_at`, `expires_at`, `revoked_at` (nullable).
      * Optional: `user_agent`, `ip_address` for future security improvements.
    * Index on `(user_id, expires_at)` to speed up lookups and cleanup.
  * Migration Strategy:
    * Treat as a new table; can be created via metadata for now, but document that it requires Alembic in production.
* **Pydantic Schemas (`schemas.py`)**:
  * Reuse `Token` response schema for access tokens:
    * `access_token: str`
    * `token_type: str = "bearer"`
  * Optional new request schema for manual refresh use cases (if not 100% cookie-based):
    * `TokenRefreshRequest` with a `refresh_token` field (keep for flexibility, but plan to rely primarily on cookie).
  * Optional simple response schema for logout/refresh confirmation (e.g., `{ "detail": "logged out" }`).

### 3. Business Logic (`auth_utils.py` / `crud.py` / Services)
* **New Helpers in `auth_utils.py`**:
  * `create_refresh_token(user_id: UUID, remember_me: bool) -> str`:
    * Generate a random opaque string (e.g., URL-safe token).
    * Compute expiration based on `remember_me` and environment variables.
    * Return the raw token string; the caller is responsible for persisting the hash.
  * `hash_refresh_token(raw_token: str) -> str`:
    * Use a secure one-way hash (can reuse `pwd_context` or a dedicated context).
  * `get_refresh_token_expiry(remember_me: bool) -> datetime`:
    * Encapsulate lifetime rules.
* **New CRUD-style functions (could live in `crud.py` or `auth_utils.py`)**:
  * `create_persistent_refresh_token(db: AsyncSession, user_id: UUID, raw_token: str, expires_at: datetime, user_agent: Optional[str], ip_address: Optional[str])`:
    * Hash `raw_token`, insert row, commit.
  * `find_valid_refresh_token(db: AsyncSession, user_id: UUID, raw_token: str) -> RefreshToken | None`:
    * Hash `raw_token`, query by `user_id` + `token_hash`, ensure `expires_at` is in the future and `revoked_at` is null.
  * `revoke_refresh_token(db: AsyncSession, refresh_token: RefreshToken)`:
    * Set `revoked_at`, commit.
  * Optional **token rotation**:
    * On each `/auth/refresh`, revoke the old refresh token and issue a new one.
* **Business Rules**:
  * A refresh token is only valid if:
    * It exists, is not expired, and is not revoked.
    * It is associated with the authenticated user (user ID from cookie or token payload).
  * Backend must **not** accept refresh tokens from arbitrary users or allow token swapping between accounts.
  * Rate limiting and device-level management can be postponed to a future feature; ensure design allows multiple refresh tokens per user for multi-device support.

### 4. API Layer (`routers/auth.py` / `main.py`)
* **Login Flow (update existing `/token`)**:
  * Extend the OAuth2 password handler to:
    * Optionally read a `remember_me` field from the form data.
    * After successful authentication, create:
      * A short-lived access token (existing logic, possibly tuned to ~15 minutes).
      * A long-lived refresh token using the helpers above.
    * Persist the refresh token in the DB.
    * Return the access token in the response body as today (to avoid breaking the frontend).
    * Set the refresh token in an HTTP-only cookie:
      * Cookie name: `refresh_token`.
      * Flags: `HttpOnly`, `Secure` (in production), `SameSite="Lax"`, `Path="/auth/refresh"`.
* **New Endpoint: `POST /auth/refresh`**:
  * **Status Code**: `200 OK`.
  * **Auth**: No bearer token required; relies on refresh token cookie.
  * **Flow**:
    * Read refresh token from cookie (and optionally from body if the cookie is not present).
    * Validate token with `find_valid_refresh_token`.
    * If valid, issue a new access token and (optionally) a new refresh token (rotation).
    * Update cookie (if rotating) and return the new access token in the body.
    * On failure (missing/invalid/expired token), return `401` with a clear error message.
* **New Endpoint: `POST /auth/logout`**:
  * **Status Code**: `204 No Content` or `200 OK`.
  * **Auth**: Can rely on either bearer token + refresh cookie, or just refresh cookie depending on UX.
  * **Flow**:
    * If a refresh token cookie is present, revoke the corresponding row.
    * Clear the refresh token cookie (set expiration in the past).
    * Optional: For extra safety, you may choose to revoke all refresh tokens for the current user.
* **CORS / Cookie Configuration (`main.py`)**:
  * Ensure FastAPI `CORSMiddleware` is configured to:
    * Allow credentials (`allow_credentials=True`).
    * Include the frontend origin in `allow_origins`.
  * Document that for local development the frontend must send requests with `withCredentials: true` if cookies are relied upon.

### 5. Testing Strategy (`backend/tests/`)
* **File**: `backend/tests/test_auth_refresh.py` (new).
* **Test Case 1 (Happy Path)**:
  * Register + login user.
  * Assert access token is returned and refresh cookie is set.
  * Call `/auth/refresh` with the cookie.
  * Assert new access token is returned and differs from the previous one.
* **Test Case 2 (Expired or Revoked Refresh Token)**:
  * Create a refresh token with `expires_at` in the past or mark as revoked.
  * Call `/auth/refresh`; expect `401`.
* **Test Case 3 (Logout)**:
  * Login user to get refresh token.
  * Call `/auth/logout`.
  * Verify token is revoked in DB and cookie is cleared.
  * Call `/auth/refresh` again; expect `401`.
* **Test Case 4 (Remember Me)**:
  * Login once with `remember_me=false` and once with `remember_me=true`.
  * Verify difference in `expires_at` values for created tokens.

### 6. Step-by-Step Implementation Guide
1. **Update Data Layer**:
   * Add `RefreshToken` model to `models.py`.
   * Ensure metadata creation or Alembic migration is prepared/documented.
2. **Extend Auth Utilities**:
   * Implement refresh token helpers in `auth_utils.py` (creation, hashing, expiry calculation).
3. **Add CRUD Helpers**:
   * Implement DB operations for creating, finding, and revoking refresh tokens.
4. **Enhance Login Endpoint**:
   * Modify `/token` in `routers/auth.py` to create/persist refresh tokens and set cookies.
5. **Implement `/auth/refresh` and `/auth/logout`**:
   * New routes in `routers/auth.py` using the helpers above.
6. **Configure CORS and Cookies**:
   * Adjust `main.py` to allow credentials and proper origins.
7. **Write and Run Tests**:
   * Add `test_auth_refresh.py` and ensure all auth-related tests pass.
8. **Update Documentation**:
   * Reflect new endpoints and refresh token behavior in `PROJECT_DOCUMENTATION.md` and `TECHNICAL_DOCUMENTATION.md`.

### 7. Validation Checklist
- [ ] `RefreshToken` table exists and is wired to `User`.
- [ ] Login issues both access and refresh tokens (cookie-based).
- [ ] `/auth/refresh` returns a new access token when the refresh token is valid.
- [ ] `/auth/logout` revokes refresh tokens and clears the cookie.
- [ ] Type hints and PEP 8 are respected across new code.
- [ ] Tests cover success and failure paths for refresh and logout flows.

---

## 🎨 Frontend Implementation Plan: feat-18 — Refresh token to improve UX

### 1. Analysis & Design
* **Goal**: Reduce how often users need to re-enter credentials by integrating the new backend refresh token flow, while keeping the current `AuthContext` + `localStorage` approach and improving perceived UX.
* **Current State**:
  * `AuthContext` stores the access token in state and in `localStorage` (`zefa_token`).
  * `api` Axios instance injects `Authorization` header from `localStorage` and on `401` clears the token and redirects to `/login`.
  * The login page uses `AuthForm` and calls `login(email, password)` from context, then `router.push("/")`.
* **Target UX**:
  * When a user returns after some time (within refresh token lifetime), the app should:
    * Automatically obtain a fresh access token using `/auth/refresh`.
    * Hydrate `AuthContext` without showing the login screen.
  * When an access token expires during use:
    * The app should transparently attempt a refresh once.
    * Only redirect to `/login` if refresh fails.
  * Include a **“Lembrar de mim”** checkbox on the login form that controls the backend `remember_me` flag.
* **Route**:
  * No new pages; behavior changes in:
    * `app/login/page.tsx`
    * `app/layout.tsx` / `components/layout/AppShell.tsx` (guards)
* **Responsive Layout**:
  * Visual layout remains unchanged; UX improvement is behavioral (fewer forced logins).
* **Server vs Client**:
  * `AuthContext`, login page, and any component that reads/writes tokens remain **Client Components** (`"use client"`).
  * Axios configuration remains on the client side.

### 2. Component Architecture
* **Existing Components to Update**:
  * `context/AuthContext.tsx`:
    * Add support for:
      * Initial refresh attempt on mount if no access token but refresh cookie might exist.
      * Optional `rememberMe` flag passed from login.
      * A method to trigger token refresh (for interceptors).
  * `lib/api.ts`:
    * Enhance response interceptor to:
      * On `401`, attempt `/auth/refresh` once before forcing logout/redirect.
      * Retry the original request if refresh succeeds.
  * `components/auth/AuthForm.tsx`:
    * Add a “Lembrar de mim” checkbox bound to a boolean prop/default state.
  * `app/login/page.tsx`:
    * Pass the `rememberMe` value from `AuthForm` to `login(email, password, rememberMe)`.
* **New Helpers (Optional)**:
  * Small utility function in `lib/api.ts` or a dedicated hook to handle “retry after refresh” logic for Axios to keep interceptors clean.
* **ShadcnUI Primitives**:
  * Reuse `Checkbox`, `Label`, `Button`, `Input`, and any existing form primitives.
* **Icons**:
  * No new icons required; reuse existing login page design.

### 3. State & Data Fetching
* **API Interactions**:
  * **Login**:
    * Endpoint: `POST /token` (form-encoded) with:
      * `username`, `password`, and new `remember_me` field.
    * Implementation: extend `AuthContext.login` to accept a `rememberMe: boolean` parameter and include it in `URLSearchParams`.
  * **Refresh**:
    * Endpoint: `POST /auth/refresh` (no body; relies on cookie).
    * Implement two flows:
      * **On App Load**:
        * In `AuthContext` `useEffect`, if `localStorage` has no token but the app has just mounted, call `/auth/refresh` once.
        * If it returns a token, store it and mark the user as authenticated; if it fails, keep the user unauthenticated without redirect loop.
      * **On 401 from API**:
        * In Axios response interceptor, for a first `401`:
          * Call `/auth/refresh`.
          * If successful, update the stored token and retry the failed request.
          * If refresh also fails, clear token and redirect to `/login` (current behavior).
* **Local State**:
  * `AuthContext`:
    * Keep `token`, `isAuthenticated`, `isHydrated`.
    * Optionally add a transient `isRefreshing` flag to avoid multiple concurrent refresh attempts.
  * `AuthForm`:
    * Local `rememberMe` boolean state bound to checkbox.
* **Global Context**:
  * `useAuth()` remains the single source of truth for auth state.

### 4. Implementation Steps
1. **Extend `AuthContext.login` Signature**:
   * Change to accept `rememberMe: boolean`.
   * Include `remember_me` field in the `URLSearchParams` for the `/token` request.
2. **Wire “Lembrar de mim” in `AuthForm` and Login Page**:
   * Add a checkbox + label to `AuthForm`.
   * Pass the `rememberMe` value to `onSubmit` and then to `login` in `app/login/page.tsx`.
3. **Implement Initial Refresh on App Mount**:
   * In `AuthContext` `useEffect`, after checking `localStorage`:
     * If no token is present, call `/auth/refresh` once.
     * On success, set token + `localStorage` + `isHydrated`.
     * On failure, just set `isHydrated` and keep user unauthenticated.
4. **Enhance Axios Interceptor for Auto-Refresh**:
   * In `lib/api.ts`:
     * On `401`, check a guard flag to avoid infinite loops.
     * Call `/auth/refresh`; if it returns a new token, store it and retry the original request.
     * If retry fails or refresh fails, fall back to clearing token and redirecting to `/login`.
5. **Review Protected Routes Behavior**:
   * Ensure pages that currently redirect to `/login` when not authenticated (`/`, `/transactions`, `/chat`, `/insights`, `/onboarding`) wait for `isHydrated` before deciding.
   * Verify that after a successful background refresh, they render the authenticated view without a visible flicker to `/login`.
6. **Manual QA**:
   * Scenario 1:
     * Login with “Lembrar de mim” checked.
     * Close tab/browser, reopen site within refresh lifetime → user should land directly in the dashboard.
   * Scenario 2:
     * Keep app open until access token expires (simulate by shortening backend expiry).
     * Perform an action that triggers an API call → it should succeed after a transparent refresh.
   * Scenario 3:
     * After refresh token expiry or logout, any action should eventually send user to `/login`.

### 5. Validation Checklist
- [ ] `AuthContext` attempts a single `/auth/refresh` on mount when no access token is present.
- [ ] Login flow passes `remember_me` to backend and respects the checkbox state.
- [ ] Axios interceptor tries to refresh once before forcing logout on `401`.
- [ ] Auth-guarded pages wait for `isHydrated` and correctly handle restored sessions.
- [ ] No `any` types added; all new props and functions are fully typed.
- [ ] UX: returning users within refresh lifetime see the dashboard without needing to re-enter credentials, both on desktop and mobile.

