## 🎨 Frontend Implementation Plan: feat-22 — Chat localStorage per userId

### 1. Analysis & Design
* **Goal**: Scope Zefa chat history in the browser **per authenticated user**, so messages from one account never appear when another user logs in on the same device, while keeping the MVP simple (no new backend endpoints).
* **Current State**:
  * `useChat` (`frontend/lib/hooks/useChat.ts`) persists the chat state into `localStorage` under a **single global key**: `zefa_chat_v1:default`.
  * On mount, `useChat` always hydrates from this key, regardless of who is logged in.
  * Auth is handled by `AuthContext` (`frontend/context/AuthContext.tsx`), which stores the access token under `zefa_token`, but does **not** expose a user object or id.
  * Profile data is cached in `localStorage` as `zefa_profile` (with `id`, `full_name`, `monthly_budget`, etc.) and used by dashboard/settings/insights.
* **High-Level Strategy**:
  * Derive a **chat storage key that includes the current userId** (e.g. `zefa_chat_v1:<userId>`), using the existing `zefa_profile` cache as the source of truth for the user id.
  * Update `useChat` to:
    * Load from `localStorage` using the **derived per-user key** on hydration.
    * Save messages and `conversationId` back to the same per-user key on any change.
    * Clear only the current user’s chat state when `clearConversation` is called.
  * Optionally, clear chat storage on logout (for privacy on shared devices) by removing all keys with the `zefa_chat_v1:` prefix.
* **Route**: `app/chat/page.tsx` (which renders `ZefaChatScreen` → `useChat`).
* **Responsive Layout**:
  * No UI layout changes. Mobile/tablet/desktop behavior of the chat UI remains exactly the same; only the persisted data source changes.
* **Server vs Client**:
  * `ChatPage` and `ZefaChatScreen` are already Client Components (`"use client"`).
  * `useChat` is a client hook and remains so; all changes are purely client-side (localStorage and API usage unchanged).

### 2. Component Architecture
* **New/Updated Modules**:
  * `frontend/lib/hooks/useChat.ts`:
    * Replace the constant `STORAGE_KEY = "zefa_chat_v1:default"` with a small **helper that derives the storage key based on the current user**.
    * Keep all existing `ChatMessage` structure and behavior (optimistic sending, UI events, error handling) intact.
  * (Optional) `frontend/lib/chat/storage.ts`:
    * Extract the key-derivation logic into a tiny internal helper module if it starts to grow, to keep `useChat` focused on chat behavior.
* **Key Helper Responsibility**:
  * Read `zefa_profile` from `localStorage` (if present).
  * Parse it safely (try/catch) and extract `id` (or another stable user identifier).
  * Build a key like:
    * `const key = userId ? \`zefa_chat_v1:${userId}\` : "zefa_chat_v1:anonymous";`
  * This ensures:
    * Different users on the same device get **completely separate chat histories**.
    * Anonymous/uninitialized state still works like today (falls back to a default key).
* **ShadcnUI Primitives**:
  * Not directly impacted; no new visual components are introduced for this feature.
* **Icons**:
  * No new icons required. All changes are invisible infrastructure for persistence.

### 3. State & Data Fetching
* **API Interactions**:
  * **Unchanged**:
    * Chat: `sendChatMessage` in `frontend/lib/chat/service.ts` still calls the existing `/chat/messages` endpoint.
    * Auth: `AuthContext` continues managing tokens via `@/lib/api` and `/auth/*` endpoints.
  * **No new endpoints** are introduced for chat history; persistence remains purely client-side for this MVP.
* **User Identification for Keying**:
  * Primary source: `localStorage["zefa_profile"]`, which is already written by:
    * `HomePage`, `Insights`, `Settings`, and `Transactions` after fetching `/user/profile`.
  * Behavior:
    * On chat hydration, try to read `zefa_profile` and:
      * If it exists and has an `id` field, use that as `<userId>` in `zefa_chat_v1:<userId>`.
      * If not available (e.g. first load before profile fetch), fall back to `"zefa_chat_v1:anonymous"` to keep the experience functional.
