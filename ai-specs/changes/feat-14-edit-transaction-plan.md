## 📋 Backend Implementation Plan: feat-14 — Edit Transaction (Sync + Local-First Fallback)

### 1. Analysis & Design
* **Goal**: Add a protected transaction update endpoint so transaction edits persist to the database, while keeping the product’s “local edit” UX as a fallback when offline or when the API fails.
* **Current state**:
  * Backend supports **create/list/delete** transactions only (`/transactions` + `/transactions/{id}` DELETE).
  * Frontend supports **edit** but it is **local-only** (stored in `localStorage` and not synced).
* **Desired behavior**:
  * Primary: user edits a transaction and the backend persists it (DB is the source of truth).
  * Fallback: if the update request fails (network/timeout), the edit is saved locally and marked as “pending sync”.
* **Affected Files**:
  * `backend/app/schemas.py` (add update schema)
  * `backend/app/crud.py` (add update CRUD)
  * `backend/app/routers/transactions.py` (add PATCH/PUT route)
  * `backend/tests/test_transactions.py` (add update tests)
  * `ai-specs/specs/api-spec.yml` (document the update endpoint)
  * (Optional docs) `TECHNICAL_DOCUMENTATION.md` (note that edit is now server-backed, with local fallback)
  * **Zefa (chat)**: `backend/app/ai/tools.py`, `backend/app/ai/gateway.py`, `backend/app/chat/schemas.py`, `backend/tests/test_chat_agent.py`
* **Dependencies**: None (reuse FastAPI/Pydantic/SQLAlchemy).

* **Scope — Edit and delete via Zefa (chat)**  
  Editing and deletion must also be available through the Zefa chat assistant. User feedback in the chat (cards, copy) must be consistent with the operation performed (create vs update vs delete).

---

### 2. Data Layer (Models & Schemas)
* **Database Changes**:
  * None required. The `transactions` table already contains all editable fields.
  * Migration/Alembic: still MVP `create_all()`; no schema evolution needed for this feature.

* **Pydantic Schemas (`schemas.py`)**:
  * **Input Schema**: `TransactionUpdate`
    * Fields (all optional for PATCH): `amount?: Decimal`, `type?: "INCOME"|"EXPENSE"`, `category?: str`, `description?: str | None`, `occurred_at?: datetime | None`
    * Validation:
      * If `amount` provided: must be \(> 0\).
      * If `type` provided: must be `INCOME` or `EXPENSE`.
      * If `category` provided: must be non-empty after trim.
  * **Output Schema**: reuse existing `TransactionResponse`.

Notes:
* Prefer **PATCH** semantics (partial update) to match the existing frontend editing UX (user may change only some fields).
* Keep response consistent with the rest of the API (`TransactionResponse`).

---

### 3. Business Logic (`crud.py` / Services)
* **Function**: `update_user_transaction`
  * **Input**: `db: AsyncSession`, `transaction_id: UUID`, `user_id: UUID`, `tx_update: TransactionUpdate`
  * **Logic**:
    1. Fetch the transaction by `id` AND `user_id` (ownership enforcement).
    2. If not found, return `None` (route maps to 404).
    3. For each provided field in `tx_update`, update the SQLAlchemy object.
    4. Commit and refresh.
    5. Return the updated `Transaction`.
  * **Validation**:
    * Rely on Pydantic validators for field-level validation.
    * If no fields are provided, either:
      * treat as no-op and return the current transaction, or
      * reject with 400 (“At least one field must be provided”).
    * For MVP, prefer **no-op success** (less friction) unless it breaks UI expectations.

---

### 4. API Layer (`routers/transactions.py`)
* **Endpoint**: `PATCH /transactions/{transaction_id}`
* **Status Code**: `200 OK`
* **Auth**: Yes (`Depends(get_current_user)`)
* **Request**: `TransactionUpdate`
* **Response**: `response_model=TransactionResponse`
* **Errors**:
  * `401`: missing/invalid token (handled by auth dependency).
  * `404`: transaction not found (or not owned by user).
  * `422`: schema validation (FastAPI/Pydantic).

OpenAPI spec update:
* Add `PATCH /transactions/{transaction_id}` to `ai-specs/specs/api-spec.yml` with request/response schemas.

---

### 5. Testing Strategy (`tests/`)
* **File**: extend `backend/tests/test_transactions.py`
* **Test Case 1 — Success**:
  * Create a transaction, PATCH it (e.g., change `description` + `category`), assert response contains updated fields.
* **Test Case 2 — Partial update**:
  * PATCH only `description`, ensure other fields unchanged.
* **Test Case 3 — Unauthorized**:
  * PATCH without token returns 401.
* **Test Case 4 — Ownership isolation**:
  * User B attempts to PATCH user A’s transaction → 404.
* **Test Case 5 — Not found**:
  * PATCH random UUID → 404.
