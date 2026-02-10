## 📋 Backend Implementation Plan: feat-20 — User configs (profile name & monthly budget)

### 1. Analysis & Design
* **Goal**: Persist and expose basic user configuration (display name and a **default monthly budget**) so the dashboard can show the correct name and a configurable baseline monthly budget, preparing the backend for future profile features.
* **Current State**:
  * `User` model has `full_name` but it is not used in registration or exposed via APIs.
  * There is no persisted monthly budget; the frontend uses a hardcoded/localStorage-only `UserProfile`.
  * `/auth/me` returns only the email and is mainly for testing.
* **High-Level Strategy**:
  * Extend `User` with a `monthly_budget` field.
  * Provide profile read/update endpoints so the user can set/change `full_name` and `monthly_budget`.
  * Use `get_current_user` to ensure profile operations are always scoped to the authenticated user.
* **Affected Files**:
  * `backend/app/models.py` (new column on `User`).
  * `backend/app/schemas.py` (new profile request/response schemas; optional extension of `UserCreate`).
  * `backend/app/crud.py` (new functions to get/update user profile).
  * `backend/app/routers/` (either reuse `auth.py` or add `user.py` for profile endpoints).
  * `PROJECT_DOCUMENTATION.md`, `TECHNICAL_DOCUMENTATION.md` (document profile endpoints and fields).
* **Dependencies**:
  * No new external packages.
  * Optional env var for default monthly budget, e.g. `DEFAULT_MONTHLY_BUDGET`.

### 2. Data Layer (Models & Schemas)
* **Database Changes**:
  * In `models.User`:
    * Add `monthly_budget` column:
      * Type aligned with `Transaction.amount` (numeric/decimal).
      * Nullable with a server-side default (e.g. 5000) or allow `NULL` and handle a default in application code.
    * Keep `full_name` as the canonical display name for the user.
  * Migration Strategy:
    * Treat as an additive column on the `users` table; document that in production it should be added via Alembic migration.
    * For existing rows, rely on DB default or write a one-time migration to backfill `monthly_budget`.
* **Pydantic Schemas (`schemas.py`)**:
  * Decide whether to extend `UserCreate`:
    * Option A (minimal): keep `UserCreate` with only `email` and `password`; profile is edited later via dedicated endpoints.
    * Option B: add optional `full_name` so new users can set their name at registration.
  * Add profile-specific schemas:
    * `UserProfileResponse`:
      * `email: EmailStr`
      * `full_name: Optional[str]`
      * `monthly_budget: Decimal`
    * `UserProfileUpdate`:
      * `full_name: Optional[str] = None`
      * `monthly_budget: Optional[Decimal] = Field(gt=0)`

### 3. Business Logic (`crud.py` / Services)
* **New/Updated Functions**:
  * `create_user(db: AsyncSession, user_in: UserCreate) -> User`:
    * If `UserCreate` gains `full_name`, persist it when creating the user.
    * Initialize `monthly_budget` using:
      * `user_in` value if later extended, otherwise
      * default from env (`DEFAULT_MONTHLY_BUDGET`) or a constant.
  * `get_user_profile(db: AsyncSession, user_id: UUID) -> User`:
    * Fetch the `User` entity and return it for mapping into `UserProfileResponse`.
  * `update_user_profile(db: AsyncSession, user_id: UUID, profile_in: UserProfileUpdate) -> User`:
    * Load user by `user_id`.
    * If `full_name` is provided, strip whitespace and allow `None` or non-empty values.
    * If `monthly_budget` is provided, ensure it is positive.
    * Persist updates and commit.
* **Business Rules**:
  * `monthly_budget` represents the **current default monthly budget**, not a per-month historical record.
  * `monthly_budget` must be > 0 when set.
  * Users can only read/update their own profile; there is no cross-user access.
  * `full_name` should be stored trimmed; empty strings can be normalized to `None`.

### 4. API Layer (`routers/` or `auth.py`)
* **Router organization**:
  * Option 1 (quickest): add profile routes into `auth.py`.
  * Option 2 (cleaner): create `routers/user.py` with its own `APIRouter` and include it in `main.py`.