* **Local State**:
  * `useChat` keeps the same internal state:
    * `messages: ChatMessage[]`
    * `conversationId: string | null`
    * `isAssistantTyping: boolean`
    * `isSendingRef` (ref) + derived `isSending`
  * Only the **storage binding** changes (which key we load/save).
* **Global Context**:
  * No new context is required.
  * Optionally, in a future iteration, `AuthContext` could expose a `user` object (with `id`), which would then become the preferred source of truth for the storage key instead of `zefa_profile`.

### 4. Implementation Steps
1. **Introduce a Per-User Storage Key Helper**
   * In `useChat.ts`, create a small `getStorageKey()` helper:
     * Check `typeof window !== "undefined"`; if not in browser, return a constant like `"zefa_chat_v1:ssr"`.
     * Try to read `localStorage.getItem("zefa_profile")`.
     * If present, `JSON.parse` it with a `try/catch` guard.
     * Extract a stable `userId` (e.g. `profile.id` or `profile.userId`, depending on existing structure).
     * Return `userId ? \`zefa_chat_v1:${userId}\` : "zefa_chat_v1:anonymous"`.
   * Keep `"zefa_chat_v1:anonymous"` semantics aligned with previous behavior (single shared key) for cases where no profile exists.
2. **Refactor Storage Helpers (`loadFromStorage` / `saveToStorage`)**
   * Update `loadFromStorage()`:
     * Remove hard dependency on the global `STORAGE_KEY`.
     * Call `getStorageKey()` inside and use it to read from `localStorage`.
     * Preserve existing error handling and return type (`PersistedChatState | null`).
   * Update `saveToStorage(conversationId, messages)`:
     * Call `getStorageKey()` inside.
     * Use the derived key in `localStorage.setItem(key, JSON.stringify(persisted))`.
   * Ensure these helpers still behave safely when `window` is undefined (SSR/Next hydration).
3. **Refactor `clearConversation` to Clear Only the Current User’s Chat**
   * In `clearConversation`:
     * Replace `localStorage.removeItem(STORAGE_KEY)` with:
       * `const key = getStorageKey(); localStorage.removeItem(key);`
     * Keep the in-memory state behavior the same (reset to `[INITIAL_MESSAGE]` and `conversationId = null`).
   * This ensures that clearing conversation from within the chat UI only affects the currently logged-in user’s history.
4. **(Optional) Clear All Chat Storage on Logout**
   * In `AuthContext.logout`:
     * After removing `zefa_token`, optionally iterate over `localStorage` keys and remove any key that starts with `"zefa_chat_v1:"` for additional privacy:
       * Example pattern: simple `for` loop over `localStorage.length` with a guards against index shifting.
     * This guarantees that when a user explicitly logs out on a shared device, no chat remnants for any user remain in `localStorage`.
   * This step is optional for MVP but recommended if shared-device privacy is a priority.
5. **Manual Edge-Case Review**
   * Verify behavior in these flows:
     * User A logs in, talks to Zefa, navigates away, then back to `/chat`: history is restored correctly.
     * User A logs out, User B logs in on the same browser:
       * User B should **not** see User A’s chat history.
       * If `zefa_profile` is loaded and has a different `id`, they get a fresh or own-per-user history.
     * Scenario where chat is opened before `zefa_profile` is populated:
       * Chat should still work (using `"anonymous"` key).
       * Once profile is available on subsequent visits, history should be correctly scoped to that user.

### 5. Validation Checklist
- [ ] Chat history in `useChat` is persisted under a per-user `localStorage` key (e.g. `zefa_chat_v1:<userId>`), not the global `"zefa_chat_v1:default"`.
- [ ] Different authenticated users on the same browser do **not** see each other’s chat history.
- [ ] Anonymous/fallback behavior remains functional when `zefa_profile` is not yet available.
- [ ] All new code paths avoid `any` and respect existing TypeScript types (`ChatMessage`, `PersistedChatState`).
- [ ] All localStorage access is guarded by `typeof window !== "undefined"` for SSR safety.
- [ ] (If implemented) Logout removes chat-related keys with the `zefa_chat_v1:` prefix to improve privacy on shared devices.

