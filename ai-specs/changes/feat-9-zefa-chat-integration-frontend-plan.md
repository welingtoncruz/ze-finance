## 🎨 Frontend Implementation Plan: feat-9 — Zefa Chat Integration (Frontend, Text-Only V1)

### 1. Analysis & Design

* **Goal**: Replace the current **local/simulated chat** on `/chat` with a **backend-integrated** text chat UI that feels native on mobile and solid on desktop, while keeping the existing Zefa look & layout.
  * **Explicit scope**: **text-only** (no voice, no image, no attachments).
  * **Key UX requirements**:
    * Message history in local state + **localStorage persistence** (survives navigation and browser close/reopen).
    * **Optimistic UI**: user message appears immediately with a `sending` state; retries on failure.
    * **Auto-scroll** to the last message and “Zefa is typing…” indicator while awaiting the API.
    * **Financial success feedback**: when backend signals `transaction_created`, show a special confirmation card inside the chat (Electric Lime highlight).
    * Robust error handling: timeouts, network failures, and JWT expiration.

* **Route**: `frontend/app/chat/page.tsx`

* **Backend contract**
  * **Desired (ticket requirement)**:
    * Endpoint: `POST /chat`
    * Request: `{ "message": string }`
    * Response: `{ "response": string, "transaction_created": boolean, "data": object }`
  * **Current backend in this repo (source of truth today)**:
    * Endpoint: `POST /chat/messages` (JWT protected)
    * Endpoint (v2 with UI metadata): `POST /chat/messages/v2` (JWT protected)
    * Request: `{ "text": string, "content_type": "text", "conversation_id"?: string }`
    * Response: `{ id, conversation_id, role, content, content_type, created_at }`
  * **Plan**: Implement a **frontend normalization layer** (`chatService`) so the UI consumes a stable `ApiChatResponse` shape. Try v2 first (for UI metadata) and fall back to v1. If the backend later adds `POST /chat`, only `chatService` needs changes.
    * **Dependency / follow-up**: To support `transaction_created` and `data` reliably, the backend must expose tool execution metadata (e.g., `transaction_created: true` + created transaction payload). Without that, the frontend cannot safely infer it from assistant text.

* **Responsive layout**
  * **Mobile**: full-height chat with sticky header and sticky input; safe-area padding already exists in current UI (`safe-area-top`, `safe-area-bottom`). Keep large touch targets and use `enterKeyHint="send"`.
  * **Tablet/Desktop**: keep the same centered message column (`max-w-2xl`) but avoid “phone frame” constraints beyond that. Keep the existing header chrome.

* **Server vs Client**
  * `frontend/app/chat/page.tsx`: remains **Client Component** (auth guard, effects, API calls).
  * `frontend/components/chat/ZefaChatScreen.tsx`: **Client Component** (state, scroll, input events).

---

### 2. Component Architecture

* **Refactor existing**
  * `frontend/components/chat/ZefaChatScreen.tsx`
    * Remove simulated `generateAIResponse()` logic.
    * Remove voice-related UI (`Mic`, `MicOff`, `toggleVoiceInput`) and any state like `isListening`.
    * Delegate chat state to a new hook `useChat()`.

* **New components (recommended)**
  * `frontend/components/chat/ChatBubble.tsx`
    * **Responsibility**: render a single message bubble (user vs assistant), including timestamp and message status (`sending`/`error`).
    * **Props**: `message: ChatMessage`
  * `frontend/components/chat/TypingIndicator.tsx`
    * **Responsibility**: render “Zefa is typing…” (3 dots or skeleton shimmer).
  * `frontend/components/chat/TransactionConfirmationCard.tsx`
    * **Responsibility**: render the special success card when `transaction_created === true`.
    * **Props**: `data: ApiTransactionCreatedData` (typed, narrow; avoid `object`).

* **ShadcnUI primitives**
  * `Button`, `Input`, `Card` (and `CardHeader/CardContent` if needed).

* **Icons (Lucide)**
  * Keep current: `ArrowLeft`, `Send`, `Sparkles`, `Plus`
  * Add if needed: `RefreshCcw` (retry), `AlertTriangle` (error), `CheckCircle2` (success card)

---

### 3. State & Data Fetching

#### 3.1 Data Flow (required deliverable)