* **Endpoints**:
  * `GET /user/profile`
    * **Status Code**: `200 OK`.
    * **Auth**: `current_user: User = Depends(get_current_user)`.
    * **Response**: `UserProfileResponse`.
    * **Logic**:
      * Use `current_user.id` to fetch the latest user data via `get_user_profile`.
      * Map to `UserProfileResponse`.
  * `PATCH /user/profile`
    * **Status Code**: `200 OK`.
    * **Auth**: `current_user: User = Depends(get_current_user)`.
    * **Request Body**: `UserProfileUpdate`.
    * **Response**: `UserProfileResponse`.
    * **Logic**:
      * Call `update_user_profile` with `current_user.id` and request body.
      * Return updated profile.
* **Optional refinement**:
  * Consider deprecating `/auth/me` or extending it to reuse `UserProfileResponse` for consistency.

### 5. Testing Strategy (`backend/tests/`)
* **File**: `backend/tests/test_user_profile.py`.
* **Test Case 1 — Get profile with defaults**:
  * Arrange: create a user without setting `monthly_budget` explicitly.
  * Act: authenticate and call `GET /user/profile`.
  * Assert: response returns `email`, `full_name` is `null` or empty, and `monthly_budget` equals the configured default.
* **Test Case 2 — Update profile (name and budget)**:
  * Arrange: create and authenticate a user.
  * Act: `PATCH /user/profile` with new `full_name` and `monthly_budget`.
  * Assert: response reflects updated fields; subsequent `GET /user/profile` returns the new values.
* **Test Case 3 — Invalid budget**:
  * Act: send `monthly_budget <= 0`.
  * Assert: FastAPI returns `422 Unprocessable Entity`.
* **Test Case 4 — Unauthorized access**:
  * Act: call `GET /user/profile` without authentication.
  * Assert: returns `401 Unauthorized`.

### 6. Step-by-Step Implementation Guide
1. **Extend Data Model**:
   * Add `monthly_budget` to `User` in `models.py` with sensible default/nullable config.
2. **Add Profile Schemas**:
   * Create `UserProfileResponse` and `UserProfileUpdate` in `schemas.py`.
   * Optionally extend `UserCreate` with `full_name`.
3. **Implement CRUD Logic**:
   * Update `create_user` to handle `full_name` and set `monthly_budget`.
   * Add `get_user_profile` and `update_user_profile` with validation rules.
4. **Add Profile Endpoints**:
   * Implement `GET /user/profile` and `PATCH /user/profile` in an appropriate router.
5. **Add Tests**:
   * Write `test_user_profile.py` with the four scenarios above and run the suite.
6. **Update Documentation**:
   * Document new endpoints and fields in `PROJECT_DOCUMENTATION.md` and `TECHNICAL_DOCUMENTATION.md`.

### 7. Validation Checklist
- [ ] `User` includes a persisted `monthly_budget` used by profile endpoints.
- [ ] `GET /user/profile` returns `email`, `full_name`, and `monthly_budget` for the authenticated user.
- [ ] `PATCH /user/profile` updates name and budget with proper validation.
- [ ] All new functions are fully type-hinted and follow backend standards.
- [ ] New tests pass and do not break existing auth/transaction tests.

---

## 🎨 Frontend Implementation Plan: feat-20 — User configs (profile name & monthly budget)

### 1. Analysis & Design
* **Goal**: Allow the user to configure their display name and a **default monthly budget** through a simple settings/profile UI, use backend data instead of hardcoded defaults, melhorar os gráficos de insights financeiros com foco em saldo mensal, e temporariamente esconder o streak para evitar mostrar um valor constante e enganoso.
* **Current State**:
  * `HomePage` (`app/page.tsx`) builds a `UserProfile` purely on the frontend, stored in `localStorage` as `zefa_profile`, defaulting to:
    * `name: "User"`, `monthlyBudget: 5000`, `savingsGoal: 10000`, `streak: 1`, `totalSaved: 0`.
  * `AppShell` defines a `defaultProfile` with the same static values and merges `userProfile` over it.
  * `DashboardScreen` and `DesktopSidebar` show `userProfile.name`, `userProfile.monthlyBudget` and `userProfile.streak`.
