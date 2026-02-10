## 🎨 Frontend Implementation Plan: feat-23 — Mobile Chat UX & Bottom Navigation

### 1. Analysis & Design
* **Goal**: Improve the chat experience and global layout on mobile (with focus on different iPhone models) so that the bottom navigation is always visible, the chat input is fixed at the bottom, and long/multi-line messages remain easy to read without breaking the layout.
* **Current State**:
  * On some iPhone models, the bottom navigation bar can be partially or fully hidden behind the system home indicator or browser UI.
  * In the chat, the typeable input area scrolls together with the messages instead of staying fixed at the bottom.
  * Very long or multi-line messages are hard to read and can make the scroll behavior feel janky.
* **High-Level Strategy**:
  * Adjust the main mobile shell and bottom navigation to respect safe area insets and use a flex column layout with internal scroll containers instead of relying on global `vh`/`overflow` behavior.
  * Redesign the chat screen with a fixed input bar at the bottom and a dedicated scrollable messages area above it.
  * Improve message bubble styling and constraints so long texts wrap correctly and remain readable on all breakpoints.
* **Route / Scope**:
  * Chat entry point: existing chat screen composed via `DashboardScreen` / `useChat` (no new route required).
  * Global layout: `AppShell`, `BottomNavigation`, and any shared mobile layout wrappers.
* **Responsive Layout**:
  * **Mobile (iPhone focus)**: Full-height app shell using `min-h-screen` + safe area insets; content is a flex column where the main area (`flex-1`) contains the chat; the bottom navigation is always visible; within the chat, only the message list scrolls while the input is fixed.
  * **Tablet**: Same behavior as mobile, with more horizontal space. Chat can occupy a main column with optional side content, but the input remains fixed at the bottom of the chat column and the navigation stays visible.
  * **Desktop**: Persistent sidebar on the left, chat in a main column; the chat column uses full height with the message list scrollable and input fixed at the bottom; no “phone frame” constraint on large screens.
* **Server vs Client**:
  * **Client Components**: Chat screen (message list + input), bottom navigation, and any layout component that depends on browser APIs, scrolling, or viewport behavior must use `'use client'`.
  * **Server Components**: Route-level pages that only compose client components and optionally fetch initial data remain server components by default.

### 2. Component Architecture
* **New / Updated Components**:
  * `ChatScreen` (or equivalent existing chat container component):
    * **Responsibility**: Own the full chat layout for the screen: optional header, scrollable message list, and fixed input area at the bottom.
    * **Props**: `messages`, `onSendMessage`, `isSending`, `hasMore`, `onLoadMore`, `currentUserId`.
  * `ChatMessageList`:
    * **Responsibility**: Render a vertically scrollable list of messages with proper wrapping, max-width constraints, and spacing. Optionally handle “load more” at the top.
    * **Props**: `messages`, `currentUserId`, optional callbacks like `onMessageClick`.
  * `ChatInputBar`:
    * **Responsibility**: Fixed input bar at the bottom of the chat, with a growing `Textarea` (up to a max height) and a send `Button`.
    * **Props**: `value`, `onChange`, `onSubmit`, `isSending`, optional `placeholder`.
  * `MobileAppShell` / adjustments to existing `AppShell` and `BottomNavigation`:
    * **Responsibility**: Provide a consistent mobile layout that:
      * Uses a flex column layout with `min-h-screen`.
      * Keeps bottom navigation visible, with padding for safe area insets.
      * Exposes a content area that can host full-height screens like chat.
* **ShadcnUI Primitives**:
  * **Layout**: `ScrollArea`, `Card`, `Separator` where needed.
  * **Inputs**: `Textarea`, `Input`, `Button`.
  * **Feedback**: `Skeleton` for loading chat history, optional `Tooltip` on desktop.
* **Icons (Lucide React)**:
  * `Send` icon for the send button in `ChatInputBar`.
  * `MessageCircle` or `MessagesSquare` for the chat tab in `BottomNavigation` (if not already present).
  * Optional `ChevronDown` for a “scroll to latest” floating button when the user is not at the bottom of the message list.

### 3. State & Data Fetching
* **API Interactions**:
  * Reuse existing chat logic built on top of `useChat` and the shared Axios `api` instance from `@/lib/api`.
  * Ensure that all network logic remains in hooks/services; the new layout components are purely presentational and stateful only for UI concerns (scroll, local input).
