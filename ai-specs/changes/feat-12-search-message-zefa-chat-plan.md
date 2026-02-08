## 🎨 Frontend Implementation Plan: feat-12 — Search Messages in Zefa Chat

### 1. Analysis & Design
* **Goal**: Add an in-chat message search that lets the user quickly find past messages and jump to them, without degrading typing performance.
* **Route**: `frontend/app/chat/page.tsx` (no route changes; feature lives inside the chat screen)
* **Responsive Layout**:
  - **Mobile**: a search icon in the header toggles “search mode” where the title area becomes a search input; results appear in a lightweight panel below the header (no modal required).
  - **Tablet/Desktop**: show an inline search input in the header (or the same “search mode” UI, but expanded width) plus next/previous controls and a match counter.
* **Server vs Client**:
  - `frontend/app/chat/page.tsx`: Client Component (already; auth guard).
  - `frontend/components/chat/ZefaChatScreen.tsx`: Client Component (already; will own search state and scrolling).
  - New small subcomponents (if created) are Client Components (controlled input + event handlers).

### 2. Component Architecture
* **Refactor existing**:
  - `frontend/components/chat/ZefaChatScreen.tsx`
    - Add search UI in the header (search icon + input + controls).
    - Add stable DOM anchors per message so we can jump to a match reliably.
    - Track and render the “active match” highlight.
* **Optional new components (recommended to keep `ZefaChatScreen` small)**:
  - `frontend/components/chat/ChatSearchBar.tsx`
    - Controlled input (`query`) + close button + match count + next/prev actions.
    - Props: `query`, `setQuery`, `matchCount`, `activeIndex`, `onNext`, `onPrev`, `onClose`.
  - `frontend/components/chat/ChatSearchResults.tsx`
    - Renders the list of matches (snippet + role + timestamp).
    - Props: `results`, `activeResultId`, `onSelect`.
  - `frontend/components/chat/ChatMessageAnchor.tsx`
    - Wraps any rendered message (bubble or card) and sets `id="chat-msg-${message.id}"`.
    - Accepts `isActiveMatch` to apply a ring/background highlight.
* **ShadcnUI primitives**:
  - Use existing: `Input`, `Button`, `Card` (already in `frontend/components/ui/`).
  - Avoid adding `Dialog/Sheet` for MVP unless you explicitly want an overlay experience.
* **Icons** (Lucide):
  - `Search`, `X`, `ChevronUp`, `ChevronDown`.

### 3. State & Data Fetching
* **API Interactions**:
  - None for MVP. Search is performed client-side over `useChat().messages` (which is already persisted to localStorage).
* **Local State** (in `ZefaChatScreen.tsx`):
  - `isSearchOpen: boolean`
  - `searchQuery: string`
  - `debouncedQuery: string` (150–250ms debounce to avoid work on every keystroke)
  - `searchResults: ChatSearchResult[]` (derived with `useMemo` from `debouncedQuery` + `messages`)
  - `activeMatchIndex: number` (index into `searchResults`, \(-1\) when none)
  - `activeMatchMessageId: string | null` (used for highlight + scroll target)
* **Derived types**:
  - `ChatSearchResult` should include: `messageId`, `role`, `timestamp`, `snippet`, `matchStart?`, `matchEnd?` (optional), `kind`.
* **Search indexing strategy** (MVP):
  - Build `searchableText` per message:
    - `kind === "text"`: `message.content`
    - `kind === "ui_event"`: include `message.meta?.uiEvent?.title` + `subtitle`
    - `kind === "transaction_confirmation"`: include category + description + amount (stringified) if available
  - Use case-insensitive match; optionally normalize diacritics (e.g., `"é"` → `"e"`) for better PT-BR experience.
* **Jump to message**:
  - Ensure every message render is wrapped with an element that has `id="chat-msg-${message.id}"`.
  - On select (or next/prev), call `document.getElementById(...).scrollIntoView({ behavior: "smooth", block: "center" })`.
  - Apply a temporary highlight (ring + subtle background) to the active match; clear it when query closes or after a short timeout.

### 4. Implementation Steps
1. Add per-message anchors:
   - Update `renderMessage` flow in `ZefaChatScreen.tsx` to wrap **every** message output (including `TransactionConfirmationCard`) in a container with a stable `id`.
2. Add header search UX:
   - Add a search icon button.
   - Implement mobile “search mode” that swaps the header title area for an `Input` + close button.
   - On desktop, allow wider inline input and always-visible next/prev controls.
3. Implement debounced search + results derivation:
   - Add a small debounce hook (local to `ZefaChatScreen` or a new `frontend/lib/hooks/useDebouncedValue.ts`).
   - Use `useMemo` to compute `searchResults` from `messages` + `debouncedQuery`.
4. Implement match navigation:
   - Next/Prev buttons cycle through results (wrap-around).
   - Pressing Enter goes to next result; Shift+Enter goes to previous.
   - Esc closes search (clears query, results, active highlight).
5. Render results panel:
   - Show match count and a scrollable list of results (use `Card` styling; native `overflow-y-auto`).
   - Clicking a result jumps to that message and sets it as active.
6. Performance guardrails:
   - Keep all expensive work in `useMemo` based on `debouncedQuery`.
   - Avoid re-rendering the full message list on every keypress by keeping the existing memoization pattern (message list memo + memoized bubbles/cards).
7. Add/extend tests (high signal):
   - Unit test: search result derivation (query → results) with mixed message kinds.
   - Integration test: open search, type query, verify results count, click result, assert `scrollIntoView` called on the correct anchor.

### 5. Validation Checklist
- [ ] Search works on **mobile/tablet/desktop** without cramped layout on desktop.
- [ ] Search does **not** introduce typing lag (debounce + memoized results).
- [ ] Clicking a result reliably scrolls to the correct message (anchors exist for bubbles and cards).
- [ ] Active match is visually highlighted and accessible (focus-visible / contrast).
- [ ] No `any` types introduced.
- [ ] Existing chat flows remain intact (sending, typing indicator, suggestions, retry).

