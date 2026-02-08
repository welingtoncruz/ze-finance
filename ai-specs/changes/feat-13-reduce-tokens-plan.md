## 📋 Backend Implementation Plan: feat-13 — Reduce AI Token Usage (Cost Guardrails)

### 1. Analysis & Design
* **Goal**: Reduce LLM token consumption (and monthly cost) while preserving chat quality and tool functionality by adding hard caps, shrinking context, compressing tool payloads, and enabling summary-based memory.
* **Primary token cost drivers identified (current code)**:
  - **Hardcoded context window**: `POST /chat/messages` always loads 20 messages (`limit=20`) instead of using `AI_MAX_CONTEXT_MESSAGES`. This sets a high baseline token cost per request.
  - **No output cap for OpenAI/Gemini**: `_call_openai()` does not pass `max_tokens`; Gemini config does not set output token limits. Responses can be unnecessarily long.
  - **Anthropic output cap too high**: `_call_anthropic()` uses `max_tokens=4096` (expensive default).
  - **Tools always attached**: first LLM call always includes `TOOLS`, so the tool schema is repeatedly injected even for non-finance messages.
  - **Tool results are verbose**: tool result payload is serialized with `indent=2` and injected as a large user message, inflating tokens in the second LLM call.
  - **Summarization is not implemented**: `ChatConversationSummary` exists but `maybe_update_conversation_summary()` is a placeholder, so there is no safe way to reduce context further without losing memory.

* **Affected Files**:
  - `backend/app/chat/routes.py` (use env-driven context limit; tools/context heuristics wiring)
  - `backend/app/ai/gateway.py` (provider params, output caps, tools gating, tool result compaction)
  - `backend/app/chat/crud.py` (implement summarization + summary update scheduling)
  - `backend/app/models.py` (optional: additional metadata fields if needed; otherwise unchanged)
  - `backend/.env.example` (add new env vars)
  - `backend/README.md` (document new env vars + cost guardrails)
  - `backend/tests/test_chat_agent.py` (integration-style tests with mocked provider calls)

* **Dependencies**:
  - No new packages required (reuse existing provider SDKs already in `requirements.txt`).

* **New/Updated Environment Variables**:
  - **Existing (wire correctly)**:
    - `AI_MAX_CONTEXT_MESSAGES` (already defined; ensure it is used by routes)
    - `AI_SUMMARY_TOKEN_BUDGET` (already defined; enforce as summary output limit)
  - **Add**:
    - `AI_MAX_OUTPUT_TOKENS` (default: `600`) — hard cap for assistant output for OpenAI/Gemini/Anthropic calls
    - `AI_TOOLS_MODE` (default: `heuristic`) — `always | heuristic | never`
    - `AI_TOOL_RESULTS_MAX_CHARS` (default: `4000`) — upper bound for tool result text injected into the second call
    - `AI_CONTEXT_PACK_TX_LIMIT` (default: `6`) — smaller default than 12 to reduce `FINANCE_CONTEXT_PACK` size

---

### 2. Data Layer (Models & Schemas)
* **Database Changes**:
  - **No schema changes required** for the core token reduction (limits + heuristics).
  - **Optional (phase 2)**: Add an `ai_usage_events` table to persist token usage by `(user_id, conversation_id, provider, model, created_at)` for budgets/analytics. This is optional and can be deferred to keep MVP lean.
* **Pydantic Schemas**:
  - No changes required for the chat API envelope.

---

### 3. Business Logic (`crud.py` / Services)

#### 3.1 Context window wiring (cheap win)
* **Function**: `list_recent_messages(db, user_id, conversation_id, limit)`
  - **Change**: ensure `limit` is read from `AI_MAX_CONTEXT_MESSAGES` (routes layer) rather than hardcoded.

#### 3.2 Implement summary-based memory (enables smaller context window)
* **Function**: `maybe_update_conversation_summary(db, user_id, conversation_id, max_messages)`
  - **Goal**: When total message count grows beyond `max_messages`, generate/update a compact summary and rely less on raw history.
  - **Logic**:
    1. Count messages for `(user_id, conversation_id)`.
    2. If `count <= max_messages`, return.
    3. Fetch an “older slice” of messages to summarize (e.g., everything except the last `max_messages`, excluding `role="system"` and optionally excluding large `tool_result` payloads).
    4. Call the LLM with a **minimal summarization prompt** and the older slice, with output capped at `AI_SUMMARY_TOKEN_BUDGET`.
    5. Persist summary via `update_conversation_summary()`.
    6. (Optional) Mark older messages as summarized via `content_type="summarized"` or keep them as-is but never include them again in context assembly.
  - **Validation**:
    - Summary must be **short**, **factual**, and include key entities (amounts, categories, dates) and unresolved clarifications.

#### 3.3 Tool payload compaction (reduce second-call tokens)
* **Function**: `compact_tool_result(result: Any) -> str`
  - **Logic**:
    - Serialize without pretty-printing (no `indent=2`).
    - Truncate arrays (e.g., top N items).
    - Truncate long strings and enforce `AI_TOOL_RESULTS_MAX_CHARS`.
  - **Output**: a compact, stable string suitable for prompt injection.

