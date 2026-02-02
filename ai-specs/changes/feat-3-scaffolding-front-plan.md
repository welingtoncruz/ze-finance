## Frontend Implementation Plan: feat-3 — Frontend Scaffolding (Walking Skeleton UI)

### 1. Analysis & Design

* **Goal**: Create the MVP frontend scaffolding aligned with the project standards (Next.js 14 App Router, TypeScript strict, Tailwind + ShadcnUI, responsive-first UX) and integrate the **Walking Skeleton** flows with the existing backend:
  - Register → Login → Create/List/Delete Transactions → Dashboard Summary
* **Primary references**:
  - Frontend standards: `.cursor/rules/frontend-standards.mdc`
  - Core principles + language rules: `.cursor/rules/base-standards.mdc` (English-only for technical artifacts; UI text may be pt-BR)
  - v0 scaffold to reuse: `ze-finance/` (UI components, tokens, layouts, navigation patterns)
  - Backend routes (implemented): `backend/app/routers/{auth,transactions,dashboard}.py`
* **Key decision (standards alignment)**:
  - The v0 scaffold currently lives under `ze-finance/` and uses a single-page “view switcher” (`components/zefa-app.tsx`).
  - This ticket defines the plan to scaffold a **standards-compliant frontend app under `frontend/`** (as per project structure) and **migrate/reuse** the v0 components into route-based pages (App Router).
* **Responsive layout strategy**:
  - **Mobile**: bottom navigation + touch-first controls (FAB / drawer for quick add).
  - **Tablet**: 2-column grids where useful (dashboard widgets, insights).
  - **Desktop**: persistent sidebar + wider dashboard grids; avoid “phone frame” max widths for authenticated areas.
* **Server vs Client**:
  - Default to Server Components for routing/layout structure.
  - Use Client Components for anything that requires:
    - localStorage token access
    - stateful UI (drawer/modal, charts interactions)
    - form handling (login/register/add transaction)

### 2. Route Map (App Router)

Implement pages as routes instead of an internal `view` state:

* **Public routes**
  - `app/login/page.tsx`: login form (OAuth2 `/token`)
  - `app/register/page.tsx`: register form (`/auth/register`)
* **Protected routes (require token)**
  - `app/page.tsx`: dashboard (summary + recent transactions)
  - `app/transactions/page.tsx`: transactions list + filters + add/delete
  - `app/insights/page.tsx`: insights view (initially computed client-side from transactions and/or dashboard summary)
  - `app/chat/page.tsx`: placeholder UI (no backend integration required in MVP)
  - `app/onboarding/page.tsx`: optional onboarding/profile setup (client-only persistence)

Protection approach (MVP):
* Use a **client-side guard** (AuthContext + redirect) because the token will initially live in `localStorage`.
* Optionally add `middleware.ts` later once token moves to cookies (to enable true server-side protection).

### 3. Component Architecture

#### 3.1. Migrate/reuse from `ze-finance/components/`

The v0 scaffold already contains most UI primitives and screens. Reuse them but reorganize by responsibility:

* **Layout**
  - `components/layout/DesktopSidebar.tsx` (from `desktop-sidebar.tsx`)
  - `components/layout/BottomNavigation.tsx` (from `bottom-navigation.tsx`)
  - `components/layout/AppShell.tsx` (new): renders responsive shell and slot for page content
* **Features**
  - `components/auth/AuthForm.tsx` (new): shared login/register form UI + error state
  - `components/transactions/TransactionItem.tsx` (from `transaction-item.tsx`)
  - `components/transactions/EditTransactionModal.tsx` (keep UI, but see “missing backend features” below)
  - `components/transactions/QuickAddTransaction.tsx` (from `quick-add-transaction.tsx`)
  - `components/dashboard/DashboardScreen.tsx` (refactor from `dashboard-screen.tsx` into reusable widget components)
  - `components/insights/InsightsScreen.tsx` (refactor from `insights-screen.tsx`)
* **Shared UI**
  - `components/ui/*`: keep Shadcn primitives as the source of truth
  - `components/theme/ThemeProvider.tsx` + `components/theme/ThemeToggle.tsx` (from `theme-provider.tsx` / `theme-toggle.tsx`)
  - `components/feedback/ToastNotification.tsx` (from `toast-notification.tsx`) or migrate to `sonner`
  - `components/overlay/SwipeDrawer.tsx` (from `swipe-drawer.tsx`)
  - `components/loading/SkeletonLoader.tsx` (from `skeleton-loader.tsx`)
  - `components/empty/EmptyState.tsx` (from `empty-state.tsx`)

#### 3.2. ShadcnUI primitives to use

Minimum set (already present in v0 scaffold):
* `Button`, `Card`, `Input`, `Label`

Add (as needed during migration):
* `Dialog`, `Sheet`, `Tabs`, `DropdownMenu`, `Tooltip`, `Toast` (or `sonner`)

#### 3.3. Icons

Use `lucide-react` icons already used in v0 components (e.g., `Wallet`, `TrendingUp`, `Plus`, `Receipt`, etc.).

### 4. State & Data Fetching

#### 4.1. Backend-integrated features (do these first)

These map directly to backend endpoints already implemented:

