## 📋 Backend Implementation Plan: feat-21 — User messages & feedback (API errors)

### 1. Analysis & Design
* **Goal**: Ensure that all API errors (401, 4xx, 5xx, validation, chat/AI failures, etc.) are exposed to the frontend in a controlled, safe way, while avoiding any leak of internal server details and enabling friendly, localized user messages.
* **Current State**:
  * Backend uses `HTTPException` in several places with reasonably safe `detail` strings, but there is **no global exception handler** for unexpected errors, so FastAPI defaults may expose internal details in some environments.
  * Chat/AI routes sometimes include internal error messages in the `detail` field (e.g. `"AI processing error: {error_msg}"`), which is not ideal for end users.
  * The frontend often reads `error.message` from Axios (e.g. "Request failed with status code 401") instead of a curated error code/message contract.
* **High-Level Strategy**:
  * Introduce a **global exception handling layer** that:
    * Normalizes all unhandled exceptions into a generic 500 response with a **safe** `detail` string.
    * Logs full technical details only on the server side.
  * Standardize a small, explicit set of **error categories / codes** and `detail` patterns that are safe to expose (e.g. `INVALID_CREDENTIALS`, `UNAUTHORIZED`, `VALIDATION_ERROR`, `AI_UNAVAILABLE`).
  * Refine chat/AI routes and other sensitive endpoints to **never** embed internal error messages or stack traces into `detail`.
* **Affected Files**:
  * `backend/app/main.py` (new global exception handlers; optional middleware for error logging).
  * `backend/app/chat/routes.py` (sanitize error details, map to error codes/messages).
  * `backend/app/auth_utils.py`, `backend/app/routers/auth.py`, `backend/app/routers/transactions.py`, `backend/app/routers/user.py` (review and optionally align `HTTPException` details to a consistent set of codes/messages).
  * `PROJECT_DOCUMENTATION.md`, `TECHNICAL_DOCUMENTATION.md` (document error-handling strategy and error codes that are part of the public contract).
* **Dependencies**:
  * No new external packages required; optional small logging improvements using standard library.

### 2. Data Layer (Models & Schemas)
* **Database Changes**:
  * No schema changes are expected for this feature.
* **Pydantic Schemas (`schemas.py`)**:
  * Optionally introduce a reusable **error response schema** for documentation consistency:
    * `ErrorResponse`:
      * `code: str` — machine-friendly error code (e.g. `"INVALID_CREDENTIALS"`, `"UNAUTHORIZED"`, `"AI_UNAVAILABLE"`).
      * `detail: str` — human-readable, localized-agnostic message (in English, following backend standards).
  * Consider reusing `ErrorResponse` as `response_model` where it makes sense for explicit error responses (or at least in OpenAPI examples), while keeping FastAPI’s default for `HTTPException` where appropriate.

### 3. Business Logic (`crud.py` / Services)
* **Error Semantics**:
  * Review core flows (auth, transactions, user profile, chat/AI) to ensure that:
    * **Business validation** issues (e.g. negative amount, missing required data) use `HTTPException` with 4xx codes and **non-technical** `detail`.
    * **Authorization/authentication** errors use consistent codes/messages (e.g. 401 `"Could not validate credentials"`, 401 `"Incorrect email or password"`).
    * **AI/chat** processing errors never propagate library/tool messages in the HTTP `detail`; instead, map them to a small set of codes/messages (e.g. `"AI_UNAVAILABLE"`, `"AI_TIMEOUT"`).
* **Centralized Utilities (optional)**:
  * Add small helper utilities (e.g. `raise_ai_error(...)`, `raise_validation_error(...)`) in a shared module if duplication appears, but keep YAGNI in mind.

### 4. API Layer (`routers/` and `main.py`)
* **Global Exception Handlers in `main.py`**:
  * Add a handler for generic `Exception`:
    * Logs the full stack trace on the server.
    * Returns `status_code=500` and a safe payload, e.g. `{ "detail": "Internal server error" }` or `{ "code": "INTERNAL_ERROR", "detail": "Internal server error" }`.
  * Optionally add specialized handlers for:
    * `RequestValidationError` to normalize validation responses (422) into a simpler shape used by the frontend.
* **Chat/AI Routes**:
  * Replace any `HTTPException` that embeds internal error messages (e.g. from LLM or tool stack) in `detail` with:
    * A generic user-facing `detail` (e.g. `"Erro ao processar mensagem. Por favor, tente novamente."` conceptually; keep technical text in English in code).
    * Optionally an error `code` that the frontend can interpret (e.g. `"AI_UNAVAILABLE"`).
* **Other Routers**:
  * Quickly audit `auth.py`, `transactions.py`, `user.py` for:
    * 5xx responses with potentially sensitive `detail` strings.
    * Opportunities to standardize messages/codes without changing existing business behavior.

### 5. Testing Strategy (`backend/tests/`)
* **Files**:
  * Update or extend:
    * `backend/tests/test_auth_refresh.py` (ensure 401/refresh paths are still correct and do not leak extra details).
    * `backend/tests/test_user_profile.py` (if necessary for standardized validation errors).
  * Add new tests file if needed, e.g.:
    * `backend/tests/test_error_handling.py` for generic/global error handlers.