* **Test Case 6 — Validation**:
  * PATCH `amount=-1` → 422 (or 400 if explicitly checked).

---

### 6. Step-by-Step Implementation Guide
1. Add `TransactionUpdate` schema in `backend/app/schemas.py` with validators.
2. Implement `update_user_transaction()` in `backend/app/crud.py`.
3. Add `PATCH /transactions/{transaction_id}` route in `backend/app/routers/transactions.py`.
4. Update `ai-specs/specs/api-spec.yml` to include the update endpoint.
5. Extend `backend/tests/test_transactions.py` with update coverage.
6. Run `pytest` and ensure all existing tests still pass.
7. **Zefa tools**: In `backend/app/ai/tools.py`, add `update_transaction` and `delete_transaction` tool definitions and implementations; add `UpdateTransactionInput` and `DeleteTransactionInput` in `backend/app/chat/schemas.py`; extend `execute_tool` to dispatch to them (using the new CRUD and existing delete).
8. **Zefa metadata and UI events**: In `backend/app/chat/schemas.py`, extend `ChatAssistantMeta` with `did_update_transaction`, `updated_transaction_id`, `did_delete_transaction`, `deleted_transaction_id`. In `backend/app/ai/gateway.py`, after executing `update_transaction` / `delete_transaction`, set these flags and append appropriate `ChatUiEvent` entries with pt-BR title/subtitle consistent with the operation.
9. Add chat-agent tests for update and delete tool execution and metadata.

---

### 7. Validation Checklist
- [ ] Endpoint is protected and enforces ownership (`user_id` scoping).
- [ ] Partial updates work (PATCH) and validations are enforced.
- [ ] API spec matches implementation (`api-spec.yml`).
- [ ] Backend tests cover success + auth + isolation + validation.
- [ ] Zefa tools `update_transaction` and `delete_transaction` work and set metadata + UI events with feedback consistent with the operation (pt-BR).

---

### 8. Zefa Chat Agent — Edit and Delete via Chat

* **Goal**: The user must be able to **edit** and **delete** transactions by talking to Zefa (e.g. “altera a transação X para 50 reais”, “remove a última despesa de alimentação”). The assistant must execute the operation and return **feedback consistent with the action** (create / update / delete).

* **Affected files**:
  * `backend/app/ai/tools.py` (new tools + `execute_tool` dispatch)
  * `backend/app/chat/schemas.py` (optional: extend `ChatAssistantMeta`; extend `ChatUiEvent` if needed)
  * `backend/app/ai/gateway.py` (metadata and `ui_events` for update/delete)

#### 8.1 New tools (Zefa)

* **update_transaction**
  * **Description**: Update an existing transaction by id (amount, type, category, description, occurred_at). User must identify the transaction (e.g. by id from list, or “a última despesa de X”).
  * **Parameters**: `transaction_id` (required, UUID string), then same optional fields as `TransactionUpdate`: `amount?`, `type?`, `category?`, `description?`, `occurred_at?`.
  * **Implementation**: Call `update_user_transaction(db, transaction_id, user_id, tx_update)`. Return updated transaction payload (same shape as create) or clear error if not found.
  * **Input schema**: Add `UpdateTransactionInput` in `backend/app/chat/schemas.py` (e.g. `transaction_id: UUID`, optional fields aligned with `TransactionUpdate`).

* **delete_transaction**
  * **Description**: Delete a transaction by id. Use when the user asks to remove, exclude, or delete a specific transaction.
  * **Parameters**: `transaction_id` (required, UUID string).
  * **Implementation**: Call existing `delete_user_transaction(db, transaction_id, user_id)`. Return e.g. `{ "deleted": true, "id": "..." }` or error if not found.
  * **Input schema**: Add `DeleteTransactionInput` in `backend/app/chat/schemas.py` (`transaction_id: UUID`).

#### 8.2 Metadata and UI events (backend)

* **ChatAssistantMeta** (extend):
  * `did_update_transaction: bool = False`
  * `updated_transaction_id: Optional[UUID] = None`
  * `did_delete_transaction: bool = False`
  * `deleted_transaction_id: Optional[UUID] = None`

* **After executing tools in `gateway.py`**:
  * For **update_transaction**: set `metadata.did_update_transaction = True`, `metadata.updated_transaction_id`, and append a `ChatUiEvent` with:
    * `type="success_card"` (or a dedicated type if frontend distinguishes)
    * `title` / `subtitle` in **pt-BR** consistent with update (e.g. “Atualizado.” / “Transação atualizada.”)
    * `data.transaction` = updated transaction payload (same shape as create).
  * For **delete_transaction**: set `metadata.did_delete_transaction = True`, `metadata.deleted_transaction_id`, and append a `ChatUiEvent` with:
    * Type suitable for “deletion” (e.g. `info_card` or `success_card` with neutral/warning accent)
    * `title` / `subtitle` in **pt-BR** consistent with delete (e.g. “Removido.” / “Transação excluída.”)
    * `data` can include `deleted_transaction_id` and optionally a minimal snapshot (id, amount, category) for the card.