* **Auth**
  - `POST /auth/register` → returns `{ access_token, token_type }`
  - `POST /token` (OAuth2 form) → returns `{ access_token, token_type }`
* **Transactions**
  - `GET /transactions?limit=50` → list
  - `POST /transactions` → create
  - `DELETE /transactions/{transaction_id}` → delete
* **Dashboard**
  - `GET /dashboard/summary` → totals + category breakdown

#### 4.2. Frontend API client (required by standards)

Create `frontend/lib/api.ts`:
* Axios instance with `baseURL` from `NEXT_PUBLIC_API_BASE_URL` (e.g., `http://localhost:8000`)
* Request interceptor: inject `Authorization: Bearer <token>` when available
* Response interceptor: on `401`, clear token and redirect to `/login`

#### 4.3. Auth context

Create `frontend/context/AuthContext.tsx`:
* Responsibilities:
  - `token`, `isAuthenticated`, `isHydrated` (localStorage read)
  - `login(email, password)` calls `/token` (form-encoded)
  - `register(email, password)` calls `/auth/register`
  - `logout()` clears token and relevant local state
* Storage:
  - MVP: store token in `localStorage` (consistent with v0 scaffold patterns)

#### 4.4. Data shapes and mapping

Backend uses:
* `Transaction.type`: `INCOME | EXPENSE`
* `occurred_at` timestamps

v0 UI uses:
* `Transaction.type`: `income | expense`
* `date` string (`YYYY-MM-DD`)

Plan:
* Define frontend API DTOs under `frontend/lib/types/api.ts` (strict typing).
* Implement mapping helpers:
  - `mapApiTransactionToUi(...)`
  - `mapUiTransactionToApiCreate(...)`

#### 4.5. Features not implemented in backend (handle in frontend for now)

These exist in the v0 UI but do not have backend endpoints yet:

* **Onboarding profile** (`UserProfile`: monthlyBudget, savingsGoal, streak, etc.)
  - Persist in `localStorage` (MVP)
  - Use as inputs for UI-only calculations (budget progress, streak)
* **Insights**
  - Compute client-side from `/transactions` list (and optionally `/dashboard/summary` for category metrics)
* **Edit transaction**
  - Backend has no `PUT/PATCH /transactions/{id}`.
  - Keep the modal UI, but the plan should implement one of:
    - Disable “edit” until backend supports it (recommended), or
    - Allow “edit” as UI-only (local optimistic change) but clearly mark it as non-persistent.
* **Chat**
  - Keep as a placeholder screen with mock messages/actions (no backend integration in MVP).

### 5. Implementation Steps

1. **Create `frontend/` app scaffold** aligned to standards:
   - Next.js 14 (App Router), TypeScript strict, Tailwind + ShadcnUI structure.
   - Ensure the repo ends up with the standard directory layout:
     - `frontend/app`, `frontend/components`, `frontend/lib`, `frontend/context`, `frontend/public`
2. **Port the design system** from `ze-finance/app/globals.css`:
   - Keep semantic tokens for light/dark and the “fintech” look.
   - Ensure a ThemeProvider is wired into `frontend/app/layout.tsx`.
3. **Build the API layer**:
   - `frontend/lib/api.ts` (Axios instance + interceptors)
   - `frontend/lib/types/api.ts` + mappers
4. **Implement Auth flow (backend-integrated first)**:
   - `AuthContext` with `login/register/logout`
   - Pages: `/login` and `/register`
   - Redirect authenticated users away from auth routes to `/`
5. **Implement protected app shell**:
   - `AppShell` that renders `DesktopSidebar` on desktop and `BottomNavigation` on mobile
   - Apply consistent spacing: desktop uses wide grids and avoids narrow max-width constraints
6. **Implement Transactions (backend-integrated)**:
   - `GET /transactions` on page load
   - Add transaction via drawer/modal → `POST /transactions` → refresh list or update state optimistically
   - Delete transaction → `DELETE /transactions/{id}` → remove from list
   - Keep existing filters/search UI from v0
7. **Implement Dashboard (backend-integrated)**:
   - Fetch `/dashboard/summary` for totals + category breakdown
   - Fetch `/transactions` for recent list + charts (or reuse cached list from Transactions state if shared)
8. **Implement Insights (frontend-computed)**:
   - Use transaction list (and/or summary category metrics) to populate charts
   - Keep responsive chart layout; avoid heavy charts above the fold where possible
9. **Implement onboarding/profile (frontend-only)**:
   - Store profile in `localStorage`
   - Tie monthly budget and savings goal into dashboard/insights calculations
10. **E2E walkthrough (manual validation)**:
   - Run backend on `:8000`, frontend on `:3000`
   - Register → login → create/list/delete transaction → confirm dashboard totals update

### 6. Validation Checklist

- [ ] Uses Axios instance from `@/lib/api` (no direct `fetch/axios` in components).
- [ ] Token handling is centralized (AuthContext + interceptors) and 401 causes logout/redirect.
- [ ] Responsive-first layout: mobile bottom nav, desktop sidebar, no “phone frame” on desktop authenticated screens.
- [ ] TypeScript strict typing (no `any`); API DTOs are explicit.
- [ ] `'use client'` is used only where needed (forms, localStorage, interactive UI).
- [ ] Backend-integrated flows work end-to-end with real API (auth + transactions + dashboard summary).