* **Local State**:
  * `inputValue: string` to control the chat input.
  * `isAtBottom: boolean` to track whether the user is scrolled near the bottom, controlling auto-scroll and “scroll to latest” UI.
  * Optional `isInitialLayoutReady: boolean` if any layout measurement is needed to avoid initial jumps.
* **Global Context**:
  * Continue using `AuthContext` for `currentUser` and user ID; pass `currentUserId` into chat components to style messages differently for the current user.
  * Do not introduce new global context just for scroll/layout; keep that local to chat components.

### 4. Implementation Steps
1. **Refine Mobile App Shell & Bottom Navigation**
   1.1. Update `AppShell` to use a flex column structure with `min-h-screen`, where the main content uses `flex-1` and `overflow-hidden`, and the bottom navigation is rendered in a non-scrolling container at the bottom.  
   1.2. Add safe area padding using CSS environment variables (e.g. `env(safe-area-inset-bottom)`) to the bottom navigation container so it is not hidden behind the iOS home indicator.  
   1.3. Ensure that `html`/`body` styling does not enforce global `overflow: auto` with `100vh` that conflicts with internal scroll containers on iOS Safari.

2. **Redesign Chat Layout With Fixed Input**
   2.1. In the chat screen component, wrap the content in a `flex flex-col h-full` (or `min-h-screen` within the app shell content area) container so it fills the available height.  
   2.2. Place `ChatMessageList` into a `flex-1 overflow-y-auto` container so only the messages scroll.  
   2.3. Place `ChatInputBar` in a fixed (within the screen) bottom area, using either flex layout (last child) or `position: sticky` with `bottom: 0`, and include padding for safe area and bottom navigation height.  
   2.4. Verify keyboard behavior on iOS: when the software keyboard appears, the chat input should stay visible and the message list should resize above it.

3. **Improve Long / Multi-line Message Readability**
   3.1. Constrain message bubble width (for example, a max width of a percentage of the viewport or container) so lines do not stretch too wide on desktop and tablets.  
   3.2. Use text wrapping utilities (e.g. `whitespace-pre-wrap`, `break-words`) in chat bubbles to ensure that long words and multi-line texts wrap within the bubble instead of overflowing.  
   3.3. For extremely long messages, consider a max height for the bubble with internal scroll and subtle visual cues (like a gradient at the bottom) to indicate additional content.  
   3.4. Keep vertical spacing and alignment consistent so long messages do not visually overlap or create confusing gaps.

4. **Scrolling Behavior & Quality-of-Life**
   4.1. Implement logic in `ChatMessageList` (or a parent hook) to detect whether the user is near the bottom of the list (`isAtBottom`).  
   4.2. When new messages arrive, automatically scroll to bottom only if `isAtBottom` is `true`; otherwise, keep the user’s scroll position and show a small “scroll to latest” button above the input bar.  
   4.3. Optionally support “load more” at the top of the list for older messages without breaking the scroll position.  
   4.4. Ensure smooth scrolling to bottom for both sent and received messages.

5. **Cross-Device Testing & Fine-Tuning**
   5.1. Use browser devtools responsive mode to test at least: iPhone SE, iPhone 13/14/15, and a larger iPhone Pro/Max model. Confirm that:
       * Bottom navigation is always visible and not hidden behind browser or system UI.
       * Chat input remains fixed at the bottom and visible while typing.  
   5.2. Test on tablet resolutions to ensure the chat column layout works well with additional horizontal space (no excessive empty areas, messages remain readable).  
   5.3. Test on desktop with sidebar + chat column to confirm that the chat column uses full height, messages scroll correctly, and the input is fixed at the bottom.  
   5.4. Adjust spacing, font sizes, and line heights for message bubbles to optimize readability on small screens.

### 5. Validation Checklist
- [ ] Bottom navigation uses safe area insets and remains visible across common iPhone models.  
- [ ] Chat input area is fixed at the bottom and does not scroll with messages; only the message list scrolls.  
- [ ] Long and multi-line messages wrap correctly, stay within constrained bubble widths/heights, and remain easy to read.  
- [ ] All chat-related API calls continue to use the shared `api` instance from `@/lib/api`; no new direct `fetch`/`axios` calls are introduced in components.  
- [ ] No `any` types are used in new or updated TypeScript components; all props and hooks are strongly typed.  
- [ ] Behavior is manually verified on mobile (multiple iPhone presets), tablet, and desktop to ensure a consistent and robust chat UX.

