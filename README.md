# Ze Finance (Zefa Finance)

This repository contains the **technical specs and Cursor workflow framework** for the Ze Finance (Zefa Finance) project.

## Documentation index

- **Technical documentation (single entry point)**: `TECHNICAL_DOCUMENTATION.md`
- **Development guide**: `ai-specs/specs/development_guide.md`
- **API contract (OpenAPI)**: `ai-specs/specs/api-spec.yml`
- **Data model**: `ai-specs/specs/data-model.md`

## Cursor workflow (commands in chat)

Use the `/` commands in Cursor chat:

- **Plan first**
  - `/plan-backend-ticket` — create a backend implementation plan (no code yet)
  - `/plan-frontend-ticket` — create a frontend implementation plan (no code yet)
- **Implement after the plan**
  - `/develop-backend`
  - `/develop-frontend`
- **Documentation updates**
  - `/update-docs`

Project rules used by the framework live in `.cursor/rules/`.

## Standards (summary)

- **Walking Skeleton first**: end-to-end flow before over-engineering.
- **Strict typing**: Python type hints + no `any` in TypeScript.
- **Language rule**: technical artifacts in **English**; user-facing UI text in **Portuguese (pt-BR)**.

## Repository status

This repo currently contains **specs and automation framework**. If/when application code is added, it is expected to be organized into `backend/` and `frontend/` as described in the docs.