* **Test Case Ideas**:
  * **Test Case 1 — Unhandled exception**:
    * Arrange: create a dummy route or simulate a code path that raises a plain `Exception`.
    * Act: call the route via `TestClient`.
    * Assert: response is `500`, body contains a **generic** message (no stack, no internal error string).
  * **Test Case 2 — AI/chat error sanitization**:
    * Arrange: mock the AI gateway/tool to throw an internal error message.
    * Act: call chat route.
    * Assert: response is 5xx or 502 with **sanitized** `detail` (e.g. `"Erro ao processar mensagem. Por favor, tente novamente."` conceptually) and no internal error text.
  * **Test Case 3 — Auth error**:
    * Verify that invalid credentials and missing/invalid tokens still return 401 with predictable, non-technical `detail`.
  * **Test Case 4 — Validation error shape (optional)**:
    * If a new `ErrorResponse` is adopted for 422, assert fields and absence of internal details.

### 6. Step-by-Step Implementation Guide
1. **Add Global Exception Handlers**:
   * In `main.py`, register handlers for `Exception` (and optionally `RequestValidationError`) that log technical details server-side and respond with safe, generic payloads.
2. **Sanitize Chat/AI Errors**:
   * In `chat/routes.py`, refactor error handling to:
     * Remove direct inclusion of tool/LLM error messages in `detail`.
     * Map internal failures to a small set of codes/messages.
3. **Audit and Normalize Error Messages**:
   * Review `auth.py`, `transactions.py`, `user.py`, and `auth_utils.py` to:
     * Confirm that 4xx and 5xx details are non-technical and consistent.
     * Introduce error codes where it brings value to the frontend contract.
4. **(Optional) Introduce `ErrorResponse` Schema**:
   * Add a shared error schema in `schemas.py` and reference it in OpenAPI docs or explicit error responses if it improves clarity for frontend integration.
5. **Update Tests**:
   * Add or extend tests to cover:
     * Global handler behavior for unhandled exceptions.
     * Sanitized AI/chat errors.
     * Existing auth/refresh flows to ensure they still behave as expected.
6. **Update Documentation**:
   * Document the error-handling strategy and any public error codes/messages in `PROJECT_DOCUMENTATION.md` and `TECHNICAL_DOCUMENTATION.md`.

### 7. Validation Checklist
- [ ] No internal error messages, stack traces, or implementation details are ever included in HTTP responses to the client.
- [ ] All new/updated error responses follow a consistent shape (status codes + detail, and error `code` if adopted).
- [ ] Auth, profile, transactions, and chat/AI flows preserve their functional behavior while returning safe, non-technical messages.
- [ ] Global exception handlers are covered by tests and do not interfere with FastAPI’s normal 4xx handling.
- [ ] Documentation clearly explains the error contract for frontend consumers.

---

## 🎨 Frontend Implementation Plan: feat-21 — User messages & feedback (API errors)

### 1. Analysis & Design
* **Goal**: Provide **friendly, localized (pt-BR)** feedback to users for all relevant failure scenarios (auth, expired sessions, network issues, server errors, chat errors, invalid input, etc.), while ensuring that no technical details (HTTP codes, stack traces, low-level messages) are displayed directly.
* **Current State**:
  * Login and register pages currently show `err.message` (from Axios), which for 4xx often looks like `"Request failed with status code 401"`.
  * Many screens already use generic toasts like `"Falha ao carregar transações"`, which is good, but the behavior is not centralized or consistent.
  * Chat/AI already maps internal error conditions (TIMEOUT, NETWORK_ERROR, UNAUTHORIZED, etc.) to user-friendly messages inside `useChat`, but this is a one-off pattern.
* **Route / Scope**:
  * Cross-cutting behavior: affects how **all** client components interpret and present API errors.
  * Key routes impacted by UX: `/login`, `/register`, `/transactions`, `/insights`, `/settings`, chat entry points, and any future settings/profile pages.
* **Responsive Layout**:
  * No layout changes; behavior is the same across mobile/tablet/desktop. Only the **content of messages** and consistency of handling are adjusted.
* **Server vs Client**:
  * Error presentation and mapping lives in **client components** and hooks (e.g. login/register pages, `useChat`, transaction screens).
  * Keep `api` Axios instance as a shared integration point for low-level networking, with possible minimal adjustments to how it rejects errors.

### 2. Component Architecture
* **New Utilities / Hooks**:
  * `lib/errors/apiErrorMapper.ts` (or similar):
    * Exports a pure function, e.g. `getUserFriendlyApiError(error: unknown, context?: "auth" | "transaction" | "chat" | "generic"): string`.
    * Encapsulates all Axios/HTTP/status-code parsing and maps to pt-BR messages.
  * Optional React hook wrapper:
    * `useApiErrorMessage()` that just wraps the mapper if React context/state ever becomes relevant.
