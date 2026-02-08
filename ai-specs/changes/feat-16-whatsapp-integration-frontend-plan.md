# Frontend Implementation Plan: feat-16 — WhatsApp Integration (Login + Settings)

## 1. Analysis & Design

### Goal
Enable users to **log in via WhatsApp** (QR/link flow) and **manage WhatsApp linking** in settings. The chat via WhatsApp itself is handled by the backend webhook; the frontend focuses on auth and configuration UX.

### Scope
- **Login page**: Add "Entrar com WhatsApp" option → QR code + link flow with polling
- **Settings / Profile**: Add "Vincular WhatsApp" and "Desvincular WhatsApp" with code verification flow
- **AuthContext**: Extend to support WhatsApp login (token from poll) and optional WhatsApp status

### Routes
- `app/login/page.tsx` — Add WhatsApp login option
- `app/configuracoes/page.tsx` or `app/settings/page.tsx` — New page for WhatsApp link/unlink (or integrate into existing account/profile section)

### Responsive Layout
- **Mobile**: Full-width forms; QR code sized for phone screens; "ou abra o link" prominent
- **Tablet/Desktop**: Same layout, QR code visible; no "phone frame" constraint

### Server vs Client
- Login page: **Client Component** (already `'use client'`)
- Settings page: **Client Component** (auth guard, API calls, state)
- New components: **Client Components** (state, effects, polling)

---

## 2. Component Architecture

### New Components

**`components/auth/WhatsAppLoginFlow.tsx`**
- **Responsibility**: Orchestrate "Entrar com WhatsApp" — init, show QR/link, poll until token or expiry
- **Props**: `onSuccess: (token: string) => void`, `onCancel?: () => void`
- **Behavior**: Calls `POST /auth/whatsapp/login/init` → displays QR + link → polls `GET /auth/whatsapp/login/poll?login_id=...` every 2s → on `status: "ready"`, calls `onSuccess(access_token)`
- **UI**: QR code (use `qrcode.react` or similar), copyable link, countdown "Válido por 5 minutos", loading state during poll

**`components/auth/WhatsAppLinkFlow.tsx`**
- **Responsibility**: "Vincular WhatsApp" — init, show 6-digit code, poll status until linked
- **Props**: `onSuccess?: () => void`, `onCancel?: () => void`
- **Behavior**: Calls `POST /auth/whatsapp/link/init` (JWT) → displays code prominently → polls `GET /auth/whatsapp/status` every 2s → when `linked: true`, show success, call `onSuccess`
- **UI**: Large code display, instructions "Envie este código para o Zefa no WhatsApp", countdown, "Reenviar código" (optional)

### ShadcnUI Primitives
- `Button`, `Card`, `CardContent`, `CardHeader`, `CardTitle`, `Input` (for copy link)
- `Separator` (for "ou" between email login and WhatsApp)
- `Alert`, `AlertDescription` (for errors, success)

### Icons (Lucide)
- `MessageCircle` or `Smartphone` — WhatsApp entry point
- `Copy`, `Check` — Copy link feedback
- `Loader2` — Loading/polling state
- `X` — Cancel/close

### Dependencies
- **npm**: `qrcode.react` (or `react-qr-code`) for QR code generation from `wa_me_link`

---

## 3. State & Data Fetching

### API Endpoints (Frontend Calls)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/auth/whatsapp/login/init` | No | Get `login_id`, `wa_me_link` |
| GET | `/auth/whatsapp/login/poll?login_id=` | No | Poll until `status: "ready"`, get `access_token` |
| POST | `/auth/whatsapp/link/init` | JWT | Get `code` to show user |
| GET | `/auth/whatsapp/status` | JWT | Check if linked, get `phone_number` |
| POST | `/auth/whatsapp/unlink` | JWT | Desvincular |

### AuthContext Extension

**New interface additions:**
```ts
interface AuthContextType {
  // ... existing
  loginWithWhatsApp: () => Promise<string | null>  // Returns token or null if cancelled
  whatsappStatus: { linked: boolean; phoneNumber?: string } | null
  refreshWhatsappStatus: () => Promise<void>
}
```

**`loginWithWhatsApp`**: Opens modal or in-page flow (`WhatsAppLoginFlow`), on success stores token and redirects. Can be a wrapper that renders the flow or triggers a callback.

**Alternative (simpler)**: Don't add `loginWithWhatsApp` to context. Instead, `WhatsAppLoginFlow` receives `onSuccess` which calls `setToken` (from a new callback passed by parent) and `router.push("/")`. The login page would pass a callback that uses a local `setToken` from a custom hook, or we add `setTokenFromExternal(token)` to AuthContext for this one-off case.

**Recommended**: Add `loginWithWhatsAppToken(token: string)` to AuthContext — a simple function that sets token and persists to localStorage. The `WhatsAppLoginFlow` component calls it on success. No need for `loginWithWhatsApp` to be async from context; the flow component handles the init/poll and then calls `loginWithWhatsAppToken`.

```ts
loginWithWhatsAppToken: (token: string) => void  // Sets token, localStorage; parent redirects
```

### Local State (WhatsAppLoginFlow)
- `loginId: string | null`
- `waMeLink: string | null`
- `status: "idle" | "pending" | "ready" | "expired" | "error"`
- `countdown: number` (seconds remaining)

### Local State (WhatsAppLinkFlow)
- `code: string | null`
- `status: "idle" | "awaiting" | "linked" | "expired" | "error"`
- `countdown: number`

---

## 4. Implementation Steps

