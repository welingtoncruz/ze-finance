---
description: General development rules, core principles, and language standards for the Zefa Finance project (Python/Next.js). Applicable to all parts of the stack.
globs: ["**/*"]
alwaysApply: true
---

# General Project Standards - Zefa Finance

## 1. Core Principles

- **Walking Skeleton First**: Prioritize establishing end-to-end connectivity (Frontend -> API -> DB) over perfecting isolated components. A feature is only "done" when it works in the browser.
- **Small Steps**: Make atomic changes. Do not try to implement Auth, Transactions, and Dashboard in a single commit.
- **Responsive-First UX**: Build layouts and interactions that feel intentional on desktop, tablet, and mobile (avoid “phone-only” layouts on large screens).
- **Strict Typing**: 
  - **Python**: Mandatory use of Type Hints (PEP 484) in all function signatures. Use Pydantic for data validation.
  - **TypeScript**: No `any`. All props and state must have defined interfaces.
- **Test Strategy**: 
  - For Backend: Prioritize Integration Tests (`TestClient`) to validate API contracts.
  - For Frontend: Prioritize functionality over comprehensive unit testing for UI components in this MVP phase.
- **Clear Naming**: 
  - Python: `snake_case` for variables/functions.
  - TypeScript: `camelCase` for variables/functions, `PascalCase` for Components.
- **YAGNI (You Aren't Gonna Need It)**: Do not implement complex patterns (like Hexagonal Architecture or Kafka) yet. Stick to the Modular Monolith structure defined for the MVP.

## 2. Language Standards

- **English Only**: All technical artifacts must be in English to ensure consistency and future scalability. This includes:
    - Code (variable names, functions, classes, comments)
    - Commit Messages (e.g., `feat: add transaction endpoint`, not `feat: adiciona rota`)
    - Documentation (README, API Specs)
    - Database Schemas (Table names, Columns)
    - Error Messages (Internal logs) *Note: User-facing UI text should be in Portuguese (pt-BR).*

## 3. Specific Standards

For detailed rules specific to each stack layer, refer to:

- [Backend Standards](./backend-standards.mdc) - Python, FastAPI, SQLAlchemy, Pydantic, and Testing patterns.
- [Frontend Standards](./frontend-standards.mdc) - Next.js, Tailwind, ShadcnUI, and React patterns.
- [Project Documentation](./README.md) - Setup, architecture overview, and running guides.

## 4. Git & Workflow

- **Commit Style**: Semantic Commits are encouraged.
  - `feat`: New features
  - `fix`: Bug fixes
  - `docs`: Documentation changes
  - `refactor`: Code changes that neither fix a bug nor add a feature
  - `chore`: Build process, dependency updates
- **Branching**: Keep main stable. Develop features in short-lived branches if working in a team.