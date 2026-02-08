# Backend Implementation Plan: feat-16 — WhatsApp Integration (Channel Adapter + Auth)

## 1. Analysis & Design

### Goal
Add a **WhatsApp channel adapter** so users can interact with Zefa via WhatsApp, with secure account linking and signup flows. The existing AI gateway, tools, and chat persistence are reused; only the transport layer changes.

### User Journeys (Summary)
| Journey | Flow |
|---------|------|
| **Signup via WhatsApp** | First message → request email → send code to email → user sends code → create user + link |
| **Web user links WhatsApp** | Logged-in user on site → "Vincular WhatsApp" → code shown on screen → user sends code via WhatsApp → link |
| **Login via WhatsApp (site)** | User clicks "Entrar com WhatsApp" → scans QR / opens link → sends pre-filled message → poll returns JWT |
| **Chat via WhatsApp** | Linked user sends message → webhook → adapter → gateway → send response via Meta API |
| **Desvincular** | User on site or sends "desvincular" via WhatsApp → confirm → unlink |

### Current State
- Chat routes: `POST /chat/messages` (JWT-protected)
- User model: `email` (required), `hashed_password` (required)
- AI gateway: `process_chat_message(db, user_id, ...)` — channel-agnostic
- No WhatsApp infrastructure

### Affected Files
- `backend/app/models.py` — User changes, new `UserWhatsappLink`, optional `PendingSignup` / `PendingLogin`
- `backend/app/schemas.py` — New schemas for WhatsApp flows
- `backend/app/crud.py` — User CRUD (nullable email/password), new `user_whatsapp_links` CRUD
- New: `backend/app/whatsapp/` module
  - `adapter.py` — Webhook → extract text → resolve user → call gateway → send reply
  - `routes.py` — Webhook endpoint, init/poll for login, link/verify for web
  - `sender.py` — Send messages via Meta Cloud API
  - `schemas.py` — Webhook payloads, init/poll responses
- `backend/app/main.py` — Include WhatsApp router
- `backend/requirements.txt` — `httpx` (if not present), email lib (e.g. `fastapi-mail` or `aiosmtplib`)
- `backend/.env.example` — WhatsApp + email env vars
- `backend/tests/test_whatsapp.py` — Integration tests
- `ai-specs/specs/api-spec.yml` — Document new endpoints

### Dependencies
- **pip**: `httpx` (for Meta API calls), `fastapi-mail` or `python-dotenv` + SMTP for email
- **Env vars**:
  - `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`
  - Email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`

---

## 2. Data Layer (Models & Schemas)

### 2.1 Database Changes

**User model (`models.py`):**
- `email`: Keep required and unique (WhatsApp signup always collects email before creating user)
- `hashed_password`: `nullable=True` (WhatsApp users have no password until they set one)
- Add `auth_provider`: `Column(String(50), default="local")` — `local` | `whatsapp`

**New table: `user_whatsapp_links`**
- `id` (UUID, PK)
- `user_id` (UUID, FK users, nullable=False)
- `phone_number` (String, E.164 format, UNIQUE, indexed)
- `verified_via` (String): `first_message` | `code_confirmation`
- `linked_at` (DateTime, default now)
- `created_at`, `updated_at` (optional)

**New table: `pending_signups`** (or Redis/cache — for MVP, use DB for simplicity)
- `id` (UUID, PK)
- `phone_number` (String, indexed)
- `email` (String)
- `verification_code` (String, 6 digits)
- `created_at` (DateTime) — TTL 10 min in logic
- Unique constraint: one pending per phone (upsert on new signup attempt)

**New table: `pending_links`** (web user linking WhatsApp)
- `user_id` (UUID, FK users, PK)
- `code` (String, 6 digits)
- `created_at` (DateTime) — TTL 5 min in logic

**New table: `pending_logins`**
- `id` (String, PK) — e.g. `login_abc7f2`
- `phone_number` (String, nullable) — set when webhook receives "login_xxx"
- `user_id` (UUID, nullable) — set when resolved
- `access_token` (String, nullable) — set when ready for poll
- `created_at` (DateTime) — TTL 5 min in logic

**Migration**: Add Alembic migration or use `Base.metadata.create_all()` for new tables; alter `users` if Alembic exists.

### 2.2 Pydantic Schemas

**`app/whatsapp/schemas.py`:**
- `WebhookPayload` — parse Meta webhook structure (entry, changes, messages, from, text)
- `WhatsappLinkInitRequest` — (optional) empty for init
- `WhatsappLinkInitResponse` — `login_id: str`, `wa_me_link: str`, `expires_at: datetime`
- `WhatsappLinkPollResponse` — `status: "pending" | "ready" | "expired"`, `access_token?: str`
- `WhatsappVerifyRequest` — `code: str` (6 digits)
- `WhatsappVerifyResponse` — `success: bool`, `message?: str`

**`app/schemas.py` (extend):**
- `UserCreate` — keep for web; add optional `auth_provider`
- New: `UserWhatsappCreate` — internal, `email: str`, `phone_number: str`, `auth_provider: "whatsapp"`

---

## 3. Business Logic (CRUD / Services)

### 3.1 User CRUD (`crud.py`)
- `create_user`: allow `hashed_password=None`, `email=None` for WhatsApp flow (with validation)
- `create_whatsapp_user(db, email: str, phone_number: str) -> User` — create user with `auth_provider=whatsapp`, no password
- `get_user_by_email(db, email) -> Optional[User]`
- `get_user_by_phone(db, phone_number) -> Optional[User]` — via `user_whatsapp_links`

### 3.2 UserWhatsappLink CRUD (new: `app/whatsapp/crud.py` or extend `crud.py`)
- `get_link_by_phone(db, phone_number) -> Optional[UserWhatsappLink]`
- `create_link(db, user_id, phone_number, verified_via) -> UserWhatsappLink`
- `delete_link(db, user_id) -> None` — desvincular
- `get_user_by_phone(db, phone_number) -> Optional[User]` — join link + user

### 3.3 Pending Signup
- `create_or_update_pending_signup(phone_number, email) -> str` — generate 6-digit code, store, return code (for email sending)
- `verify_pending_signup(phone_number, code) -> Optional[dict]` — returns `{email}` if valid
- `delete_pending_signup(phone_number)` — after successful signup

### 3.4 Pending Login
- `create_pending_login() -> tuple[str, str]` — returns `(login_id, wa_me_link)`
- `complete_pending_login(login_id, phone_number, user_id, access_token)` — called from webhook handler
- `get_pending_login(login_id) -> Optional[dict]` — for poll endpoint; returns `{status, access_token?}`

### 3.5 Email Service
- `send_verification_email(to_email: str, code: str) -> None` — send 6-digit code via SMTP

### 3.6 WhatsApp Sender
- `send_whatsapp_text(phone_number: str, text: str) -> None` — call Meta API `POST /v18.0/{phone_number_id}/messages`

---

## 4. API Layer (Routes)

### 4.1 Webhook (`app/whatsapp/routes.py`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/webhooks/whatsapp` | No (verify token) | Meta verification: return `hub.challenge` if `hub.verify_token` matches |
| POST | `/webhooks/whatsapp` | No (signature validation) | Receive messages; validate `X-Hub-Signature-256`; process and reply |

