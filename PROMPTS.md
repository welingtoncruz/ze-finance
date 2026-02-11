## Ze Finance — Prompts Used

This document explains how the Ze Finance (Zefa) project scope, architecture, and execution framework were defined, and it records the key prompts used along the way (in the same sequence they were applied).

Before starting implementation, after defining the project idea and scope, I set up the full **development environment for AI-assisted delivery** inside Cursor: **agents**, **rules**, and **chat commands**. This ensured the project could be executed with consistent standards from day one, with repeatable planning and implementation workflows.

---

### 1) The Strategic Pivot: From the "Complex Dream" to a "Viable MVP"

**Initial prompt (summary)**

> "Act as a Senior Product Manager. Analyze my original idea (a complex finance system integrated with WhatsApp and AI from day 1) and critique its technical viability. Propose an alternative path focused on delivering value quickly ('Walking Skeleton'), postponing costly integrations to phase 2."

**Reasoning (why I did this)**

I used a **complexity risk-reduction** strategy. Trying to implement **AI**, **WhatsApp API**, and a "banking core" simultaneously is a classic engineering failure mode: **over-engineering** before proving the product's core value.

By pivoting to a **Walking Skeleton Web MVP**, I ensured we would validate:
- the **core domain** first (income, expense, balance, summary)
- the **foundational infrastructure** early (Docker-first local environment, authentication, database connectivity)

This creates a solid base before investing time and money in external integrations (e.g., Meta APIs or AI providers).

---

### 2) Stack and Architecture Choice: Performance with Simplicity

**Technical prompt (summary)**

> "Define the ideal technology stack for an MVP that must be fast, scalable for AI in the future, but simple now. Generate architecture standards (`standards.mdc`) for Backend (Python/FastAPI) and Frontend (Next.js), focusing on a Simplified Layered Architecture, explicitly rejecting microservices or 'pure DDD' at this stage."

**Reasoning (why I did this)**

