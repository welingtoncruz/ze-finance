## Ze Finance — Prompts Used

This document explains how the Ze Finance (Zefa) project scope, architecture, and execution framework were defined, and it records the key prompts used along the way (in the same sequence they were applied).

Before starting implementation, after defining the project idea and scope, I set up the full **development environment for AI-assisted delivery** inside Cursor: **agents**, **rules**, and **chat commands**. This ensured the project could be executed with consistent standards from day one, with repeatable planning and implementation workflows.

---

### 1) The Strategic Pivot: From the “Complex Dream” to a “Viable MVP”

**Initial prompt (summary)**

> "Act as a Senior Product Manager. Analyze my original idea (a complex finance system integrated with WhatsApp and AI from day 1) and critique its technical viability. Propose an alternative path focused on delivering value quickly ('Walking Skeleton'), postponing costly integrations to phase 2."

**Reasoning (why I did this)**

I used a **complexity risk-reduction** strategy. Trying to implement **AI**, **WhatsApp API**, and a “banking core” simultaneously is a classic engineering failure mode: **over-engineering** before proving the product’s core value.

By pivoting to a **Walking Skeleton Web MVP**, I ensured we would validate:
- the **core domain** first (income, expense, balance, summary)
- the **foundational infrastructure** early (Docker-first local environment, authentication, database connectivity)

This creates a solid base before investing time and money in external integrations (e.g., Meta APIs or AI providers).

---

### 2) Stack and Architecture Choice: Performance with Simplicity

**Technical prompt (summary)**

> "Define the ideal technology stack for an MVP that must be fast, scalable for AI in the future, but simple now. Generate architecture standards (`standards.mdc`) for Backend (Python/FastAPI) and Frontend (Next.js), focusing on a Simplified Layered Architecture, explicitly rejecting microservices or 'pure DDD' at this stage."

**Reasoning (why I did this)**

I applied **YAGNI (You Aren’t Gonna Need It)**.

- I chose **Python for the backend** to keep future AI integration straightforward (ecosystem leverage).
- I chose a **modular monolith** (simplified layered architecture) to move fast and keep operational complexity low.

Most importantly, I created **system-level standards (“rules of engagement”)** so the AI behaves like a disciplined engineering teammate:
- mandatory type hints on Python functions
- clear separation of concerns (routes vs services/CRUD vs data)
- consistent naming conventions and testing expectations

This prevents the typical MVP outcome: a fast prototype turning into unmaintainable spaghetti.

---

### 3) Constraint-Driven Design: The “No Designer” Solution (No Figma)

**Visual prompt (v0.dev-style summary)**

> "Act as a UI/UX Designer. Since I don’t have Figma, generate the frontend code with a strict constraint: 'Strict Mobile-First'. Even on desktop, the application must be confined to a centered container (`max-w-md`), simulating a native app, using ShadcnUI to guarantee immediate visual consistency."

**Reasoning (why I did this)**

I used **constraint-based prompt engineering**.

Generative UI tools often default to generic full-width layouts that break on mobile. Because the long-term product goal is a **mobile-like experience** (and later WhatsApp adjacency), I enforced the visual constraint from day one.

This:
- removed the need for dedicated design work early
- kept the UI coherent and navigable immediately
- ensured the product is responsive from the first implementation cycle


**vO prompt:**

Build a complete, functional prototype for "Ze Finance" or the nickname "Zefa", a personal finance web app designed with a "Strict Mobile-First" architecture.

TECH STACK:
- Framework: Next.js 14 (App Router)
- Styling: Tailwind CSS
- UI Components: ShadcnUI (Card, Button, Input, Select, Dialog, Tabs)
- Icons: Lucide React
- Charts: Recharts
- Theme: Emerald Green (Primary), White/Gray (Backgrounds)

CORE LAYOUT REQUIREMENT (CRITICAL):
- Although this is a web app, it must look exactly like a mobile app on desktop screens.
- Wrap the entire application logic inside a centralized container: `max-w-[480px] mx-auto min-h-screen bg-white shadow-2xl border-x border-gray-100`.
- The background outside this container should be `bg-gray-50`.

FEATURES TO IMPLEMENT (Single Page Application Simulation):

1. AUTH SCREEN (Login):
   - Simple, clean form: Email, Password.
   - "Enter" button.
   - Simulation: When clicking "Enter", save a mock token to localStorage and switch to the Dashboard view.

2. DASHBOARD SCREEN (Home):
   - Header: "Zefa Finance" + Logout Icon.
   - Summary Cards:
     - Big Card: "Current Balance" (e.g., R$ 1.250,00).
     - Small Row: "Income" (Green arrow up) and "Expense" (Red arrow down).
   - Chart Section: Use <Recharts> to show a Simple BarChart or DonutChart of "Expenses by Category".
   - Recent Transactions List: A scrollable list of 5 mock items (Icon, Category Name, Date, Amount colored green/red).

3. ADD TRANSACTION SCREEN (Fab or Tab):
   - A clean form to add a new record.
   - Fields: Amount (Currency), Type (Income/Expense Toggle), Category (Select), Date.
   - Button: "Save Transaction".
   - Interaction: Show a success toast and update the Dashboard numbers (mocked).

4. BOTTOM NAVIGATION:
   - Fixed at the bottom of the container.
   - Items: "Home" (Dashboard), "Add" (Plus Circle, highlighted), "History".

BEHAVIOR:
- Use React `useState` to manage the view switching (Auth vs Dashboard vs Add).
- Use `useEffect` to simulate a fake API call delay (loading spinners).
- Ensure the UI is polished, spacing is comfortable (p-4), and typography is readable.

---

### 4) Methodology Summary (for the form)

My journey was guided by **technical pragmatism**. Instead of starting by coding complex features, I invested time in refining scope and configuring the AI environment (context + rules).

I effectively turned the AI from “random code generator” into a “team member” that follows strict standards, enabling me to build a robust system foundation (Python/Next.js) as a solo developer—while approximating the quality and consistency of a full engineering team.