### Step 1: API Client Types and Functions
- Add types in `lib/types/api.ts`: `WhatsappLoginInitResponse`, `WhatsappLoginPollResponse`, `WhatsappLinkInitResponse`, `WhatsappStatusResponse`
- Add functions in `lib/api.ts` or `lib/whatsapp.ts`: `initWhatsappLogin()`, `pollWhatsappLogin(loginId)`, `initWhatsappLink()`, `getWhatsappStatus()`, `unlinkWhatsapp()`

### Step 2: AuthContext Extension
- Add `loginWithWhatsAppToken(token: string)` — sets token, localStorage
- Add `whatsappStatus` and `refreshWhatsappStatus` (optional, for settings page)

### Step 3: WhatsAppLoginFlow Component
- Create `components/auth/WhatsAppLoginFlow.tsx`
- Call init on mount, display QR (from `qrcode.react`) and link
- Poll every 2s, stop on ready/expired/error
- On ready: call `onSuccess(access_token)`
- Show countdown, cancel button

### Step 4: Login Page Integration
- Add "─── ou ───" separator
- Add "Entrar com WhatsApp" button
- On click: show `WhatsAppLoginFlow` (inline or in a `Dialog`/`Sheet`)
- On success: call `loginWithWhatsAppToken`, redirect to `/`

### Step 5: Settings / Profile Page
- Create `app/configuracoes/page.tsx` (or `app/settings/page.tsx`) if not exists
- Fetch `GET /auth/whatsapp/status` on mount
- If not linked: show "Vincular WhatsApp" button → opens `WhatsAppLinkFlow`
- If linked: show phone number (masked), "Desvincular WhatsApp" button
- Wire to sidebar/account drawer navigation

### Step 6: WhatsAppLinkFlow Component
- Create `components/auth/WhatsAppLinkFlow.tsx`
- Call `POST /auth/whatsapp/link/init` on mount (requires JWT)
- Display code, instructions, countdown
- Poll `GET /auth/whatsapp/status` until `linked: true`
- On success: show "WhatsApp vinculado!", call `onSuccess`

### Step 7: Desvincular
- Add confirmation dialog ("Tem certeza? Você precisará vincular novamente para usar o Zefa no WhatsApp.")
- Call `POST /auth/whatsapp/unlink`
- Refresh status, update UI

### Step 8: Error Handling and Copy Link
- Error states: network, 401, 502, timeout
- "Copiar link" button: `navigator.clipboard.writeText(waMeLink)`, show "Copiado!" feedback
- Responsive check on mobile/tablet/desktop

### Step 9: Navigation
- Add link to Settings: `MobileAccountDrawer` "Configurações" → `router.push("/configuracoes")` + close drawer; `DesktopSidebar` → add "Configurações" nav item or footer link
- Ensure auth guard on settings page (redirect to login if not authenticated)

### Current Layout Context
- `MobileAccountDrawer`: "Configurações" button exists but only closes drawer — change to `router.push("/configuracoes")` + `onClose`
- `DesktopSidebar`: No Configurações link — add to footer or nav (e.g. Settings icon before Logout)

---

## 5. Validation Checklist

- [ ] Uses `api` instance from `@/lib/api` (Axios).
- [ ] Layout is responsive (mobile/tablet/desktop).
- [ ] Error handling (try/catch, user-friendly messages).
- [ ] No `any` types in TypeScript.
- [ ] `'use client'` on components that need state/effects.
- [ ] QR code renders correctly from `wa_me_link`.
- [ ] Polling stops on success, expiry, or unmount (cleanup).
- [ ] Settings page requires authentication.

---

## 6. Copy and UX (pt-BR)

### Login Page
- Button: "Entrar com WhatsApp"
- Flow title: "Entrar com WhatsApp"
- Instructions: "Escaneie o QR code com a câmera do celular ou toque no link abaixo"
- Link label: "Abrir no WhatsApp"
- Countdown: "Válido por X minutos"
- Success: Redirect to dashboard
- Error: "Não foi possível entrar. Tente novamente."
- Cancel: "Voltar"

### Settings (Vincular)
- Title: "Vincular WhatsApp"
- Instructions: "Envie o código abaixo para o Zefa no WhatsApp para vincular sua conta."
- Code display: Large, monospace
- Countdown: "Código válido por 5 minutos"
- Success: "WhatsApp vinculado com sucesso!"
- Error: "Erro ao gerar código. Tente novamente."

### Settings (Desvincular)
- Title: "Desvincular WhatsApp"
- Subtitle: "O número XXX será desvinculado. Você poderá vincular novamente depois."
- Confirm: "Desvincular"
- Success: "WhatsApp desvinculado."

---

## 7. Dependencies

**package.json:**
```json
{
  "qrcode.react": "^4.x"  // or "react-qr-code"
}
```

---

## 8. File Summary

| File | Action |
|------|--------|
| `lib/types/api.ts` | Add WhatsApp API types |
| `lib/whatsapp.ts` or extend `lib/api.ts` | Add API functions |
| `context/AuthContext.tsx` | Add `loginWithWhatsAppToken` |
| `components/auth/WhatsAppLoginFlow.tsx` | New |
| `components/auth/WhatsAppLinkFlow.tsx` | New |
| `app/login/page.tsx` | Add WhatsApp button + flow |
| `app/configuracoes/page.tsx` or `app/settings/page.tsx` | New or extend |
| `components/layout/DesktopSidebar.tsx` | Add Settings link |
| `components/overlay/MobileAccountDrawer.tsx` (or equivalent) | Add Settings link |