* **Assistant reply text**: The final LLM reply should naturally confirm the action (e.g. “Atualizei a transação.” / “Removi a transação.”). The system prompt or few-shot examples can state that after update/delete tools, the assistant must confirm in short, friendly pt-BR.

#### 8.3 Tests (chat agent)

* **File**: `backend/tests/test_chat_agent.py` (or equivalent)
* **Test Case — update via chat**: Mock or trigger a message that leads to `update_transaction` tool call; assert response `meta.did_update_transaction` and `meta.ui_events` contain an event with update-appropriate title/subtitle.
* **Test Case — delete via chat**: Same for `delete_transaction`; assert `meta.did_delete_transaction` and UI event for delete.

---

## 🎨 Frontend Implementation Plan: feat-14 — Edit Transaction (Sync + Local-First UX)

### 1. Analysis & Design
* **Goal**: Convert transaction editing from “local-only” to “sync to backend”, while keeping local edits as a supported fallback (offline/failed sync).
* **Route**: `frontend/app/transactions/page.tsx`
* **Current UX**:
  * Editing is supported via `EditTransactionDrawer`.
  * Saves update local state + persists to `localStorage` (`zefa_local_edits`) and shows “saved locally” toast.
* **Target UX**:
  * On save:
    * update UI immediately (fast feedback),
    * attempt backend PATCH,
    * on success: confirm synced (toast) + clear local pending edit for that item.
    * on failure: keep edit stored locally as “pending sync” + show toast “Saved locally, sync pending”.
* **Responsive Layout**:
  * Keep current drawer pattern (mobile-first). Ensure the save action remains reachable on small screens and not blocked by the keyboard.
* **Server vs Client**:
  * `frontend/app/transactions/page.tsx` remains a **Client Component** (auth guard + API calls).
  * Drawer components remain **Client Components**.

* **Scope — Feedback consistent with operations (including via Zefa)**  
  When the user edits or deletes a transaction **via the chat (Zefa)**, the chat UI must show feedback **consistent with the operation** (created / updated / deleted): e.g. success cards with titles and subtitles in pt-BR that match the action, and optional refresh or hint to see the list in “Transações”.

---

### 2. Component Architecture
* **Existing Components to touch**:
  * `frontend/app/transactions/page.tsx`:
    * Replace “local-only edit” with “local-first + sync” behavior.
  * `frontend/components/transactions/EditTransactionDrawer.tsx`:
    * Ensure it can submit only changed fields (optional optimization) OR continue sending full transaction update.
  * `frontend/components/transactions/TransactionItem.tsx` (optional):
    * Show a small badge for “pending sync” edits (e.g., “Local” / “Sync pendente”).
  * **Chat (Zefa feedback)**:
    * `frontend/components/chat/TransactionConfirmationCard.tsx` (or new cards for update/delete), `frontend/lib/hooks/useChat.ts`, and types in `frontend/lib/types.ts` / `frontend/lib/types/api.ts`: extend so that create/update/delete events from `meta.ui_events` render with consistent pt-BR copy and layout.

* **ShadcnUI primitives**:
  * `Badge` (if present), `Button`, `Card`, `Dialog/Sheet` depending on current drawer implementation.

---

### 3. State & Data Fetching
* **API Interactions**:
  * Endpoint: `PATCH /transactions/{id}`
  * Use `api` from `@/lib/api` (Axios interceptor already injects JWT and handles 401).

* **Local State (Transactions page)**:
  * `transactions: Transaction[]` (existing)
  * `pendingEdits: Record<string, PendingEdit>` (derived from localStorage on mount/load)
    * `PendingEdit` includes: `transaction: Transaction`, `updatedAt: string`, `syncStatus: "pending" | "failed"`

* **Local persistence**:
  * Continue using localStorage, but store explicit metadata to support reliable resync:
    * Key proposal: `zefa_local_edits_v2`
    * Value: `{ [transactionId: string]: { transaction: Transaction; updatedAt: string; syncStatus: "pending"|"failed" } }`

* **Sync strategy (MVP)**:
  * When the user saves an edit:
    1. apply it to UI state immediately,
    2. persist to localStorage as pending,
    3. attempt PATCH to backend,
    4. on success: remove pending entry (or mark synced) and toast success.
  * When transactions load:
    1. fetch server transactions,
    2. overlay local pending edits on top (so user sees their local changes),
    3. optionally attempt a best-effort background sync of pending edits (one-by-one) to clear backlog.

Conflict handling (simple MVP rules):
* If backend returns `404` on sync (transaction deleted): remove local pending edit and toast.
* If backend returns `422` (validation): keep local pending edit and show error toast prompting the user to open edit again.

