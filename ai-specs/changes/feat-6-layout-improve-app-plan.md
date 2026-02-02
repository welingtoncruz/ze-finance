## 🎨 Frontend Implementation Plan: feat-6 layout improve app

### 1. Analysis & Design

* **Goal**: Improve the **Transactions** experience (add, edit, delete) and align UX with `ze-finance-v0`:
  * **Categories** are selected via an **icon + text grid** (not a `<select>`).
  * **Edit** is available from the list (tap on mobile / hover actions on desktop).
  * **Delete** remains available (swipe on mobile + explicit action on desktop), with safe confirmation UX.
  * **Chat**: remove the top “Coming soon” banner that breaks layout; the **Zefa bot** should communicate “coming soon” inside the chat flow instead.
  * **Mobile logout** must be possible (currently it is only exposed on desktop sidebar).
  * Preserve the project’s **responsive-first** approach and keep transitions/skeletons smooth.

* **Routes**:
  * `frontend/app/transactions/page.tsx`
  * `frontend/app/chat/page.tsx`
  * Layout/navigation: `frontend/components/layout/AppShell.tsx`, `frontend/components/layout/BottomNavigation.tsx`

* **Responsive Layout**:
  * **Mobile**:
    * Transactions list with FAB.
    * Add/Edit opens a **bottom drawer** (existing `SwipeDrawer`).
    * Category picker as **tap-friendly icon grid**.
    * Logout accessible via a **mobile account drawer** reachable from bottom navigation.
  * **Tablet/Desktop**:
    * Keep `DesktopSidebar`.
    * Transactions: hover actions (edit/delete) and richer summary cards like v0.
    * Add/Edit can reuse the same drawer component but render as a **centered panel** (`max-w-*` + backdrop) for desktop if desired.

* **Server vs Client**:
  * Transactions, Chat, Navigation menu are **Client Components** (`'use client'`) due to state, effects, and navigation interactions.

### 2. Component Architecture

* **New Components**:
  * `frontend/lib/transactions/categories.ts`
    * Define a typed list of categories with **value (stored/sent to API)**, **label (pt-BR)**, and **Lucide icon**.
    * Keep values compatible with current UI + backend usage (today categories appear as strings like `"Salary"`, `"Groceries"`, etc.).
  * `frontend/components/transactions/CategoryPicker.tsx`
    * **Responsibility**: render the icon-grid category selector (compact + regular variants).
    * **Props**: `value: string`, `onChange(value: string): void`, `type: TransactionType`, `variant?: "compact" | "regular"`.
  * `frontend/components/transactions/TransactionForm.tsx`
    * Shared form for Add/Edit: amount, type toggle, category picker, date, description.
    * **Props**: `mode: "create" | "edit"`, `initial?: Partial<Transaction>`, `onSubmit(data: Omit<Transaction, "id"> | Transaction): Promise<void> | void`.
  * `frontend/components/transactions/EditTransactionDrawer.tsx`
    * Wrapper that uses existing `SwipeDrawer` + `TransactionForm` to edit a selected transaction.
    * **Props**: `transaction`, `isOpen`, `onClose`, `onSave`.
  * `frontend/components/layout/MobileAccountDrawer.tsx`
    * Uses `SwipeDrawer` to provide mobile-only actions:
      * **Logout** (calls `useAuth().logout()`).
      * Optional: theme toggle and quick links.

* **Refactor / Updates**:
  * `frontend/components/transactions/QuickAddTransaction.tsx`
    * Replace `<select>` with `CategoryPicker` (icon grid) to match v0.
    * Standardize copy to **pt-BR** (UI-facing rule).
  * `frontend/components/transactions/TransactionsScreen.tsx`
    * Wire `onEditTransaction` into the list UI:
      * Desktop: show edit/delete actions on hover (v0 pattern).
      * Mobile: tap row opens edit drawer (keep swipe-to-delete as-is).
    * Improve summary cards and spacing to better use mobile screen (v0 density/visual rhythm).
  * `frontend/components/transactions/TransactionItem.tsx`
    * Add optional `onClick` for edit.
    * Add optional trailing action slot for desktop hover controls (edit/delete icons).
    * Ensure date/copy are **pt-BR** (e.g., “Hoje”, “Ontem” instead of “Today”, “Yesterday”).
  * `frontend/app/transactions/page.tsx`
    * Replace the “edit coming soon” stub with the real edit UX.
    * Because the backend currently has **no update endpoint**, implement:
      * **Local-only edit** (update state immediately) + toast explaining sync is coming.
      * Optional: persist local edits to `localStorage` and merge on load to avoid losing edits on refresh.