* **Flow**:
  * Chat input (`ZefaChatScreen`) → `useChat.sendMessage(text)` →
  * `chatService.sendMessage({ message, conversationId })` (Axios `api`) →
  * Normalize API response → update `messages[]` state →
  * Persist state to localStorage.

#### 3.2 New hook: `useChat`

* **File**: `frontend/lib/hooks/useChat.ts` (or `frontend/components/chat/useChat.ts`, but prefer `lib/hooks` for reuse)
* **Responsibilities**
  * Keep `messages: ChatMessage[]` in local state.
  * Maintain `conversationId?: string`.
  * Persist/rehydrate `messages` + `conversationId` in `localStorage`.
  * Provide imperative actions:
    * `sendMessage(text: string): Promise<void>`
    * `retryMessage(messageId: string): Promise<void>`
    * `clearConversation(): void` (optional but helpful)
  * UI flags:
    * `isAssistantTyping: boolean`
    * `isSending: boolean` (derived)

* **Optimistic UI**
  * On send:
    * append user message immediately with `status: "sending"`.
    * set `isAssistantTyping = true`.
  * On success:
    * mark user message as `status: "sent"`.
    * append assistant message as `status: "sent"`.
    * if `transaction_created`, append a “system”/“meta” message variant that renders `TransactionConfirmationCard`.
  * On failure:
    * mark user message as `status: "error"` and attach `errorCode`/`errorMessage`.
    * set `isAssistantTyping = false`.

#### 3.3 localStorage persistence

* **Key**: `zefa_chat_v1:default`
* **Stored shape** (JSON):
  * `conversationId: string | null`
  * `messages: PersistedChatMessage[]` where timestamps are stored as ISO strings (not `Date` objects).
* **Rehydration**
  * Convert ISO timestamp strings back to `Date`.
  * Guard against corrupted storage (try/catch → fallback to initial welcome message).

#### 3.4 API interactions (Axios)

* **File**: `frontend/lib/chat/service.ts`
* **Function**: `sendChatMessage(input: ApiChatRequest): Promise<ApiChatResponse>`
  * Uses existing `api` instance from `@/lib/api` (already injects JWT and redirects on 401).
  * Implements a request timeout (Axios `timeout`, e.g. 30s).
  * Handles backend variants:
    * Variant A (current repo): call `POST /chat/messages`
    * Variant B (desired): call `POST /chat`
  * Returns **normalized**:
    * `responseText: string`
    * `transactionCreated: boolean`
    * `data?: ApiTransactionCreatedData | null`
    * `conversationId?: string`

---

### 4. TypeScript Interfaces (required deliverable)

#### 4.1 UI types (`frontend/lib/types.ts`)

* **Update** `ChatMessage` to support delivery/error + optional “meta card” messages:
  * `status: "sending" | "sent" | "error"`
  * `kind: "text" | "transaction_confirmation"` (or similar)
  * `meta?: { transactionCreated?: boolean; data?: ApiTransactionCreatedData }`

#### 4.2 API types (`frontend/lib/types/api.ts`)

* Add strict types (no `any`, avoid `object` when possible):
  * `ApiChatRequest`:
    * Desired: `{ message: string }`
    * Current: `{ text: string; content_type: "text"; conversation_id?: string }`
  * `ApiChatMessageResponse` (current backend): `{ id: string; conversation_id: string; role: "assistant" | "user"; content: string; content_type: "text"; created_at: string }`
  * `ApiChatResponse` (normalized for UI): `{ responseText: string; transactionCreated: boolean; data?: ApiTransactionCreatedData | null; conversationId?: string }`
  * `ApiTransactionCreatedData` (narrow):
    * `id: string`
    * `amount: number`
    * `type: "INCOME" | "EXPENSE"`
    * `category: string`
    * `description?: string | null`
    * `occurred_at?: string | null`

---

### 5. Interface of Chat (Refactor v0)

#### 5.1 Scroll behavior

* Keep existing `messagesEndRef` approach, but ensure:
  * Scroll happens on:
    * message append
    * typing indicator appears/disappears
  * Prefer `behavior: "smooth"` for assistant messages; use `"auto"` for initial hydration to avoid long scroll animations.

#### 5.2 Visual differentiation (required)