* **High-Level Strategy**:
  * Introduce uma **User Settings/Profile** screen onde o usuário pode editar nome e orçamento mensal padrão.
  * Consumir os endpoints de profile do backend:
    * Carregar o perfil no mount via `GET /user/profile`.
    * Salvar alterações via `PATCH /user/profile`.
  * Substituir defaults hardcoded por dados reais do backend, mantendo um fallback leve em `localStorage`.
  * Ajustar os insights financeiros para:
    * Mostrar um gráfico de **saldo do mês ao longo do tempo** (linha ou área), ao invés de apenas tendência genérica de 6 meses.
    * Permitir **filtro por mês** (ex.: mês atual, meses anteriores) tanto na tela inicial (dashboard) quanto nas telas de análises e transações para navegar pelo histórico mensal.
    * Remover o aviso de “Em breve” da tela de insights, pois o módulo já está funcional.
  * Esconder temporariamente toda UI de streak até existir uma implementação real no backend.
* **Route**:
  * New page, e.g. `app/settings/page.tsx` (or `app/profile/page.tsx`); choose one path and keep navigation consistent.
* **Responsive Layout**:
  * **Mobile**: single-column card or full-width section with text inputs for name and numeric input for budget, plus a primary “Salvar” button.
  * **Tablet/Desktop**: centered or left-aligned card within the existing content container (`AppShell`), consistent spacing with dashboard cards.
* **Server vs Client**:
  * Settings page: Client Component with `'use client'` (form state, effects, API calls).
  * Existing `AppShell`, `DashboardScreen`, `DesktopSidebar`, and `HomePage` remain client components and will be updated to use backend-driven `UserProfile`.

### 2. Component Architecture
* **New Components**:
  * `components/settings/UserSettingsForm.tsx` (name placeholder, actual path can be adjusted):
    * Props:
      * `initialProfile: UserProfile | null`.
      * `onProfileUpdated(profile: UserProfile)`: callback after successful save.
    * Responsibility:
      * Render inputs for “Nome” e “Orçamento mensal padrão” (texto da UI deve deixar claro que não é histórico por mês, mas um valor base atual).
      * Manage local form state (`name`, `monthlyBudget`), simple validations, loading and error states.
      * Call backend to update profile and propagate new profile to parent via `onProfileUpdated`.
* **New Page**:
  * `app/settings/page.tsx`:
    * Uses `useAuth()` to ensure the user is authenticated (otherwise redirect to `/login`).
    * Fetches profile from `GET /user/profile` on mount.
    * Wraps content in `AppShell` and renders `UserSettingsForm` with fetched data.
* **Existing Components to Update**:
  * `HomePage` (`app/page.tsx`):
    * Replace “frontend-only” profile initialization with:
      * Primary: fetch profile from `GET /user/profile` and map it into `UserProfile`.
      * Secondary (fallback): if API fails, attempt to read `zefa_profile` from localStorage; only fall back to hardcoded values as a last resort.
  * `AppShell` (`components/layout/AppShell.tsx`):
    * Remove rigid `defaultProfile` that forces name `"User"`, fixed budget, and `streak: 1`.
    * Prefer to render UI based on the `userProfile` passed from parent; optionally keep a **very minimal** fallback only for transient loading states.
  * `DashboardScreen` (`components/dashboard/DashboardScreen.tsx`):
    * Continuar usando `userProfile.name` e `userProfile.monthlyBudget`.
    * Esconder chips/badges de streak (mobile e desktop).
    * Introduzir um seletor de mês (por exemplo, dropdown de meses/anos ou “← mês anterior / próximo mês →”) que:
      * Altera o período usado para calcular saldo, receitas e despesas mostrados no dashboard.
      * Sincroniza o período usado pelo gráfico de gastos recentes quando fizer sentido.
  * `InsightsScreen` (`components/insights/InsightsScreen.tsx` e `app/insights/page.tsx`):
    * Remover qualquer texto de “Em breve” ou placeholder que indique funcionalidade futura.
    * Ajustar o gráfico principal para exibir **saldo do mês ao longo do tempo**:
      * Para o mês selecionado, mostrar uma linha/área onde o eixo X são os dias do mês e o eixo Y é o saldo acumulado naquele dia.
      * Permitir troca de mês usando o mesmo padrão de seletor de período (mês atual, meses anteriores).
  * Tela de transações (`app/transactions/page.tsx` / componentes associados):
    * Adicionar um filtro de período por mês (mesmo controle visual usado em dashboard/insights) que limite a lista de transações ao mês selecionado.
  * `DesktopSidebar` (`components/layout/DesktopSidebar.tsx`):
    * Continuar exibindo avatar e nome (de `userProfile.name`).
    * Esconder a linha de streak (`{userProfile.streak} dias de sequência`) até existir implementação real.
