## Frontend Implementation Plan: feat-5 — Improve Frontend Style (Strictly Align `frontend/` with `ze-finance-v0/` UI)

### 1. Analysis & Design

- **Goal**: Make the production frontend under `frontend/` match the v0 reference app under `ze-finance-v0/` **as the single source of truth for visual design**, including:
  - **Colors/tokens** (OKLCH semantic tokens + light/dark)
  - **Typography** (Inter + consistent scale/weights)
  - **Icons** (Lucide set + consistent sizing/stroke)
  - **Navigation** (desktop sidebar + mobile bottom nav + FAB behavior)
  - **Screen chrome** (mesh background, glass cards, gradient headers, hover-lift, skeleton shimmer)
  - **Chat + Insights** pages: show a **“Coming soon”** notice at the top, but can be **fake-functional** using local state/mock data for now.

- **Primary reference** (strict): `ze-finance-v0/`
  - Tokens and global utility classes: `ze-finance-v0/app/globals.css`
  - Navigation patterns: `ze-finance-v0/components/desktop-sidebar.tsx`, `ze-finance-v0/components/bottom-navigation.tsx`
  - Screen style patterns: `ze-finance-v0/components/dashboard-screen.tsx`, `ze-finance-v0/components/transactions-screen.tsx`
  - Fake functional pages: `ze-finance-v0/components/zefa-chat-screen.tsx`, `ze-finance-v0/components/insights-screen.tsx`

- **Target**: `frontend/` remains the only frontend app that should be run for the MVP.
  - **Do not** move style code back into `ze-finance-v0/`.
  - **Do** copy/adapt design primitives and screen composition patterns from `ze-finance-v0/` into `frontend/` while keeping the architecture defined in `.cursor/rules/frontend-standards.mdc`.

- **Responsive layout strategy**
  - **Mobile**: gradient header per screen, bottom navigation, FAB for primary action (add transaction), touch targets \(\ge 44px\).
  - **Tablet**: grid-based layouts (2 columns where helpful) + charts below the fold if heavy.
  - **Desktop**: persistent sidebar (collapsible), wide content container, hover affordances, avoid “phone frame”.

- **Server vs Client**
  - **Client**: all authenticated routes currently rely on `localStorage` token + interactive UI, so screens remain client components.
  - **Server**: keep `app/layout.tsx` as server; keep route shells thin and delegate UI composition to components.

---

### 2. Visual Design System: “Strict v0 parity”

#### 2.1 Tokens, theming, and global styles
- **Authoritative tokens**: keep `frontend/app/globals.css` matching `ze-finance-v0/app/globals.css`:
  - OKLCH semantic tokens (`--background`, `--primary`, `--accent`, `--success`, etc.)
  - Shared class utilities: `.glass-card`, `.gradient-header`, `.fab-glow`, `.bg-mesh-gradient`, `.hover-lift`, `.skeleton-shimmer`, `.nav-active-dot`, etc.
- **Theme**:
  - Ensure `ThemeProvider` is mounted in `frontend/app/layout.tsx`.
  - Ensure `ThemeToggle` variants (`header`, `standalone`) are used consistently per v0 patterns.

#### 2.2 Typography rules
- **Font**: Inter for UI, JetBrains Mono for code/numbers (already in layout). Keep `font-sans` and `tabular-nums` for currency.
- **Scale & casing** (match v0 patterns):
  - Desktop page title: `text-2xl font-bold tracking-tight`
  - Mobile header title: `text-base sm:text-lg font-semibold tracking-tight`
  - Section label: `text-xs uppercase tracking-wider text-muted-foreground`
  - KPI numbers: `text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight`
- **Consistency requirement**: pick one language style for UI copy (pt-BR recommended) and apply across navigation + headers + buttons for all pages (auth + dashboard + transactions + chat + insights).

#### 2.3 Iconography rules
- **Library**: `lucide-react` only.
- **Sizing**:
  - Nav icons: 20px (`h-5 w-5`)
  - FAB icon: 24px–26px (`h-6 w-6`) with thicker stroke for emphasis
  - Header icons: 20px