---

### 4. API Layer (`chat/routes.py` + `ai/gateway.py`)

#### 4.1 Use env-driven context size
* **Endpoint**: `POST /chat/messages`
* **Change**:
  - Replace `limit=20` with `limit=AI_MAX_CONTEXT_MESSAGES` (read from env or from `app.ai.gateway` config constant).

#### 4.2 Add output token caps for all providers
* **Where**: `backend/app/ai/gateway.py`
* **Changes**:
  - **OpenAI**: include `max_tokens=AI_MAX_OUTPUT_TOKENS` in `chat.completions.create(...)`.
  - **Anthropic**: set `max_tokens=AI_MAX_OUTPUT_TOKENS` (replace the hardcoded 4096).
  - **Gemini**: set output limit in `GenerateContentConfig` (field name depends on library version; validate with current `google-genai` types).

#### 4.3 Only attach tools when needed (avoid tool schema tax)
* **Where**: `backend/app/ai/gateway.py` + `backend/app/chat/routes.py`
* **Rule**:
  - If `AI_TOOLS_MODE=always`: attach `TOOLS`.
  - If `AI_TOOLS_MODE=never`: attach no tools.
  - If `AI_TOOLS_MODE=heuristic` (default):
    - Attach `TOOLS` only when `include_context_pack` is true OR user text matches finance intents (balance/transactions/create/analyze).
* **Expected impact**: significant token reduction for generic chat turns.

#### 4.4 Reduce `FINANCE_CONTEXT_PACK` footprint
* **Where**: `backend/app/ai/context.py`
* **Changes**:
  - Default `tx_limit` reduced via env `AI_CONTEXT_PACK_TX_LIMIT`.
  - Ensure the context pack remains “small + high signal” (balance, MTD totals, top categories, last few transactions).

#### 4.5 Tool results injection: shorten and standardize
* **Where**: `backend/app/ai/gateway.py`
* **Changes**:
  - Replace pretty JSON dumps with compact serialization.
  - Keep the second-call “analysis instruction” short (avoid repeated boilerplate).
  - (Optional phase 2) Use provider-native tool-result message formats instead of embedding results as a user message (larger refactor, but can reduce prompt verbosity and improve correctness).

---

### 5. Testing Strategy (`tests/`)
* **File**: `backend/tests/test_chat_agent.py`
* **Test Case 1 — Context limit wired**
  - Assert that the route calls `list_recent_messages(..., limit=AI_MAX_CONTEXT_MESSAGES)` (patch env or config).
* **Test Case 2 — Output token caps**
  - Mock provider API call and assert request includes `max_tokens=AI_MAX_OUTPUT_TOKENS` (OpenAI) and equivalent for other providers.
* **Test Case 3 — Tools gating**
  - Send a non-finance message and assert `tools` is omitted when `AI_TOOLS_MODE=heuristic`.
  - Send a finance message (e.g., “saldo”) and assert `tools` is included.
* **Test Case 4 — Tool results compaction**
  - Simulate a tool result with long payload and assert the injected prompt content respects `AI_TOOL_RESULTS_MAX_CHARS`.
* **Test Case 5 — Summarization trigger (integration-style)**
  - Create > `AI_MAX_CONTEXT_MESSAGES` chat messages, run `maybe_update_conversation_summary()`, and assert a summary row is written/updated.

---

### 6. Step-by-Step Implementation Guide
1. Update `.env.example` and `backend/README.md` with new env vars and defaults.
2. Replace the hardcoded `limit=20` in `backend/app/chat/routes.py` with `AI_MAX_CONTEXT_MESSAGES`.
3. Add `AI_MAX_OUTPUT_TOKENS` and pass it to provider calls in `backend/app/ai/gateway.py` (OpenAI/Anthropic/Gemini).
4. Implement `AI_TOOLS_MODE` gating so tool definitions are only attached when needed.
5. Implement tool-result compaction helper and enforce `AI_TOOL_RESULTS_MAX_CHARS`.
6. Reduce context pack size using `AI_CONTEXT_PACK_TX_LIMIT`.
7. Implement `maybe_update_conversation_summary()`:
   - Add a minimal summarization prompt.
   - Enforce `AI_SUMMARY_TOKEN_BUDGET`.
   - Call it after persisting assistant messages (or on a schedule hook) so summaries stay fresh.
8. Add/adjust tests in `backend/tests/test_chat_agent.py` to lock in cost guardrails.

---

### 7. Validation Checklist
- [ ] `AI_MAX_CONTEXT_MESSAGES` is the single source of truth for server-side context window size.
- [ ] All providers enforce `AI_MAX_OUTPUT_TOKENS` (no unbounded assistant output).
- [ ] Tools are not included for non-finance messages when `AI_TOOLS_MODE=heuristic`.
- [ ] Tool results are compact and capped by `AI_TOOL_RESULTS_MAX_CHARS`.
- [ ] `FINANCE_CONTEXT_PACK` size is reduced and still provides high-signal context.
- [ ] Summarization works and keeps `ChatConversationSummary` small and useful.
- [ ] Existing chat flows remain functional (tools, transaction creation, metadata events).
- [ ] Tests pass locally.