* **ShadcnUI Primitives**:
  * Use `Card`, `CardHeader`, `CardTitle`, `CardContent`, `Label`, `Input`, and `Button` for the settings form, following existing design tokens.
* **Icons**:
  * Optionally add a nav item using `Settings` icon in the desktop sidebar or bottom navigation to access the new settings page.

### 3. State & Data Fetching
* **API Interactions**:
  * **Get profile**:
    * Endpoint: `GET /user/profile`.
    * Called in:
      * `HomePage` to hydrate `userProfile` used by dashboard.
      * `app/settings/page.tsx` to populate `UserSettingsForm`.
  * **Update profile**:
    * Endpoint: `PATCH /user/profile`.
    * Payload (example): `{ full_name: string | null, monthly_budget: number }`.
    * Called from `UserSettingsForm` on form submission.
* **Mapping helpers**:
  * Add small mapping functions (e.g. in `lib/types/api.ts` or a new `lib/profile.ts`):
    * `mapApiUserProfileToUi(apiProfile) -> UserProfile`:
      * `apiProfile.full_name` → `name`.
      * `apiProfile.monthly_budget` → `monthlyBudget`.
      * Other fields like `savingsGoal`, `streak`, `totalSaved` can remain frontend-only for now or defaulted.
    * `mapUiUserProfileToApi(profile: UserProfile) -> { full_name, monthly_budget }`.
* **Local State**:
  * `HomePage`:
    * Keep `userProfile` state but define it as backend-driven.
    * Track `isLoading` as today.
  * `UserSettingsForm`:
    * `name: string`, `monthlyBudget: number | ''`.
    * `isSaving: boolean`.
    * `error: string | null`, `success: boolean` or similar feedback flag.
* **Global Context** (optional enhancement):
  * Extend `AuthContext` to hold `userProfile` and an updater:
    * `userProfile: UserProfile | null`.
    * `setUserProfile(profile: UserProfile): void`.
  * This allows:
    * Initial load of profile in one place.
    * Immediate reflection of settings changes in the sidebar/header without page reload.

### 4. Implementation Steps
1. **Create Settings Page Skeleton**:
   * Add `app/settings/page.tsx` as a client page.
   * Use `useAuth()` to redirect unauthenticated users to `/login`.
   * Wrap content with `AppShell` and show a loading state while fetching profile.
2. **Implement Backend Profile Integration on HomePage**:
   * Add an API call to `GET /user/profile` in `HomePage` after auth is confirmed.
   * Map response to `UserProfile` using a helper.
   * Keep `zefa_profile` localStorage as a fallback only if the backend call fails.
3. **Implement `UserSettingsForm` Component**:
   * Render text input for “Nome” and numeric input for “Orçamento mensal”.
   * Initialize state from `initialProfile`.
   * On submit:
     * Call `PATCH /user/profile`.
     * On success, update local state, call `onProfileUpdated`, and optionally persist to localStorage.
     * On error, show inline error message.
4. **Wire Settings Page to Backend**:
   * In `app/settings/page.tsx`, fetch profile on mount via `api.get("/user/profile")`.
   * Pass mapped `UserProfile` to `UserSettingsForm`.
   * When `onProfileUpdated` is called, update page-level `userProfile` and (if using context) propagate to `AppShell` / header.
