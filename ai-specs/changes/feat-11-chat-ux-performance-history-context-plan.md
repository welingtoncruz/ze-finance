## 📋 Backend Implementation Plan: feat-11 — Chat UX Fixes (Recency, Context Integrity, Performance Guardrails)

### 1. Analysis & Design

* **Goal**: Fix production UX regressions observed during chat testing:
  - Ensure the LLM sees the **most recent** conversation turns (no “old reply” behavior)
  - Prevent **duplicate last user message** in the LLM context
  - Keep API contract stable while improving internal context assembly

* **Root causes observed**
  - `list_recent_messages()` was ordering `created_at.asc()` and applying `limit`, effectively returning the **oldest** N messages.
  - Routes persisted the user message, then loaded recent messages (including that new message), and `gateway.process_chat_message()` appended the `user_message` again → **duplication**.

* **Affected files**
  - `backend/app/chat/crud.py`
  - `backend/app/chat/routes.py`
  - (Optional hardening) `backend/app/ai/gateway.py`

* **Dependencies**
  - None

* **Environment variables**
  - No changes required for this plan.

---

### 2. Data Layer (Models & Schemas)

* **Database changes**
  - None.

* **Pydantic schemas**
  - No schema changes required (behavior-only fix).

---

### 3. Business Logic (`crud.py` / Services)

* **Function**: `list_recent_messages(db, user_id, conversation_id, limit)`
  - **Problem**: ordering ascending + limit returned oldest messages.
  - **Fix**:
    - Query **newest N** messages via `order_by(ChatMessage.created_at.desc()).limit(limit)`
    - Reverse the resulting list in Python to return chronological order (oldest → newest) to the gateway.
  - **Expected outcome**: LLM context always includes the latest turns, preventing “stale answer” regressions.

---

### 4. API Layer (`chat/routes.py`)

* **Endpoints**
  - Keep existing contracts:
    - `POST /chat/messages` (v1)
    - `POST /chat/messages/v2` (v2)

* **Context integrity fix**
  - After persisting the user message, `list_recent_messages()` returns messages including the just-created user message.
  - To avoid duplication (since gateway appends `user_message` separately), exclude the newly persisted message **by ID** when building `recent_messages` passed to the gateway.

---

### 5. Testing Strategy (`tests/`)

* **Recommended tests (minimal, high signal)**
  - **CRUD ordering**
    - Add a test ensuring `list_recent_messages(limit=K)` returns the **last K** messages in chronological order.
  - **Context duplication guard**
    - Add an integration test for `/chat/messages/v2` ensuring the constructed context does not contain the last user message twice (can be validated by instrumenting/patching gateway call inputs in test).

---

### 6. Step-by-Step Implementation Guide

1. Update `backend/app/chat/crud.py` to query newest messages and reverse results.
2. Update `backend/app/chat/routes.py` (v1 and v2) to exclude the just-persisted user message from `recent_messages` passed to the gateway.
3. (Optional) Add a gateway-side guard: if `recent_messages[-1]` equals the current `user_message`, do not append again.
4. Add a minimal backend test for ordering and duplication prevention.

---

### 7. Validation Checklist

- [ ] `list_recent_messages()` returns the newest N messages (not the oldest).
- [ ] LLM context does not include the current user message twice.
- [ ] No API contract changes for `/chat/messages` and `/chat/messages/v2`.
- [ ] Tests pass locally.

---

## 🎨 Frontend Implementation Plan: feat-11 — Chat UX Fixes (Typing Lag, Windowed History, Send Button)

### 1. Analysis & Design

* **Goal**: Improve chat responsiveness and usability without breaking the existing layout:
  - Input typing must feel instant (no keypress lag).
  - On chat open, render only the **last 5 messages**.
  - When the user scrolls up, progressively load older messages from **localStorage** (local-only history source).
  - Send button click must reliably submit (same behavior as Enter).

* **Route**
  - `frontend/app/chat/page.tsx`

* **Responsive layout**
  - Keep existing chat column constraints and sticky header/input.
  - Preserve safe-area spacing (`safe-area-top`, `safe-area-bottom`).

* **Server vs Client**
  - `frontend/app/chat/page.tsx`: Client Component (auth guard).
  - `frontend/components/chat/ZefaChatScreen.tsx`: Client Component (state + scroll + input).

---

### 2. Component Architecture

* **Refactor existing**
  - `frontend/components/chat/ZefaChatScreen.tsx`
    - Add windowing (`visibleCount`) and scroll-to-load behavior.
    - Isolate message list rendering into a memoized child component.
    - Ensure suggestions do not interfere with send button.

* **Refactor existing**
  - `frontend/components/chat/ChatBubble.tsx`
    - Wrap with `React.memo` to reduce re-renders during input typing.

  - `frontend/components/chat/TransactionConfirmationCard.tsx`
    - Wrap with `React.memo` to reduce re-renders during input typing.

* **ShadcnUI primitives**
  - `Button`, `Input`, `Card` (already in use).

---

### 3. State & Data Fetching

* **Local history source**
  - Use existing `useChat` localStorage persistence as the source of truth for message history paging.

* **Windowed rendering**
  - `visibleCount: number` initialized to `5`.
  - `visibleMessages = messages.slice(messages.length - visibleCount)`.
  - When scroll is near the top, increase `visibleCount` (e.g., +10), capped to `messages.length`.

* **Scroll position preservation**
  - Capture `scrollHeight` before increasing `visibleCount`.
  - After render, set `scrollTop` to preserve the current viewport.

* **Send button reliability**
  - Keep form submit handling.
  - Add an explicit `onClick` handler on the submit button to invoke submit logic directly.
  - Ensure suggestion chips render only when input is empty to avoid focus/blur side effects on click.

---

### 4. Implementation Steps

1. Implement message windowing and scroll-to-load in `frontend/components/chat/ZefaChatScreen.tsx`.
2. Add memoized `ChatMessagesList` to isolate message list rendering from input state updates.
3. Wrap `ChatBubble` and `TransactionConfirmationCard` with `React.memo`.
4. Update suggestions rendering condition to include `inputValue.trim() === ""`.
5. Add an explicit send button click handler that calls the same submit logic as Enter.

---

### 5. Validation Checklist

- [ ] Typing feels instant even with long chat history.
- [ ] On open, only last 5 messages render.
- [ ] Scrolling up loads older messages from localStorage without jumping.
- [ ] Send button click submits reliably (same as Enter).
- [ ] Suggestions do not interfere with sending.
- [ ] No `any` types introduced.