**Webhook processing logic:**
1. Validate signature with `WHATSAPP_APP_SECRET`
2. Parse payload; extract `from`, `text`, `message_id` (for idempotency)
3. **If text matches `login_{id}`**: resolve `pending_login`, set user_id + token, send "Entrando..." (or skip reply to avoid duplicate)
4. **Else if phone in `pending_signup` (awaiting code)**: verify code; if ok, create user + link, delete pending, send "Conta criada!"
5. **Else if phone in `pending_signup` (awaiting email)**: validate email, send code, update pending
6. **Else if phone not linked**: start signup flow — ask for email
7. **Else**: resolve user from link → call `gateway.process_chat_message` → format response for WhatsApp (plain text, no Markdown blocks) → `send_whatsapp_text`
8. **Commands**: `desvincular` → confirm → delete link → "WhatsApp desvinculado"

### 4.2 Login via WhatsApp (for frontend)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/whatsapp/login/init` | No | Create `pending_login`, return `{ login_id, wa_me_link, expires_at }` |
| GET | `/auth/whatsapp/login/poll` | No | Query param `login_id`; return `{ status, access_token? }` |

### 4.3 Link WhatsApp (for logged-in web user)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/whatsapp/link/init` | JWT | Generate 6-digit code, store in `pending_link` (keyed by user_id), return `{ code }` for display |
| POST | `/auth/whatsapp/link/verify` | JWT | Webhook sets link when code received; this endpoint just returns status or triggers verification on next webhook — *alternative*: webhook handles it; frontend polls `GET /auth/whatsapp/status` until linked |