5. **Remove/Hide Streak UI**:
   * In `DashboardScreen`, remove streak chips from mobile and desktop headers or guard them behind a temporary feature flag set to off.
   * In `DesktopSidebar`, hide the “X dias de sequência” text.
   * Keep `streak` in `UserProfile` type as optional/future-use, but do not render it.
6. **Adjust `AppShell` Default Profile Logic**:
   * Replace the hardcoded `defaultProfile` with a lighter pattern:
     * Prefer `userProfile` passed via props.
     * Use a minimal fallback only when `userProfile` is not yet loaded, avoiding showing `"User"` plus constant `1` streak as a real value.
7. **Enhance Insights & Filters (Dashboard / Insights / Transactions)**:
   * Atualizar `DashboardScreen` para suportar seleção de mês e recalcular:
     * Saldo, receitas, despesas e barras/indicadores com base no mês selecionado.
   * Atualizar `InsightsScreen` para:
     * Trocar o gráfico de tendência genérica por um gráfico de saldo diário dentro do mês selecionado.
     * Adicionar o seletor de mês e garantir que o gráfico reage a essa seleção.
     * Remover todo texto de “Em breve” ou similares.
   * Atualizar a página de transações para filtrar pela mesma noção de “mês selecionado”, garantindo consistência de período entre as telas.
8. **Manual QA**:
   * Scenario 1:
     * Login, open Settings, change name and monthly budget.
     * Go back to dashboard; header and budget cards reflect the new data.
   * Scenario 2:
     * Reload the app; confirm `GET /user/profile` runs and the correct data appears (no fallback to `"User"` or `5000`).
   * Scenario 3:
     * Trocar de mês no seletor (mês anterior e atual) e verificar:
       * Dashboard, insights e lista de transações mostram dados coerentes com o mesmo mês selecionado.
   * Scenario 4:
     * Confirmar que nenhum elemento de UI exibe streak e que não há mais texto de “Em breve” na tela de insights.

### 5. Validation Checklist
- [ ] `HomePage` and `Settings` use `api` from `@/lib/api` to talk to `/user/profile` endpoints.
- [ ] Layout remains responsive on mobile/tablet/desktop for the new settings page and the enhanced insights/filters.
- [ ] Error states in `UserSettingsForm` are handled and surfaced to the user.
- [ ] No `any` types were introduced; all new props and helpers are strongly typed.
- [ ] Hardcoded `"User"`, `5000` budget, and `streak: 1` are no longer shown as real data in normal operation.
- [ ] Streak UI is hidden everywhere until a proper backend-driven streak implementation is available.
- [ ] The insights chart shows monthly balance over time (within the selected month) and month filters behave consistently across dashboard, insights, and transactions.

---

## 🎨 Frontend Implementation Plan (Desktop Onboarding for Name & Budget)

### 1. Analysis & Design
* **Goal**: Improve the desktop user journey so that the user:
  * Sets **display name** and **default monthly budget** during registration.
  * Has **very clear entry points** to edit these fields later via the `Settings` page.
* **Routes**:
  * Registration: `app/register/page.tsx`
  * Dashboard: `app/page.tsx` + `components/dashboard/DashboardScreen.tsx`
  * Layout/navigation: `components/layout/AppShell.tsx`, `components/layout/DesktopSidebar.tsx`
  * Settings: `app/settings/page.tsx`
* **Responsive Layout**:
  * **Mobile/Tablet**:
    * Keep the current registration layout (single-column card).
    * Add “Nome” and “Orçamento mensal padrão” fields below email/password.
  * **Desktop**:
    * On the registration page, use a 2-column layout on large screens:
      * Left: email + password.
      * Right: name + monthly budget.
    * On the dashboard:
      * Add an “Editar perfil” / “Configurações” link near the user name in the desktop header.
      * Add an “Ajustar orçamento” link in the budget card.
      * Add a “Configurações” entry in the desktop sidebar menu.
* **Server vs Client**:
  * `app/register/page.tsx`, `DashboardScreen`, `AppShell`, `DesktopSidebar`, and `UserSettingsForm` are Client Components (already or to remain `'use client'`).