- **Meaning mapping** (keep consistent across app):
  - Dashboard/Home: `Home` / `Wallet`
  - Transactions: `Receipt`
  - Insights: `BarChart3`
  - Chat/AI: `Sparkles`

---

### 3. Navigation & Information Architecture

#### 3.1 Route map (unchanged)
- **Public**: `/login`, `/register`
- **Protected**: `/`, `/transactions`, `/insights`, `/chat` *(+ `/onboarding` if still in scope)*

#### 3.2 Desktop Sidebar (strict parity checklist)
- Collapsible sidebar: `w-72` expanded / `w-20` collapsed
- Header with gradient logo tile + “Zefa” gradient text
- Profile block (avatar, streak badge)
- Primary action “Add Transaction” button with glow (routes to `"/transactions?add=true"` in current architecture)
- Footer: Theme toggle + Sign out

#### 3.3 Mobile Bottom Navigation (strict parity checklist)
- 4 items:
  - Home (`/`)
  - Insights (`/insights`)
  - Zefa (FAB, `/chat`)
  - Transactions (`/transactions`)
- Active dot indicator (`.nav-active-dot`)
- FAB elevated with `.fab-glow` and negative top margin
- Hide bottom nav on desktop and optionally on `/chat` if chat uses its own full-screen chrome.

---

### 4. Page-by-Page Styling Alignment Tasks

#### 4.1 Auth pages (`/login`, `/register`)
- **Goal**: keep the premium “split layout” on desktop + animated blobs and consistent card styling on mobile.
- **Parity tasks**:
  - Use `.bg-mesh-gradient` in background areas where v0 uses it.
  - Ensure form card uses `.glass-card` with consistent radius (`--radius`).
  - Align feature cards, spacing, and hover states to v0 (avoid random shadow/border variants).
  - Ensure all auth copy is consistent (choose pt-BR or English and apply to both login/register).

#### 4.2 Dashboard (`/`)
- **Goal**: preserve v0 layout (hero balance card, stats row, budget card, insights card, chart card, recent transactions card).
- **Parity tasks**:
  - Ensure hero card includes background blobs and `.hover-lift`.
  - Ensure headers match v0 (mobile gradient header, desktop translucent header).
  - Ensure currency formatting uses pt-BR with `tabular-nums`.
  - Ensure empty state and list animations match v0 (`.stagger-item`).

#### 4.3 Transactions (`/transactions`)
- **Goal**: match v0 header + summary cards + filters + grouped list + FAB.
- **Parity tasks**:
  - Summary cards use `.glass-card border-0`, consistent icon colors (success/destructive/primary).
  - Filters: ensure input and buttons match v0 spacing/radius and focus rings.
  - Group headers use uppercase month-year formatting (`pt-BR`) consistent with v0.
  - FAB: consistent position and glow.
  - Drawer: ensure drawer chrome matches `.swipe-drawer` styles from `globals.css`.

---

### 5. “Coming soon but fake-functional” for Chat and Insights

#### 5.1 Shared requirement: top “Coming soon” callout
- Add a reusable banner component (example: `components/feedback/ComingSoonBanner.tsx`) to be rendered **at the top** of:
  - `/chat`
  - `/insights`
- Banner spec:
  - Visual: compact glass card/alert style (`.glass-card border-0`)
  - Icon: `Sparkles` or `Info`
  - Copy (pt-BR recommended): “Em breve” + short explanation that this is a preview.
  - Optional CTA: “Saiba mais” (no-op) or link to roadmap (future).

#### 5.2 Insights page (`/insights`) — fake but useful
- Replace the placeholder card with a real “InsightsScreen”-style layout adapted from:
  - `ze-finance-v0/components/insights-screen.tsx`
