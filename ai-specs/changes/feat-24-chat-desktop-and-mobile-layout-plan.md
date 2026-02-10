## 🎨 Frontend Implementation Plan: feat-24 — Chat layout on desktop and mobile

### 1. Analysis & Design
* **Goal**: Keep the current mobile chat experience (full-screen, with a back button) but hide the bottom navigation while in chat; on desktop, render chat inside the main dashboard shell with persistent sidebar/top navigation and no back button in the chat header.
* **Route**: `app/chat/page.tsx`
* **Responsive Layout**:
  * **Mobile**:
    * When user taps the `Zefa` FAB in the bottom navigation, navigate to `/chat`.
    * `/chat` should be a **full-screen immersive chat**: no bottom nav visible; use the existing chat header (avatar, status, search, theme toggle) plus the **back button** at the top-left to return to the previous screen.
    * Chat input remains stuck to the bottom; scrollable messages above; safe-areas respected as today.
  * **Tablet/Desktop**:
    * `/chat` should render **inside the main App shell**: keep `DesktopSidebar` on the left and the global background from `AppShell`.
    * In this mode, chat should appear as a centered, responsive panel (e.g. max width similar to other pages, with optional rounded/bordered card styling) instead of trying to occupy `100dvh`.
    * The **back button must be hidden** on `lg` and up; the user navigates using the sidebar/top navigation instead.
* **Server vs Client**:
  * `app/chat/page.tsx`: stays as a **client component** (already `'use client'`) because it uses `useAuth`, `useEffect`, and `useRouter`.
  * `ZefaChatScreen`: remains a **client component** (already `'use client'`) because it uses state, hooks, and browser APIs.
  * `AppShell` and `BottomNavigation` remain client components as currently implemented.

### 2. Component Architecture
* **New Components**:
  * **No new top-level components are strictly required**. Behavior can be achieved by:
    * Extending `AppShell` to differentiate **desktop navigation** vs **mobile bottom navigation** visibility.
    * Extending `ZefaChatScreen` props or internal logic to support layout variants (full-screen vs embedded) driven by breakpoints and/or props.
* **Adjustments to Existing Components**:
  * `AppShell`:
    * Introduce separate flags for **auth routes** and **chat mobile route**:
      * `const isAuthRoute = ["/login", "/register", "/onboarding"].includes(pathname)`
      * `const isChatRoute = pathname.startsWith("/chat")`
    * Derive:
      * `hideDesktopNavigation = isAuthRoute`
      * `hideMobileNavigation = isAuthRoute || isChatRoute`
    * Use `hideDesktopNavigation` for `DesktopSidebar` visibility and `lg:ml-72` layout spacing.
    * Use `hideMobileNavigation` to control whether `BottomNavigation` is rendered.
  * `ZefaChatScreen`:
    * Keep the current structure, but:
      * Wrap the root `div` in classes that behave as **full-height full-screen on mobile** and **embedded card-style panel on desktop**, e.g.:
        * Mobile: `h-[100dvh]` / `flex flex-col` as today.
        * Desktop: add responsive classes such as `lg:my-6 lg:rounded-3xl lg:border lg:bg-card/70 lg:backdrop-blur` while avoiding forcing viewport height in the presence of the app shell.
      * Make the header **back button** mobile-only using Tailwind responsive utilities:
        * Wrap the `<button>` with `className="... lg:hidden"` or add `lg:hidden` to the back button container.
      * Optionally fine-tune padding/margins so embedded desktop chat aligns visually with other main content cards.
  * `ChatPage` (`app/chat/page.tsx`):
    * Remove the extra full-screen background wrapper when inside `AppShell` so the page returns just `<ZefaChatScreen />`, letting `AppShell` handle the mesh gradient and global background.
* **ShadcnUI Primitives**:
  * Continue using:
    * `Button` (chat send button).
    * `Input` (chat input).
    * Existing `ThemeToggle` and other UI elements as-is.
  * No new Shadcn primitives required for this feature.
* **Icons**:
  * Reuse current icons: `ArrowLeft`, `Sparkles`, `Search`, `Send`, `Plus`, etc.
  * No new Lucide icons are required.

### 3. State & Data Fetching
* **API Interactions**:
  * No changes to existing chat API behavior.
  * `useChat` hook (`@/lib/hooks/useChat`) continues to be the single source of truth for chat messages, sending messages, retry logic, and typing state.