* **ShadcnUI Primitives**:
  * Already available: `Button`, `Card`, `Input`, `Label`.
  * For this feature, prefer existing `SwipeDrawer` instead of introducing new primitives unless needed.

* **Icons** (Lucide React):
  * Categories: `Wallet`, `ShoppingCart`, `Car`, `Home`, `Zap`, `Heart`, `Film`, `Laptop`, `ShoppingBag`, `CircleDot`
  * Actions: `Pencil`, `Trash2`, `LogOut`, `MoreHorizontal` (or similar for “Menu/Conta”)

### 3. State & Data Fetching

* **API Interactions**:
  * Existing:
    * `GET /transactions?limit=50`
    * `POST /transactions`
    * `DELETE /transactions/{id}`
  * Missing today:
    * No `PUT/PATCH /transactions/{id}` in backend.

* **Local State (Transactions page)**:
  * `transactions: Transaction[]`
  * `isDrawerOpen: boolean` (create)
  * `isEditOpen: boolean`
  * `selectedTransaction: Transaction | null`
  * Optional (if persisting local edits): `localEditsById: Record<string, Partial<Transaction>>`

* **Global Context**:
  * Use `useAuth()` for **logout** from the new mobile account drawer.

### 4. Implementation Steps

1. **Create category source-of-truth**
   * Add `frontend/lib/transactions/categories.ts` with typed category definitions (value + pt-BR label + icon).
   * Add helper `getCategoryLabel(value)` to display labels while keeping stored values stable.

2. **Implement the icon-grid category picker**
   * Add `CategoryPicker.tsx` (regular + compact variants to reuse in add/edit drawers).

3. **Unify add/edit form logic**
   * Add `TransactionForm.tsx` and refactor `QuickAddTransaction.tsx` to use it (or share subcomponents).
   * Ensure add flow uses `CategoryPicker` (no combobox/select).

4. **Add edit UX (drawer + list wiring)**
   * Create `EditTransactionDrawer.tsx`.
   * Update `frontend/app/transactions/page.tsx`:
     * Keep a `selectedTransaction`.
     * On “Save”, update the `transactions` state (local-only) and show a pt-BR toast like “Edição salva localmente. Sincronização em breve.”

5. **Improve list interaction + desktop affordances**
   * Update `TransactionsScreen.tsx` to:
     * Support “tap to edit” on mobile.
     * Add hover actions on desktop (edit/delete buttons aligned to the right).
   * Keep swipe-to-delete behavior, but consider adding a lightweight confirm step to avoid accidental deletions (v0 has explicit confirm patterns).

6. **Fix chat layout + move “coming soon” messaging into Zefa**
   * Update `frontend/app/chat/page.tsx`:
     * Remove the top `ComingSoonBanner`.
     * Avoid fixed `calc(100vh-...)` height hacks; let the chat fill available space naturally.
   * Update `frontend/components/chat/ZefaChatScreen.tsx`:
     * Add an initial assistant message (or a follow-up message) where Zefa explains that some features (e.g., Insights) are “em breve”, instead of a page banner.

7. **Add mobile logout**
   * Add `MobileAccountDrawer.tsx` using `SwipeDrawer` and integrate it into `BottomNavigation.tsx` as a “Conta/Menu” entry.
   * Update `AppShell.tsx` so mobile navigation is available consistently (including on `/chat`), ensuring users can always reach logout.

8. **Polish: transitions and skeletons**
   * Keep `animate-slide-up`, `theme-transition`, and other existing motion utilities consistent across drawers and list updates.
   * If `SkeletonLoader` is too generic for Transactions, add a lightweight `TransactionsSkeleton` to match v0’s dedicated skeleton layout.

### 5. Validation Checklist

- [ ] Uses `api` instance from `@/lib/api` (Axios).
- [ ] Transactions add uses **icon-grid category selection** (no `<select>` / combobox).
- [ ] Edit flow works end-to-end in UI (drawer opens, fields prefill, save updates list).
- [ ] No backend update calls are made unless/until an update endpoint exists (graceful local-only fallback).
- [ ] Chat page has **no top banner** that constrains viewport height; Zefa communicates “coming soon” inside chat messages.
- [ ] Mobile users can **logout** (reachable from bottom navigation/account drawer).
- [ ] Layout is responsive across mobile/tablet/desktop (no “phone frame” constraint on desktop).
- [ ] No `any` types in TypeScript.