* **UI Integration Points**:
  * `app/login/page.tsx` and `app/register/page.tsx`:
    * Replace usage of `err.message` by the centralized error mapper.
  * Transaction-related components (`app/transactions/page.tsx`, `components/transactions/TransactionForm.tsx`, etc.):
    * Adjust to use the same mapper where appropriate (toast messages), while keeping some custom copy like `"Falha ao adicionar transação"` when it adds clarity.
  * Chat (`lib/hooks/useChat.ts` + `lib/chat/service.ts`):
    * Already has a mapping mechanism; align its codes/messages with the global error mapper concept where possible.
* **ShadcnUI Primitives**:
  * Continue using existing UI primitives for feedback:
    * Toasts (`sonner`), inline error text in forms, banners/alerts when needed.
  * Ensure error states remain visually consistent (colors, icons, emphasis).

### 3. State & Data Fetching
* **API Interactions**:
  * All API calls continue to use `api` from `@/lib/api`.
  * Error handling logic in `catch` blocks should:
    * Call `getUserFriendlyApiError(error, "auth" | "transaction" | "chat" | "generic")`.
    * Show that message via inline error (forms) or toast, instead of `error.message` or raw `response.data`.
* **Local State**:
  * Forms (login, register, settings) keep their `error: string | null` state, now filled with user-friendly messages.
  * Transaction and insights screens may not need new state; toasts are usually enough.
* **Global Context**:
  * `AuthContext` can remain focused on auth data; keep error mapping in the UI/hook layer rather than pushing it into context for now.

### 4. Implementation Steps
1. **Create Central Error Mapper Utility**:
   * Add a new module (e.g. `lib/errors/apiErrorMapper.ts`) which:
     * Detects Axios errors (`axios.isAxiosError`) and reads:
       * `response?.status` (HTTP code).
       * Optionally `response?.data?.code` / `response?.data?.detail` when those fields follow the backend’s safe contract.
     * Maps common scenarios to pt-BR messages, for example:
       * **Auth context**:
         * 401 with known code (e.g. `INVALID_CREDENTIALS`): `"E-mail ou senha inválidos. Tente novamente."`
         * 401 without code / expired token: `"Sua sessão expirou. Faça login novamente."`
       * **Generic client errors (4xx)**: `"Não foi possível concluir sua ação. Verifique os dados e tente novamente."`
       * **Server errors (5xx)**: `"Algo deu errado no servidor. Tente novamente mais tarde."`
       * **Network errors** (sem `response`): `"Erro de conexão. Verifique sua internet."`
       * **Timeouts** (se `code` ou mensagem indicar): `"Tempo de resposta excedido. Tente novamente."`
     * Provides sensible fallbacks: `"Não foi possível completar a ação. Tente novamente."` for unknown cases.
2. **Integrate Mapper in Auth Screens**:
   * In `app/login/page.tsx` and `app/register/page.tsx`:
     * Replace `err instanceof Error ? err.message : "..."` por uma chamada ao mapper, passando `context: "auth"`.
     * Garantir que o usuário nunca veja textos como `"Request failed with status code 401"`.
3. **Align Transactions/Insights/Settings Error Handling**:
   * Where toasts currently show generic failures (e.g. `"Falha ao carregar transações"`), keep these messages when they already are clear.
   * Optionally, for some actions, merge mapper output, por exemplo:
     * Caso genérico: `"Falha ao adicionar transação. Verifique sua conexão e tente novamente."`
     * Usar mapper para diferenciar `NETWORK_ERROR` vs `SERVER_ERROR` (sem expor código HTTP nem detalhes internos).
4. **Sync With Chat Error Model**:
   * Review `lib/chat/service.ts` and `useChat.ts`:
     * Ensure internal codes (`TIMEOUT`, `NETWORK_ERROR`, `UNAUTHORIZED`, `SERVER_ERROR`, `CLIENT_ERROR`, `UNKNOWN_ERROR`) are either:
       * Harmonized with backend error `code` values when those exist, or
       * Mapped cleanly into the same **user-facing** vocabulary used by the central mapper.
   * Refactor minimal parts to reduce duplication between chat-specific mapping and generic mapper, if it stays simple.
5. **(Optional) Adjust Axios Interceptor Behavior**:
   * Optionally, after a failed refresh in `lib/api.ts`, wrap the rejection error into a simpler `Error("UNAUTHORIZED")` or something similar, so the mapper treats it consistently (especially for session expiry).
6. **Manual UX Review Across Screens**:
   * Click through login, register, dashboard, transactions, chat:
     * Force typical error flows (senha errada, token expirado, servidor offline, etc.).
     * Confirm that all messages:
       * Estão em pt-BR.
       * São amigáveis, claras e não técnicas.
       * Não exibem códigos HTTP nem detalhes internos.

### 5. Validation Checklist
- [ ] Nenhum lugar do frontend exibe `error.message` bruto do Axios para o usuário.
- [ ] Nenhum componente mostra `error.response.data` ou JSON de erro cru na UI.
- [ ] Todas as telas importantes (login, cadastro, transações, chat, settings/insights) usam o mesmo padrão de mapeamento de erro.
- [ ] Mensagens estão em pt-BR, curtas, claras e sem códigos HTTP/stack traces.
- [ ] O comportamento continua coerente com os contratos de erro do backend e foi verificado manualmente nos fluxos críticos.