I applied **YAGNI (You Aren't Gonna Need It)**.

- I chose **Python for the backend** to keep future AI integration straightforward (ecosystem leverage).
- I chose a **modular monolith** (simplified layered architecture) to move fast and keep operational complexity low.

Most importantly, I created **system-level standards ("rules of engagement")** so the AI behaves like a disciplined engineering teammate:
- mandatory type hints on Python functions
- clear separation of concerns (routes vs services/CRUD vs data)
- consistent naming conventions and testing expectations

This prevents the typical MVP outcome: a fast prototype turning into unmaintainable spaghetti.

---

### 3) The Responsive-First Pivot: Multi-Device UX (No Figma)

**Updated UI/UX prompt (responsive-first)**

> You are a senior product designer and UX/UI strategist specialized in responsive web applications, modern UI trends, and financial technology tools. I have a prototype of a personal finance tracking app built using V0 (no-code). Initially it was designed as mobile-first, but I now want to pivot to a **responsive-first strategy** — ensuring it performs beautifully and intelligently across **desktop, tablet, and mobile**, making full use of each device's strengths.
>
> Your mission:
> 1. Analyze my app concept: a personal finance tool focused on simplicity, engaging data visualization, and seamless user experience.
> 2. Apply **modern best practices in responsive UI/UX design**, with screen-adaptive layouts, optimized interactions, and scalable features.
> 3. Suggest enhancements to the **layout**, **navigation flow**, and **component design** so they work intuitively across devices.
> 4. Emphasize a **modern visual identity** by using:
>    - **Vibrant, rich colors** in both **light and dark modes**, aligned with the **financial theme** (e.g., confidence, growth, clarity)
>    - Color inspiration from tools like **Cursor** and modern **AI-related platforms**, known for using futuristic, bold, and clean palettes
>    - A balance between **playful energy and professional clarity**
> 5. Include responsive-specific UI features such as:
>    - Adaptive dashboards and collapsible elements
>    - Smooth transitions, microinteractions, and gesture-friendly components
>    - Mobile vs. desktop-specific usability optimizations (e.g., hover effects on desktop, swipe actions on mobile)
> 6. Structure your suggestions in clear sections:
>    - Visual Design (color system, typography, spacing)
>    - Responsive Layout Strategy
>    - UX Enhancements
>    - Device-Specific Features
>    - Performance & Optimization
>    - Branding Consistency
> 7. Optionally provide visual references or app examples that match this design language.
>
> Ask me any questions about my current prototype, audience, or brand direction to better tailor your recommendations.

**Reasoning (why this is better now)**

The earlier "Strict Mobile-First" container constraint was useful to keep the UI coherent without a designer, but it underutilizes desktop/tablet space.

With a **responsive-first** strategy we can:
- present richer dashboards on desktop (multi-column, persistent filters/details)
- keep mobile fast and gesture-friendly (bottom nav, large touch targets)
- maintain one consistent identity via tokens (light/dark) and component variants (ShadcnUI)

---

### 4) Implementation Workflow: Planning → Development → Documentation

**Cursor Chat Commands Available:**

The project uses structured Cursor commands for consistent development workflows:

**Planning Phase:**
- `/plan-backend-ticket [ticket-file]` — Creates comprehensive backend implementation plans
- `/plan-frontend-ticket [ticket-file]` — Creates frontend implementation plans with component architecture

**Development Phase:**
- `/develop-backend [ticket-file]` — Implements backend features following the plan
- `/develop-frontend [ticket-file]` — Implements frontend features following the plan

**Documentation Phase:**
- `/update-docs` — Updates technical documentation based on code changes

**Example Usage:**

```
/develop-frontend @ai-specs/changes/feat-6-layout-improve-app-plan.md desenvolva o plano
```

This command:
1. Reads the implementation plan from the specified file
2. Analyzes existing codebase structure
3. Implements all features according to the plan
4. Follows project standards (TypeScript strict, responsive-first, pt-BR UI text)
5. Creates/updates components as needed
6. Handles state management, API integration, and responsive layouts

**Key Command Details:**

**`/develop-frontend` Command:**
- **Role**: Senior Frontend Engineer and UI Architect
- **Process**:
  1. Analyze Figma design (if provided) and ticket specs
  2. Generate implementation plan (component tree, file structure)
  3. Write React code (components, styles, reusable elements)
  4. Follow component-driven development (Atomic Design)
  5. Apply best practices (accessibility, responsive layout)
  6. Handle feedback loop for rule improvements

**`/update-docs` Command:**
- Uses `.cursor/rules/documentation-standards.mdc` to:
  1. Review all recent changes in codebase
  2. Identify which documentation files need updates
  3. Update affected documentation files in English
  4. Maintain consistency with existing documentation structure
  5. Report which files were updated and what changes were made

**Recent Implementation Example (feat-6 - Layout Improvements):**

The `/develop-frontend` command was used to implement:
- Icon-grid category picker (`CategoryPicker.tsx`) replacing dropdown selects
- Unified transaction form (`TransactionForm.tsx`) for add/edit operations
- Edit transaction drawer (`EditTransactionDrawer.tsx`) with local-only persistence
- Mobile account drawer (`MobileAccountDrawer.tsx`) with logout functionality
- Improved transaction summary cards with centered layout and icons
- Bottom navigation alignment fixes
- Branding corrections (Ze Finance vs Zefa, masculine gender)

All changes followed:
- Responsive-first design principles
- TypeScript strict typing (no `any`)
- pt-BR for user-facing text, English for technical artifacts
- Component reusability and clean architecture
- Project standards from `.cursor/rules/`

---

### 6) AI Chat Agent Backend Implementation (feat-8)

**Implementation Plan:**
The `/develop-backend` command was used to implement the Zefa AI chat agent backend:

**Key Features Implemented:**
- Database models for chat messages and conversation summaries
- AI gateway with provider abstraction (OpenAI/Anthropic)
- Tool-based function calling for finance operations:
  - `get_balance`: Get user's current balance
  - `list_transactions`: List transactions with filters
  - `create_transaction`: Create transactions via natural language
  - `analyze_spending`: Analyze spending patterns
- Chat persistence and conversation memory
- Ephemeral API key management (in-memory, TTL-based)
- Integration tests with mocked AI provider calls

**Architecture:**
- Modular structure: `app/ai/` (gateway, tools, prompt) and `app/chat/` (CRUD, routes, schemas)
- Provider-agnostic design allows switching between OpenAI and Anthropic
- Strict data isolation: all operations scoped by authenticated `user_id`
- Portuguese (pt-BR) responses for users, English for technical artifacts

**Testing:**
- Comprehensive integration tests in `tests/test_chat_agent.py`
- Tests cover: balance queries, transaction creation, user isolation, provider errors
- Uses `respx` for mocking AI provider HTTP calls

**Documentation Updates:**
- Updated `PROJECT_DOCUMENTATION.md` with chat features
- Updated `TECHNICAL_DOCUMENTATION.md` with data model changes
- Updated `backend/README.md` with AI configuration and endpoints
- Updated `PROMPTS.md` with implementation details

---

### 7) Chat Frontend Integration (feat-9)

**Implementation Plan:**
The `/develop-frontend` command was used to implement the frontend chat integration:

**Key Features Implemented:**
- Backend-integrated chat UI replacing simulated responses
- `useChat` hook with localStorage persistence for conversation continuity (survives browser close/reopen)
- Optimistic UI: user messages appear immediately with "sending" status
- Auto-scroll to latest message and typing indicator
- Error handling with retry functionality for failed messages
- Transaction confirmation cards with Electric Lime styling (ready for backend metadata)
- Responsive-first design maintained (mobile/tablet/desktop)

**Component Architecture:**
- `ChatBubble.tsx`: Renders messages with status indicators (sending/sent/error) and retry buttons
- `TypingIndicator.tsx`: Shows "Zefa está digitando..." animation
- `TransactionConfirmationCard.tsx`: Electric Lime styled success card for transaction confirmations
- `ZefaChatScreen.tsx`: Refactored to use `useChat` hook, removed voice/simulation logic

**State Management:**
- `useChat` hook (`lib/hooks/useChat.ts`): Manages messages array, conversation ID, typing state
- localStorage persistence (key: `zefa_chat_v1:default`) for conversation continuity
- Optimistic updates: user messages appear immediately, then updated to "sent" on success
- Error states: failed messages show retry buttons with user-friendly error messages

**API Service Layer:**
- `lib/chat/service.ts`: Normalization layer for backend API
- Handles current format (`POST /chat/messages`) and ready for future format (`POST /chat`)
- Error mapping: Timeout (30s), network errors, 401 redirects
- Returns normalized `ApiChatResponse` structure

**Styling:**
- Added Electric Lime color tokens to `globals.css` for transaction confirmations
- Maintains responsive-first design principles
- User bubbles: Indigo theme; Assistant bubbles: muted theme

**Testing:**
- Integration tests (`tests/integration/chat-integration.test.tsx`): 10 tests covering UI flows
- Unit tests (`tests/unit/useChat.test.ts`): 10 tests for hook logic
- Unit tests (`tests/unit/chat-service.test.ts`): 7 tests for API service
- All 86 frontend tests passing

**Documentation Updates:**
- Updated `PROJECT_DOCUMENTATION.md` with chat integration ticket and details
- Updated `TECHNICAL_DOCUMENTATION.md` with frontend architecture changes
- Updated `PROMPTS.md` with implementation details

---

### 5) Methodology Summary (for the form)

My journey was guided by **technical pragmatism**. Instead of starting by coding complex features, I invested time in refining scope and configuring the AI environment (context + rules).

I effectively turned the AI from "random code generator" into a "team member" that follows strict standards, enabling me to build a robust system foundation (Python/Next.js) as a solo developer—while approximating the quality and consistency of a full engineering team.

**The workflow is now:**
1. **Plan** → Generate comprehensive implementation plans (`/plan-*-ticket`)
2. **Develop** → Execute plans with AI assistance following standards (`/develop-*`)
3. **Document** → Keep documentation synchronized with code changes (`/update-docs`)
4. **Iterate** → Refine based on feedback and learnings