**Simpler approach**: `POST /auth/whatsapp/link/init` returns `{ code, expires_at }`. User sends code via WhatsApp. Webhook receives message, checks if code matches any `pending_link` for that phone (we'd need `pending_links` keyed by code or user_id). Actually, link flow: we need `pending_link` with `user_id` and `code`. When webhook receives `code` from a number, we check: is there a `pending_link` with that code? If yes, we need the number to NOT be linked to another user. Then create link for (user_id, phone_number). So we need:
- `pending_links`: `user_id`, `code`, `created_at`
- Webhook: if message is 6 digits, check `pending_links` for matching code; if found, create link, delete pending, reply "Vinculado!"

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/whatsapp/link/init` | JWT | Create `pending_link` (user_id, code), return `{ code, expires_at }` |
| GET | `/auth/whatsapp/status` | JWT | Return `{ linked: bool, phone_number?: str }` |

Webhook handles the actual linking when user sends the code.

### 4.4 Desvincular

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/whatsapp/unlink` | JWT | Delete `user_whatsapp_links` for current user |

---

## 5. WhatsApp Adapter (Core Flow)

**File: `app/whatsapp/adapter.py`**

```python
async def handle_incoming_message(db, phone_number: str, text: str, message_id: str) -> None
```

1. **Idempotency**: Check if `message_id` already processed (optional cache/DB); skip if yes.
2. **Login flow**: If `text.strip().lower().startswith("login_")`:
   - Extract `login_id`
   - Lookup `pending_login`
   - Get user by phone (must exist and be linked)
   - Create JWT, store in pending_login
   - Optionally send "Logando..." (or no reply; poll will give token)
3. **Link flow**: If `text` is 6-digit and matches `pending_link` for some user_id:
   - Ensure phone not already linked to another user
   - Create `user_whatsapp_links`
   - Delete `pending_link`
   - Send "WhatsApp vinculado!"
4. **Signup flow**: If phone not linked and not in pending_signup:
   - Create pending_signup (stage: email)
   - Send "Para criar sua conta, envie seu email:"
5. **Signup flow** (phone in pending_signup, stage: email):
   - Validate email format, check not already used
   - Generate code, send email, update pending (stage: code)
   - Send "Enviamos um código para {email}. Digite o código aqui:"
6. **Signup flow** (phone in pending_signup, stage: code):
   - Verify code
   - Create user, create link, delete pending_signup
   - Send "Conta criada! Agora você pode registrar gastos..."
7. **Desvincular command**: If text is "desvincular" and user is linked:
   - Require confirmation (e.g. "desvincular confirmar") or two-step
   - Delete link, send "WhatsApp desvinculado."
8. **Chat flow**: User linked → get user_id → call gateway → format response → send

**Response formatting for WhatsApp**: Strip Markdown blocks (```), convert `**bold**` to `*bold*`, keep lists simple. Use `whatsapp_format_response(content: str) -> str`.

---

## 6. Testing Strategy

**File: `backend/tests/test_whatsapp.py`**

- **Webhook verification**: GET with `hub.mode=subscribe`, `hub.verify_token`, `hub.challenge` → returns challenge
- **Webhook signature**: POST with invalid signature → 401
- **First message (signup start)**: Unknown phone → response asks for email
- **Signup email + code**: Mock email send; verify user + link created
- **Login init + poll**: Create pending_login, simulate webhook completion, poll returns token
- **Link init**: JWT required; returns code
- **Chat**: Linked user, mock gateway, assert reply sent via `send_whatsapp_text` (mock httpx)
- **Desvincular**: User linked, POST unlink, assert link deleted
- **Idempotency**: Same message_id twice → process once

---

## 7. Step-by-Step Implementation Guide

1. **Models**: Update `User` (nullable email/password, auth_provider); add `UserWhatsappLink`, `PendingSignup`, `PendingLogin` (or `PendingLink`). Run migration/create_all.
2. **Schemas**: Add Pydantic schemas for webhook, init, poll, verify.
3. **CRUD**: Implement user_whatsapp_links CRUD, pending signup/login/link logic.
4. **Email**: Implement `send_verification_email` (SMTP or fastapi-mail).
5. **WhatsApp sender**: Implement `send_whatsapp_text` with httpx to Meta API.
6. **Adapter**: Implement `handle_incoming_message` with full flow (signup, link, login, chat, desvincular).
7. **Routes**: Webhook GET/POST; auth init/poll; link init; status; unlink.
8. **Wire**: Include router in `main.py`.
9. **Tests**: Write integration tests with mocks.
10. **Env & docs**: Update `.env.example`, `api-spec.yml`, `README.md`.

---

## 8. Validation Checklist

- [ ] Webhook validates signature; no processing without valid signature.
- [ ] User isolation: chat and tools always scoped by `user_id` from link.
- [ ] Idempotency for webhook messages (optional but recommended).
- [ ] Email and WhatsApp env vars documented.
- [ ] Pending records expire (TTL in logic).
- [ ] All new code has type hints and follows PEP 8.

---

## 9. Edge Cases (Handling)

| Case | Behavior |
|------|----------|
| Email already exists | "Este email já tem conta. Recupere a senha no site e vincule seu WhatsApp." |
| Phone already linked to another user | "Este número já está vinculado a outra conta." |
| Wrong verification code | "Código inválido. Tente novamente ou digite 'reenviar'." |
| Code expired | "Código expirado. Digite 'reenviar' para um novo." |
| Poll for unknown login_id | `{ status: "expired" }` |
| "Entrar com WhatsApp" for unlinked number | Create account (signup flow) OR respond "Número não vinculado" — product decision: prefer create account for seamless UX |