- Data strategy (MVP-friendly):
  - Use `/transactions` list already fetched in `/transactions` or fetch locally via `api.get("/transactions")`.
  - Compute metrics client-side (monthly income/expenses, category totals, 6-month trend).
  - If backend summary exists and is already fetched on `/`, reuse it optionally, but do not block the page on it.
- UX:
  - Skeleton loading state using `.skeleton-shimmer`
  - Responsive grid: 2 columns on desktop, 1 column on mobile, 3 columns on xl where appropriate
  - Keep charts below the fold on mobile if performance suffers (optional).

#### 5.3 Chat page (`/chat`) — fake but interactive
- Replace the placeholder card with a real “ZefaChatScreen”-style UI adapted from:
  - `ze-finance-v0/components/zefa-chat-screen.tsx`
- Behavior constraints:
  - No backend integration required.
  - Simulate assistant responses locally (rule-based responses) and keep them **clearly labeled** as preview via the “Coming soon” banner.
- UX parity:
  - Sticky header, online status dot, theme toggle, message bubbles, typing indicator, suggestion chips, and input bar matching v0.
  - Keep navigation behavior consistent: entering chat from bottom nav FAB, leaving chat via back button or nav.

---

### 6. Component Architecture (where code should live)

#### 6.1 New/updated components (proposed)
- **Shared**
  - `components/feedback/ComingSoonBanner.tsx`: reusable callout used on `/chat` and `/insights`.
- **Features**
  - `components/chat/ZefaChatScreen.tsx`: adapted from v0.
  - `components/insights/InsightsScreen.tsx`: adapted from v0.
- **Pages**
  - `app/chat/page.tsx`: auth guard + `AppShell` + coming soon banner + `ZefaChatScreen`
  - `app/insights/page.tsx`: auth guard + `AppShell` + coming soon banner + `InsightsScreen`

#### 6.2 ShadcnUI primitives to add (only if needed)
- Consider adding (via shadcn):
  - `Badge` (for “Coming soon” pill)
  - `Alert` (optional alternative to banner)
  - `Separator` (for section dividers in chat/insights)
  - Keep customization via tokens and utility classes; do not hardcode colors.

---

### 7. Implementation Steps (do in this order)

1. **Define “v0 parity checklist”** (quick doc block inside this plan’s PR description):
   - Tokens, typography, nav behaviors, and key classes that must match v0.
2. **Unify UI copy language**:
   - Pick pt-BR (recommended) or English.
   - Update navigation labels + page titles + button text for consistency.
3. **Add `ComingSoonBanner`** component and render it on `/chat` and `/insights` at the top.
4. **Implement Insights “fake but useful” screen**:
   - Add `components/insights/InsightsScreen.tsx` by adapting v0’s `insights-screen.tsx`.
   - Wire data loading and loading skeleton behavior.
5. **Implement Chat “fake but interactive” screen**:
   - Add `components/chat/ZefaChatScreen.tsx` by adapting v0’s `zefa-chat-screen.tsx`.
   - Keep simulated responses and suggestion chips.
6. **Align any remaining style drift** on dashboard/transactions/auth:
   - Ensure headers, grid spacing, card classes, and hover states match v0 patterns.
7. **Manual UX validation** across breakpoints:
   - Mobile: bottom nav + FAB + touch sizing
   - Desktop: sidebar collapse/expand + hover affordances
   - Dark mode: all pages readable, banner contrast ok

---

### 8. Validation Checklist

- [ ] `frontend/app/globals.css` tokens and utility classes match `ze-finance-v0/app/globals.css`.
- [ ] Navigation matches v0: desktop sidebar + mobile bottom nav with FAB and active dot.
- [ ] Typography scale and casing follow v0 patterns across screens (no random headings).
- [ ] `/chat` and `/insights` show a top “Coming soon” banner and still provide fake-functional UI.
- [ ] No `any` in TypeScript; components remain strictly typed.
- [ ] Uses `@/lib/api` for any API calls (no direct `axios` usage in components).
- [ ] Responsive-first verified on mobile/tablet/desktop; no “phone frame” constraint on desktop authenticated pages.

