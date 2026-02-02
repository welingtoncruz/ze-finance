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

### 5) Methodology Summary (for the form)

My journey was guided by **technical pragmatism**. Instead of starting by coding complex features, I invested time in refining scope and configuring the AI environment (context + rules).

I effectively turned the AI from "random code generator" into a "team member" that follows strict standards, enabling me to build a robust system foundation (Python/Next.js) as a solo developer—while approximating the quality and consistency of a full engineering team.

**The workflow is now:**
1. **Plan** → Generate comprehensive implementation plans (`/plan-*-ticket`)
2. **Develop** → Execute plans with AI assistance following standards (`/develop-*`)
3. **Document** → Keep documentation synchronized with code changes (`/update-docs`)
4. **Iterate** → Refine based on feedback and learnings
