## Frontend Implementation Plan: feat-4 — Improve Frontend Architecture (Move v0 app from `ze-finance/` to `frontend/`)

### 1. Analysis & Design
- **Goal**: Refactor the current Next.js app located in `ze-finance/` into a standards-compliant root folder named `frontend/`, following `.cursor/rules/base-standards.mdc` and `.cursor/rules/frontend-standards.mdc`. Only migrate **files required for the MVP Walking Skeleton** to run end-to-end (Register → Login → Dashboard → Transactions create/list/delete).
- **Problem**: The repo standards and documentation expect `backend/` + `frontend/` at the repo root, but the current UI code lives in `ze-finance/` and includes legacy v0 “single-page view switcher” artifacts alongside the newer route-based pages.
- **Target structure** (authoritative):
  - `frontend/app/*` (App Router routes)
  - `frontend/components/*` (UI + layout + feature components)
  - `frontend/lib/*` (Axios client, utilities, types)
  - `frontend/context/*` (AuthContext only)
  - `frontend/public/*` (assets)

#### 1.1 Route Map (MVP)
- **Public routes**
  - `frontend/app/login/page.tsx`
  - `frontend/app/register/page.tsx`
- **Protected routes**
  - `frontend/app/page.tsx` (dashboard)
  - `frontend/app/transactions/page.tsx` (list + create + delete)
- **Optional placeholders** (keep only if already referenced by navigation and required for compile)
  - `frontend/app/insights/page.tsx`
  - `frontend/app/chat/page.tsx`
  - `frontend/app/onboarding/page.tsx`

#### 1.2 Responsive Layout
- **Mobile**: bottom navigation + FAB for “add transaction”.
- **Desktop**: persistent sidebar + wider content container (avoid max-w “phone frame”).

#### 1.3 Server vs Client
- **Default**: Server Components.
- **Must be Client Components (`'use client'`)**:
  - Auth pages (forms + localStorage token)
  - `AuthContext`
  - Any interactive layout/navigation components
  - Transactions page (drawer + form + optimistic state)
  - Dashboard page (client-side fetching given token in localStorage)

---

### 2. Component Architecture

#### 2.1 Keep (minimum set for MVP)
Migrate these from `ze-finance/` → `frontend/` (same relative paths), adjusting imports if needed:

- **App Router**
  - `app/layout.tsx`
  - `app/globals.css`
  - `app/page.tsx`
  - `app/login/page.tsx`
  - `app/register/page.tsx`
  - `app/transactions/page.tsx`
  - *(optional placeholders)* `app/insights/page.tsx`, `app/chat/page.tsx`, `app/onboarding/page.tsx`

- **Context**
  - `context/AuthContext.tsx`

- **Lib**
  - `lib/api.ts` (Axios instance + interceptors)
  - `lib/utils.ts`
  - `lib/types.ts` (UI types)
  - `lib/types/api.ts` (API DTOs + mappers)

- **Components (organized)**
  - `components/ui/*` (Shadcn primitives)
  - `components/theme-provider.tsx`, `components/theme-toggle.tsx`
  - `components/layout/AppShell.tsx`
  - `components/layout/DesktopSidebar.tsx`
  - `components/layout/BottomNavigation.tsx`
  - `components/auth/AuthForm.tsx`
  - `components/dashboard/DashboardScreen.tsx`
  - `components/dashboard/BudgetBar.tsx`
  - `components/dashboard/InsightsCard.tsx`
  - `components/transactions/TransactionsScreen.tsx`
  - `components/transactions/TransactionItem.tsx`
  - `components/transactions/QuickAddTransaction.tsx`
  - `components/overlay/SwipeDrawer.tsx`
  - `components/empty/EmptyState.tsx`
  - `components/loading/SkeletonLoader.tsx`

- **Public assets**
  - `public/*` (copy only what is used: favicon + icons + SVGs referenced by Next)

- **Config (required for build/dev)**
  - `package.json`, `package-lock.json`
  - `next.config.ts`
  - `tsconfig.json`
  - `eslint.config.mjs`
  - `postcss.config.mjs`
  - `components.json`
  - `.gitignore`
  - `.env.local` (and add `.env.example` for frontend)

#### 2.2 Remove / Leave Behind (do not migrate)
These exist in `ze-finance/components/` but are **legacy v0 “view switcher”** artifacts or duplicates. They should not be moved into `frontend/` unless a remaining page imports them:

- **Legacy app shell & screens**
  - `components/zefa-app.tsx`
  - `components/auth-screen.tsx`
  - `components/dashboard-screen.tsx`
  - `components/transactions-screen.tsx`
  - `components/insights-screen.tsx`
  - `components/onboarding-screen.tsx`
  - `components/zefa-chat-screen.tsx`
  - `components/add-transaction-screen.tsx`
  - `components/edit-transaction-modal.tsx` *(backend has no update endpoint; keep only if needed for UI stub)*

- **Duplicate primitives** (folderized versions already exist)
  - `components/empty-state.tsx` (use `components/empty/EmptyState.tsx`)
  - `components/skeleton-loader.tsx` (use `components/loading/SkeletonLoader.tsx`)
  - `components/transaction-item.tsx` (use `components/transactions/TransactionItem.tsx`)
  - `components/swipe-drawer.tsx` (use `components/overlay/SwipeDrawer.tsx`)
  - `components/bottom-navigation.tsx` + `components/desktop-sidebar.tsx` (use `components/layout/*`)
  - `components/quick-add-transaction.tsx` (use `components/transactions/QuickAddTransaction.tsx`)

#### 2.3 ShadcnUI primitives
- **Use existing**: `Button`, `Card`, `Input`, `Label` under `components/ui/`.

#### 2.4 Icons
- Keep using `lucide-react` icons already referenced by components.

---

### 3. State & Data Fetching

#### 3.1 Auth (MVP)
- **Token storage**: `localStorage` (`zefa_token`)
- **Login**:
  - Endpoint: `POST /token` (OAuth2 form encoded)
  - Implementation: `AuthContext.login()`
- **Register**:
  - Endpoint: `POST /auth/register` (JSON)
  - Implementation: `AuthContext.register()`
- **401 handling**:
  - Axios response interceptor clears token and redirects to `/login`

#### 3.2 Transactions (MVP)
- **List**: `GET /transactions?limit=50`
- **Create**: `POST /transactions`
- **Delete**: `DELETE /transactions/{transaction_id}`
- **Mapping layer**:
  - Backend types: `INCOME|EXPENSE` + `occurred_at`
  - UI types: `income|expense` + `date` (YYYY-MM-DD)
  - Use mappers in `lib/types/api.ts`

#### 3.3 Dashboard (MVP)
- **Summary**: `GET /dashboard/summary`
- **Recent transactions**: reuse `GET /transactions`
- Use backend summary when present; fall back to computed totals if needed.

---

### 4. Implementation Steps

1. **Create new `frontend/` folder at repo root**
   - Copy minimal configs from `ze-finance/` (`package.json`, `next.config.ts`, etc.).
   - Ensure `frontend/` runs standalone (`npm run dev` inside `frontend/`).

2. **Move the minimum runtime code**
   - Copy the “Keep” set (Section 2.1) into `frontend/`.
   - Ensure all imports use `@/` alias correctly (verify `tsconfig.json` paths).

3. **Prune legacy v0 files**
   - Do not migrate the “Remove / Leave Behind” list (Section 2.2).
   - If any import breaks, migrate only the specific file required and immediately refactor the import to the “folderized” equivalent.

4. **Environment & configuration**
   - Add `frontend/.env.example` with `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`.
   - Keep `frontend/.env.local` out of git.
   - Confirm backend CORS allows `http://localhost:3000` (already default in backend).

5. **Repo root wiring**
   - Update repo docs to reflect `frontend/` as the frontend location:
     - `TECHNICAL_DOCUMENTATION.md` (Frontend section paths)
     - Root `README.md` (add how to run `frontend/`)
   - (Optional) remove or deprecate `ze-finance/` after migration is verified.

6. **Verification**
   - Run `npm run lint` + `npm run build` inside `frontend/`.
   - Manual flow:
     - Register → Login → Dashboard loads → Create transaction → Appears in list → Delete transaction → Removed → Dashboard updates.

---

### 5. Validation Checklist
- [ ] `frontend/` exists at repo root and follows the structure defined in `.cursor/rules/frontend-standards.mdc`.
- [ ] No direct `axios` usage in components; only `@/lib/api`.
- [ ] Auth works end-to-end with backend (`/auth/register`, `/token`).
- [ ] Transactions list/create/delete works end-to-end with backend.
- [ ] Dashboard summary works end-to-end with backend (`/dashboard/summary`).
- [ ] TypeScript strict: no `any`, explicit DTO interfaces in `lib/types/api.ts`.
- [ ] Responsive-first: sidebar on desktop, bottom nav on mobile; no “phone frame” constraint on desktop authenticated pages.
- [ ] Only necessary files were migrated; legacy v0 view-switcher components remain in `ze-finance/` (or are removed in a follow-up cleanup ticket).

