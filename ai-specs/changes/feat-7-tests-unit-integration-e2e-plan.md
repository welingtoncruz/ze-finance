## Frontend Implementation Plan: feat-7 — Unit + Integration + E2E Tests (Create Transaction Flow)

### 1. Analysis & Design

- **Goal**: Add a **minimal but robust** automated test suite for the MVP frontend (`frontend/`) with:
  - **Unit tests** for pure TypeScript logic (mappers, helpers).
  - **Integration tests** for key UI flows in isolation (form validation + submit contract).
  - **At least 1 E2E test** covering the **real user flow of creating a transaction**.

- **Primary user journey to cover (E2E)**:
  - Authenticate (register or login) → navigate to `/transactions` → open “Nova Transação” drawer → fill form → submit → transaction appears in the list.

- **Code paths involved today** (for targeting tests):
  - `frontend/app/transactions/page.tsx`
    - `handleAddTransaction()` uses `mapUiTransactionToApiCreate()` and `api.post("/transactions")`
  - `frontend/components/transactions/TransactionForm.tsx`
    - Local state, required fields, submit payload shape
  - `frontend/components/transactions/CategoryPicker.tsx`
    - Category selection via icon-grid buttons (`aria-label` per category)
  - `frontend/lib/types/api.ts`
    - `mapApiTransactionToUi()`, `mapUiTransactionToApiCreate()`
  - Auth token storage:
    - `frontend/context/AuthContext.tsx` uses `localStorage["zefa_token"]`

- **Non-goals (for this feature)**:
  - Snapshot tests for styling.
  - Full coverage across all pages.
  - Backend test refactors (backend already has pytest integration tests; keep frontend suite independent).

---

### 2. Test Stack & Tooling

#### 2.1 Unit/Integration (Component-level)
- **Runner**: Vitest
- **DOM environment**: `jsdom`
- **UI testing**: React Testing Library + `@testing-library/user-event`
- **Assertions**: `@testing-library/jest-dom`
- **Mocking**:
  - Prefer **module mocks** for `@/lib/api` and `next/navigation` to keep tests deterministic.
  - Optional (later): MSW for higher-fidelity network behavior if needed.

#### 2.2 E2E
- **Runner**: Playwright (`@playwright/test`)
- **Test style**: black-box browser tests using **stable selectors** (prefer `data-testid`) + accessibility selectors (`getByRole`, `getByLabelText`) as fallback.

---

### 3. Project Structure (Where Tests Should Live)

- **Unit + integration tests**:
  - `frontend/tests/unit/**`
  - `frontend/tests/integration/**`
  - Keep test files named `*.test.ts` / `*.test.tsx`

- **E2E tests**:
  - `frontend/e2e/**`
  - `frontend/playwright.config.ts`
  - Optional: `frontend/e2e/global-setup.ts` (seed user / ensure clean state)

---

### 4. Minimal Repo Changes Required (Scaffolding)

#### 4.1 Add dependencies (frontend)
- Add dev dependencies:
  - `vitest`, `jsdom`
  - `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`
  - `@playwright/test`

#### 4.2 Add npm scripts (frontend/package.json)
- `test`: run unit + integration
- `test:watch`: watcher for local dev
- `test:e2e`: run Playwright (headless)
- `test:e2e:ui`: run Playwright UI mode (optional)

#### 4.3 Vitest configuration
- Add:
  - `frontend/vitest.config.ts`
  - `frontend/tests/setup.ts` (import `@testing-library/jest-dom`, provide common mocks)
- Ensure config supports:
  - `@/*` alias (match `tsconfig.json`)
  - `environment: "jsdom"`
  - `setupFiles` and `globals` as needed

#### 4.4 Playwright configuration
- Add `frontend/playwright.config.ts`:
  - `use.baseURL = "http://localhost:3000"`
  - `webServer` for frontend (e.g., `npm run dev -- --port 3000`)
  - Expect the backend API reachable via `NEXT_PUBLIC_API_BASE_URL` (typically `http://localhost:8000`)

**Recommended dev workflow for E2E**:
- Terminal A: start backend (FastAPI) on `:8000`
- Terminal B: Playwright starts frontend via `webServer` and runs tests

---

### 5. Testability Improvements (Small UI Adjustments)

To avoid brittle selectors based on copy/visual layout, add **stable `data-testid` attributes** to the transaction creation flow:

- `TransactionForm.tsx`
  - Amount input: `data-testid="tx-amount"`
  - Date input: `data-testid="tx-date"`
  - Description input: `data-testid="tx-description"`
  - Submit button: `data-testid="tx-submit"`
- `CategoryPicker.tsx`
  - Each category button: `data-testid={`tx-category-${category.value}`}` (or a stable attribute on the button)
- `SwipeDrawer` (or its content wrapper)
  - Add: `data-testid="tx-drawer"`