* **Local State**:
  * Keep all current state in `ZefaChatScreen` (`inputValue`, `isInputFocused`, search state, scroll state) unchanged.
  * No new state is required for mobile vs desktop because visibility differences can be handled via Tailwind’s responsive classes and route-based behavior in `AppShell`.
* **Global Context**:
  * `useAuth()` in `ChatPage` remains as-is for guarding access to `/chat`.
  * `AppShell` continues to rely on `useAuth()` for `logout` and user profile data.

### 4. Implementation Steps
1. **Refine navigation visibility in `AppShell`**  
   * In `AppShell`, replace the single `hideNavigation` flag with:
     * `isAuthRoute`, `isChatRoute`.
     * `hideDesktopNavigation` (only for auth routes).
     * `hideMobileNavigation` (for auth routes **and** for `/chat`).
   * Update:
     * `DesktopSidebar` rendering to depend on `!hideDesktopNavigation`.
     * `main` container `lg:ml-72` and `max-w-6xl` logic to depend on `!hideDesktopNavigation`.
     * `BottomNavigation` rendering inside `lg:hidden` wrapper to depend on `!hideMobileNavigation`.
   * Verify:
     * Bottom navigation is visible on mobile for dashboard/transactions/insights/settings.
     * Bottom navigation is **hidden on mobile** for `/chat`.
     * Desktop sidebar remains visible for `/chat`.
2. **Simplify `ChatPage` layout to rely on `AppShell`**  
   * In `app/chat/page.tsx`, keep the `useAuth` guard and skeleton but change the final render to:
     * Return just `<ZefaChatScreen />` (no extra full-screen wrapper with mesh gradient), so the page layout is consistent with other routes inside the shared app shell.
3. **Adjust `ZefaChatScreen` for desktop-embedded layout**  
   * Modify the root container:
     * Keep full-height immersive layout on mobile (as today).
     * Add responsive desktop classes to present chat as an embedded panel:
       * Add `lg:my-6 lg:rounded-3xl lg:border lg:bg-card/70 lg:backdrop-blur` (or a similar combination from your design system).
       * Ensure vertical sizing uses `min-h` / flex rather than forcing 100dvh when within a constrained app shell.
   * Confirm message list and input area still behave correctly with the new paddings/margins on `lg` screens.
4. **Make the back button mobile-only**  
   * In `ZefaChatScreen` header:
     * Add `lg:hidden` to the back button container (`<button onClick={() => router.back()} ...>`).
     * Optionally adjust flex alignment so that on desktop, the header content (avatar, name, status, search, theme toggle) remains centered/balanced without an empty space reserved for the back button.
   * Verify behaviors:
     * On mobile: tapping `Zefa` in bottom nav opens full-screen chat with back button; back returns to previous route and bottom nav reappears.
     * On desktop: no back button; sidebar is visible and user navigates via sidebar.
5. **Visual & responsive QA**  
   * Test `/chat` on:
     * Small mobile width: bottom nav hidden, chat is immersive, safe area respected; back button visible.
     * Medium/tablet width: ensure the breakpoint behavior feels correct (either immersive or embedded, depending on chosen Tailwind classes).
     * Large desktop width: sidebar visible, bottom nav hidden, chat panel centered and visually integrated into the dashboard layout; no back button.
   * Confirm no layout regressions for other routes (`/`, `/transactions`, `/insights`, `/settings`, `/login`, `/register`, `/onboarding`).

### 5. Validation Checklist
- [ ] `/chat` uses the shared `AppShell` background and layout (no duplicated full-screen wrappers inside `ChatPage`).  
- [ ] `AppShell` controls **desktop sidebar** and **mobile bottom navigation** visibility separately; `/chat` hides only the mobile bottom navigation.  
- [ ] `ZefaChatScreen` is full-screen and immersive on mobile, but embedded within the main panel on desktop.  
- [ ] The chat **back button** is visible only on mobile and correctly returns to the previous route.  
- [ ] Desktop view maintains the main sidebar and allows navigation without a redundant back button.  
- [ ] No `any` types are introduced; existing TypeScript typings for hooks/components remain intact.  
- [ ] All navigation and API calls still use the `api` instance and existing hooks (no direct `fetch`/`axios` in components).  