### 2. Component Architecture
* **Updated Components**:
  * `components/auth/AuthForm.tsx` (or the registration form used in `register/page.tsx`):
    * Add controlled fields:
      * `name` (string) – label “Nome”.
      * `monthlyBudget` (string/number) – label “Orçamento mensal padrão”.
    * Render these only in registration mode (e.g. `mode === "register"`).
  * `app/register/page.tsx`:
    * After successful `register(email, password)` via `AuthContext`, immediately call `PATCH /user/profile` with `{ full_name, monthly_budget }`.
    * Handle errors in this PATCH gracefully (surface message but do not break login).
  * `components/dashboard/DashboardScreen.tsx`:
    * In the **desktop header**, add a small “Editar perfil” link/button with `Settings` or `Pencil` icon beside the user name that navigates to `/settings`.
    * In the **budget card** (where `BudgetBar` is rendered), add a subtle “Ajustar orçamento” link that also navigates to `/settings`.
  * `components/layout/DesktopSidebar.tsx`:
    * Add a “Configurações” navigation item using the `Settings` icon that points to `/settings`.
* **ShadcnUI primitives**:
  * `Input`, `Label`, `Button`, `Card`, `CardHeader`, `CardTitle`, `CardContent`.
* **Icons**:
  * `Settings` for settings-related entrypoints.
  * Optionally `Pencil` for inline “edit” affordances.

### 3. State & Data Fetching
* **API Interactions**:
  * **Registration + Profile**:
    * `POST /auth/register` (already used by `AuthContext.register`).
    * Immediately after a successful registration:
      * Call `PATCH /user/profile` with:
        * `full_name`: value from the “Nome” field (trimmed).
        * `monthly_budget`: parsed numeric value from “Orçamento mensal padrão”.
  * **Settings access**:
    * All “Editar perfil” / “Ajustar orçamento” / “Configurações” links simply perform `router.push("/settings")`.
* **Local State**:
  * Registration form:
    * `name: string`
    * `monthlyBudget: string` (converted to number before sending).
    * Reuse existing `isSubmitting`, `error`, etc.
* **Global Context**:
  * Keep using `AuthContext` for token management.
  * (Optional future enhancement) Extend `AuthContext` to hold `userProfile` and a setter so settings updates immediately reflect on header/sidebar without page reload.

### 4. Implementation Steps
1. **Extend registration form UI**:
   * Update `AuthForm` / `register/page.tsx` to include `name` and `monthlyBudget` fields with proper labels and responsive layout (2-column on desktop).
2. **Wire profile update after registration**:
   * In `register/page.tsx`, after `register(email, password)` succeeds, call `api.patch("/user/profile", { full_name, monthly_budget })` using the newly obtained auth token.
   * Handle errors without blocking navigation to `/`.
3. **Add quick access to settings from dashboard**:
   * In `DashboardScreen` desktop header, add an “Editar perfil” link beside the user name that navigates to `/settings`.
   * In the budget card, add an “Ajustar orçamento” link that navigates to `/settings`.
4. **Add settings entry in desktop sidebar**:
   * In `DesktopSidebar`, add a “Configurações” nav item with a `Settings` icon pointing to `/settings`, following existing active/hover styles.
5. **Verify responsive behavior and UX**:
   * Test registration, dashboard, and settings on mobile/tablet/desktop to ensure:
     * Layouts are not “phone-framed” on desktop.
     * New links are discoverable but not visually noisy.

### 5. Validation Checklist
- [ ] Registration form includes “Nome” and “Orçamento mensal padrão” fields.
- [ ] After registration, `/user/profile` is patched with `full_name` and `monthly_budget`.
- [ ] Dashboard desktop header exposes a clear “Editar perfil” action that goes to `/settings`.
- [ ] Budget card has a clear “Ajustar orçamento” link that goes to `/settings`.
- [ ] Desktop sidebar includes a “Configurações” item pointing to `/settings`.
- [ ] All backend calls use the centralized `api` instance from `@/lib/api`.
- [ ] Layout remains responsive on mobile/tablet/desktop and TypeScript has no `any` types.