Also add stable hooks for auth flow (E2E):
- `AuthForm.tsx`
  - Email input: `data-testid="auth-email"`
  - Password input: `data-testid="auth-password"`
  - Submit button: `data-testid="auth-submit"`

These are small, low-risk changes that keep tests resilient even if UI copy changes (pt-BR vs English).

---

### 6. Unit Test Plan (High Signal, Low Maintenance)

#### 6.1 API mappers (pure logic)
- File: `frontend/tests/unit/api-mappers.test.ts`
- Targets: `frontend/lib/types/api.ts`
- Cases:
  - `mapUiTransactionToApiCreate()` converts:
    - `type: "income" | "expense"` → `"INCOME" | "EXPENSE"`
    - `date: "YYYY-MM-DD"` → `occurred_at` ISO string
    - keeps `amount`, `category`, optional `description`
  - `mapApiTransactionToUi()` converts:
    - `type` to lowercase
    - `occurred_at` to `date: "YYYY-MM-DD"`
    - `description: null` → `undefined`

#### 6.2 Category helpers
- File: `frontend/tests/unit/categories.test.ts`
- Targets: `frontend/lib/transactions/categories.ts`
- Cases:
  - `getCategoriesByType("income")` / `("expense")` returns non-empty lists
  - Category values are stable strings (no duplicates) to avoid UI/test flakiness

---

### 7. Integration Test Plan (UI Contract-Level)

#### 7.1 TransactionForm behavior (without backend)
- File: `frontend/tests/integration/transaction-form.test.tsx`
- Render: `<TransactionForm mode="create" onSubmit={mockFn} onCancel={mockFn} />`
- Cases:
  - Submit disabled until:
    - amount is present
    - a category is selected
  - Selecting a category emits correct payload on submit:
    - `amount` parsed as `number`
    - `type` matches selected toggle
    - `category` equals selected value
    - `date` defaults to today
    - empty description becomes `undefined`

#### 7.2 Type toggle resets invalid category
- Same file or separate: verify switching `expense -> income` resets category if the selected category is not valid for the new type.

#### 7.3 TransactionsPage “add flow” (mock API module)
- File: `frontend/tests/integration/transactions-page-add-flow.test.tsx`
- Mock:
  - `@/lib/api` to return:
    - `get("/transactions?limit=50")` → empty list
    - `post("/transactions")` → returns created transaction
  - `useAuth()` to force `isHydrated=true`, `isAuthenticated=true`
  - `next/navigation` hooks used by the page (`useRouter`, `useSearchParams`)
- Assert:
  - Opening drawer calls no API yet
  - Submitting calls `api.post("/transactions", ...)`
  - New transaction appears in list (by category label or amount)

This keeps the integration test fast and deterministic without needing a real backend.

---

### 8. E2E Test Plan (Create Transaction Flow)

#### 8.1 Pre-conditions
- Backend running and reachable by the frontend:
  - `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`
- Use a **fresh user** per E2E run:
  - Prefer registering via `/register` inside the test with a unique email (timestamp-based).

#### 8.2 E2E scenario: “register → create transaction → appears in list”
- File: `frontend/e2e/create-transaction.spec.ts`
- Steps:
  1. Go to `/register`
  2. Fill email + password and submit
  3. Confirm redirect to `/` (or authenticated shell)
  4. Navigate to `/transactions`
  5. Open drawer:
     - desktop: click “Nova Transação”
     - mobile: click FAB
  6. Fill the form:
     - amount: `123.45`
     - pick category via `data-testid` (or `aria-label`)
     - date: today (keep default, or set explicitly)
     - description optional
  7. Submit
  8. Assert:
     - success toast appears OR drawer closes
     - transaction row shows:
       - category label OR category value
       - amount formatted in BRL
       - appears under the correct month grouping

#### 8.3 Flake-proofing rules
- Prefer Playwright “expect eventually” patterns:
  - wait for drawer visible
  - wait for network idle after submit (or wait for list item to appear)
- Avoid relying on month names/casing (locale). Prefer asserting the **transaction item content**.

---

### 9. CI / Local Execution Notes

- **Local**:
  - Unit/Integration: `npm run test`
  - E2E:
    - start backend in a terminal
    - run `npm run test:e2e`

- **CI (recommended future improvement)**:
  - Add a workflow that:
    - starts backend with a **test database** (sqlite or postgres)
    - builds/starts frontend
    - runs Playwright headless

---

### 10. Validation Checklist

- [ ] Unit tests cover the type/date mapping logic in `frontend/lib/types/api.ts`.
- [ ] TransactionForm integration test verifies required fields, type toggle, category selection, and payload shape.
- [ ] A single Playwright E2E test can run end-to-end and reliably creates a transaction.
- [ ] Tests do not use `any` types and keep strict TypeScript.
- [ ] Tests use stable selectors (`data-testid` first) and do not depend on brittle UI copy.