---

### 4. TypeScript Interfaces and Mappers
* **API types** (`frontend/lib/types/api.ts`):
  * Add `ApiTransactionUpdate` (partial):
    * `amount?: number`, `type?: "INCOME"|"EXPENSE"`, `category?: string`, `description?: string | null`, `occurred_at?: string | null`
* **Mapper** (`frontend/lib/types/api.ts` or dedicated file):
  * Add `mapUiTransactionToApiUpdate(updated: Transaction, original?: Transaction): ApiTransactionUpdate`
    * If `original` is available, send only changed fields.
    * Otherwise, send full editable fields.

---

### 5. Chat Feedback — Edit and Delete via Zefa

* **Goal**: When Zefa executes **update_transaction** or **delete_transaction**, the chat must show feedback **consistent with the operation** (same pattern as `transaction_created`): a card and/or inline message with copy in pt-BR that reflects “transação atualizada” or “transação excluída”.

* **Backend contract**: Response envelope `meta` will include:
  * `did_update_transaction`, `updated_transaction_id`, and `ui_events[]` with an event for update (e.g. `success_card` with `data.transaction`).
  * `did_delete_transaction`, `deleted_transaction_id`, and `ui_events[]` with an event for delete (e.g. `info_card` or `success_card` with delete-oriented title/subtitle and optional `data`).

* **Frontend responsibilities**:
  * **Normalize meta**: In `useChat` or chat service, map `meta.ui_events` (and flags) so the UI can distinguish create vs update vs delete.
  * **Render cards by operation type**:
    * **Created**: Keep existing `TransactionConfirmationCard` (e.g. “Tá na mão.” / “Despesa registrada…”).
    * **Updated**: Reuse or extend the same card component with an “updated” variant: title/subtitle like “Atualizado.” / “Transação atualizada.” and show the updated transaction (amount, category, etc.).
    * **Deleted**: Show a compact “deleted” card (e.g. “Removido.” / “Transação excluída.”) with optional id/category for reference; no need to show full transaction.
  * **Copy (pt-BR)**: All user-facing strings for create/update/delete must be consistent and clear (e.g. “Transação criada.”, “Transação atualizada.”, “Transação excluída.”).
  * **Optional**: After showing an update/delete card, suggest “Veja em Transações” or refresh transaction list if the user has the list open (can be a later enhancement).

* **Components**:
  * Extend `TransactionConfirmationCard` to accept a variant or `uiEvent.type`/payload so it can render “created” | “updated” | “deleted” with the right title, subtitle, and layout (e.g. for delete, no amount highlight).
  * Or add small sibling components `TransactionUpdatedCard` and `TransactionDeletedCard` that receive the same `uiEvent` shape and render the appropriate copy.

* **Types** (`frontend/lib/types.ts` or `api.ts`): Extend `meta` / `uiEvent` types to include the new event kinds and optional `deleted_transaction_id` / `updated_transaction_id` for consistency with backend.

---

### 6. Implementation Steps
1. **Backend dependency readiness (contract)**
   * Ensure the backend endpoint exists (`PATCH /transactions/{id}`) and the OpenAPI spec is updated.
2. **Add API update call**
   * In `frontend/app/transactions/page.tsx`, change `handleSaveEdit` to call `api.patch(...)`.
3. **Local-first persistence**
   * Persist edits to `localStorage` as pending before/while syncing.
4. **Pending sync UI (optional but recommended)**
   * Show a subtle “pending sync” indicator in the transaction list item.
5. **Resync on page load (best-effort)**
   * After loading transactions, overlay pending edits and try to sync them in the background.
6. **Update tests**
   * Add/adjust frontend integration tests for the edit save flow.
   * Extend Playwright E2E (`frontend/e2e/create-transaction.spec.ts`) with an “edit transaction → reload → edit persists” scenario (or a separate `edit-transaction.spec.ts`).
7. **Chat feedback for update/delete (Zefa)**
   * Extend chat meta types and `TransactionConfirmationCard` (or add updated/deleted card components) so that create/update/delete events show the correct pt-BR copy and layout.
   * Ensure `useChat` or chat service passes through `meta.ui_events` and that the message list renders the appropriate card for each event type.

---

### 7. Validation Checklist
- [ ] Uses `api` instance from `@/lib/api` (Axios).
- [ ] Edits persist to backend when online and authorized.
- [ ] Local fallback persists edits when sync fails and overlays them on reload.
- [ ] No `any` types; API update payload is strictly typed.
- [ ] UX remains responsive-first and drawer behavior remains usable on mobile.
- [ ] **Zefa (chat)**: When the user edits or deletes a transaction via chat, the chat shows feedback consistent with the operation (created / updated / deleted) with pt-BR copy and appropriate card or message.