* **User bubble**: Indigo theme (e.g., `bg-indigo-600 text-white`, adjust dark mode).
* **Assistant bubble**: light gray/white in light mode, muted dark surface in dark mode.
* Keep radius behavior: user bubble `rounded-br-md`, assistant `rounded-bl-md`.

#### 5.3 “Zefa is typing…”

* Replace/keep the existing dot animation but make it conditional on `isAssistantTyping`.
* Alternative: use `.skeleton-shimmer` bar(s) for a more premium feel.

#### 5.4 Remove voice/image for now

* Delete mic button and any voice-related state and icons from the chat input.
* Ensure the input remains visually balanced after removal (send button + optional “+” quick action stays).

---

### 6. Smart Finance Feedback (Confirmation Card)

* When `transactionCreated === true`, append a special message that renders `TransactionConfirmationCard`.
* Styling guidelines:
  * Highlight with “Electric Lime”:
    * Prefer adding a semantic token (recommended):
      * Add `--electric-lime` and `--electric-lime-foreground` to `frontend/app/globals.css` (light + dark).
      * Expose them through `@theme inline` as `--color-electric-lime`, etc.
    * Or, if avoiding token changes in this ticket, use Tailwind arbitrary colors in the card only (less consistent).
  * Use Shadcn `Card` with a left border/gradient bar in Electric Lime and a success icon.
* Include a compact summary:
  * Amount, type (income/expense), category, description (if present), and date.

---

### 7. Errors, Timeouts, and Retry

* **Timeout**:
  * Set request timeout in `chatService` (e.g., 30s).
  * If timeout occurs:
    * mark the user message as `error`
    * show an inline retry action (“Try again” in pt-BR UI copy).

* **JWT expired / 401**:
  * Axios interceptor already clears token and redirects to `/login`.
  * In chat UI:
    * avoid showing a confusing “network error” bubble when the redirect happens.
    * optionally show a toast (“Sessão expirada. Faça login novamente.”) before redirect (if feasible without race conditions).

* **Other network errors**:
  * Use a generic, user-friendly pt-BR message and provide a retry button per failed message.

---

### 8. Implementation Steps

1. **Create API normalization service**
   * Add `frontend/lib/chat/service.ts` with `sendChatMessage()` returning normalized `ApiChatResponse`.
   * Implement timeout and robust error mapping (timeout vs network vs 401).

2. **Add strict chat API types**
   * Update `frontend/lib/types/api.ts` with `ApiChat*` interfaces and `ApiTransactionCreatedData`.

3. **Implement `useChat` hook**
   * Add `frontend/lib/hooks/useChat.ts`:
     * state management, optimistic UI, retry, sessionStorage persistence.

4. **Refactor `ZefaChatScreen` to use `useChat`**
   * Remove `generateAIResponse()` and simulation delays.
   * Remove voice button and related icons/state.
   * Wire send action to `useChat.sendMessage`.

5. **Add confirmation card rendering**
   * Add `TransactionConfirmationCard.tsx` and render it for `kind === "transaction_confirmation"`.
   * Add Electric Lime token(s) or temporary styling.

6. **Finalize UX polish**
   * Auto-focus input on open (but avoid stealing focus on desktop when user is scrolling).
   * Mobile keyboard “send” behavior:
     * `enterKeyHint="send"`
     * send on Enter; avoid multiline unless explicitly desired.
   * Ensure scrolling stays stable and does not jitter on typing indicator.

---

### 9. Validation Checklist (required deliverable)

- [ ] Uses `api` instance from `@/lib/api` (Axios).
- [ ] Chat is **text-only** (no voice/image UI).
- [ ] Optimistic UI: user message appears immediately with `sending` state.
- [ ] SessionStorage persistence keeps conversation while navigating within the tab.
- [ ] Auto-scroll always lands on the latest message.
- [ ] Typing indicator appears while awaiting backend response.
- [ ] Confirmation card appears when `transaction_created === true` (requires backend metadata).
- [ ] Timeout + network errors show retry UI.
- [ ] JWT expiration is handled gracefully (401 redirects to login; no confusing state).
- [ ] Responsive-first: mobile keyboard safe-area, desktop layout not constrained to phone width.
- [ ] No `any` types in TypeScript.

