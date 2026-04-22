# CLAUDE.md

## Project Overview

**JobClawd** is a SaaS-style job application dashboard. It aggregates job listings from multiple sources (jobsearch.az, LinkedIn, Indeed) using Playwright browser automation, scores vacancies against the user's CV using AI, and provides a CV editor with AI-powered optimization suggestions.

Key features:
- **Job feed** — aggregated listings from jobsearch.az, LinkedIn, Indeed with AI match scoring per CV
- **CV editor** — structured section editing, ATS preview, AI suggestion engine (accept/reject suggestions, Check Impact re-scoring)
- **Multi-CV comparison** — score multiple CVs against a vacancy side by side
- **Saved vacancies** — bookmark jobs for later review
- **Applications** — manually track which jobs you've applied to
- **Analytics dashboard** — career insights: activity trend, score distribution, source breakdown, top job titles, CV performance, Check Impact stats
- **Profile** — user profile with CV uploads, personal info, job preferences
- **Auth** — magic link email login + Google OAuth

## Monorepo Structure

```
repo/
  apps/
    api/      → FastAPI backend (Python)
    web/      → Next.js 16 frontend (React 19, TypeScript)
  packages/
    shared/   → Shared TypeScript types (types.ts)
  docker/
  .env        → Root env vars (SMTP, JWT, OAuth, OpenAI, DB)
  docker-compose.yml
```

## Running the Application

**Backend:**
```bash
cd apps/api
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd apps/web
npm run dev   # http://localhost:3000
```

**Docker (all services):**
```bash
docker compose up
```

## Backend Structure & Design Rules

- **Modular architecture:** `routers/` → HTTP handling only, `services/` → business logic, `repositories/` → SQL only, `scrapers/` → external sources, `utils/` → helpers.
- **AI:** OpenAI API used for CV match scoring (`cv_match_service.py`), suggestions (`cv_suggestions_service.py`), bundle analysis (`cv_analysis_bundle_service.py`), metadata extraction. Model set via `OPENAI_METADATA_MODEL` env var.
- **CV pipeline:** Parse → structured `CVData` schema (`models/cv_schema.py`) → edit → generate PDF via ReportLab (`cv_pdf_generator.py`).
- **Database:** PostgreSQL via `DATABASE_URL` env var.
- **Auth:** JWT (`jc_token` cookie), magic link + Google OAuth.
- Routers are thin — no business logic, only HTTP handling and delegation to services.
- Services contain business logic; repositories contain only SQL.
- All AI calls use `temperature=0` (deterministic) for consistent scoring.

## Frontend Structure & Design Rules

- **Framework:** Next.js 16, React 19, TypeScript. App Router (`app/`), dashboard at `/dashboard/*`.
- **Auth & Routing:** `middleware.ts` / `proxy.ts` protects `/dashboard/*`, handles JWT (`jc_token`) cookie and redirects.
- **Component structure:**
  - `components/ui/` — shadcn/ui base components (Button, Input, Dialog, Sheet, etc.)
  - `components/feed/vacancy/` — vacancy panel, CV editor, workspace dialog, suggestions
  - `components/dashboard/`, `components/profile/`, `components/settings/` — feature areas
  - `providers/` — QueryClient, Auth, Profile context providers
- **Hooks:** Encapsulate all feature logic. Key hooks: `use-vacancy-panel.ts`, `use-cv-match.ts`, `use-feed.ts`.
- **Services:** All API calls go through `src/services/` classes (e.g. `cv-match.service.ts`, `document.service.ts`). Never use raw `fetch` or `axios` in components or hooks.
- **Types:** Shared types live in `packages/shared/types.ts`, re-exported via `src/components/feed/types.d.ts`.
- **State:** React Query for server state, `useState`/`useCallback` for local state.
- **Validation:** Zod schemas for feed filters and form data.

## Hard Requirements

- **No raw HTML elements for actions.** Use shadcn/ui components:
  - `<button>` → `<Button>` from `@/components/ui/Button`
  - `<input>` → `<Input>` from `@/components/ui/Input`
  - `<textarea>` → `<Textarea>` from `@/components/ui/Textarea`
  - `<select>` → `<Select>` from `@/components/ui/Select`
  - `<a>` → `<Link>` from `next/link` (or `<Button asChild>` + `<Link>`)
  - Exception: programmatic elements created via JS (e.g. `document.createElement` for file pickers) are fine.
- **No hardcoded API paths.** All URL constants live in `src/lib/endpoints.ts`.
- **No raw fetch/axios in components/hooks.** All backend communication goes through service classes in `src/services/`.
- **React Query** for all data fetching and mutations.
- **Color system:** CSS variables defined in `src/styles/globals.css`. Never hardcode colors — use `text-primary`, `bg-muted`, etc.
- **No inline hardcoded strings for errors.** All error messages in English.
- **Component size:** Break components > ~300 lines into sub-components. Each component has one clear responsibility.
- **Shared types:** Add new shared types to `packages/shared/types.ts`, not local files.
