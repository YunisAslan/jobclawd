# CLAUDE.md

## Project Overview
**JobClawd** is a full SaaS-style job application dashboard. It searches multiple job boards (jobsearch.az, LinkedIn, Indeed) using Playwright browser automation, scores vacancies against the user's profile.

## Running the Application
**Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
**Frontend:**
```bash
cd frontend
npm run dev   # http://localhost:3000
```

## Backend Structure && design rules
- **Modular architecture:** routers → endpoints, services → logic (filter/score/apply), scrapers → external sources, repositories → DB, utils → helpers.  
- **Database:** SQLite (`jobclawd.db`), initialized on startup.  
- **Env/configs:** sensitive info in `.env` (SMTP, JWT, OAuth).  
- **Automation:** singleton browser for scrapers, main commands for build, test, lint, scraping, applying.  
- **Best practices:** keep modules reusable, reference detailed schemas/docs only when needed, use linters/hooks for code style.
- Routers are thin — no business logic, only HTTP handling and delegation to services/repos
- Services contain business logic; repositories contain only SQL

## Frontend Structure && design rules
- **Framework & Architecture:** Next.js 16, modular `app/` structure with layouts, pages, and dashboard.  
- **Routing & Auth:** Middleware(proxy.ts) protects `/dashboard/*`, handles JWT (jc_token) and redirects. Auth pages support magic link & Google OAuth.  
- **Components:**  
  - Shared UI (`ui/`) and reusable dashboard, feed, profile, settings, applications components.  
  - Providers manage state: QueryClient, Auth, Profile.  
  - Hooks encapsulate logic: feed, stats, job detail, autopilot, SMTP, breakpoints.  
- **Services:** API abstraction for auth, jobs, applications, stats; Axios + interceptors.  
- **State & Validation:** Zod schemas for feed filters; TypeScript types mirror backend models.  
- **Utilities & Libs:** Helpers for endpoints, mailto URLs, local storage, className merging.  
- **Best Practices:** Keep components and services modular, progressive disclosure for rare logic, avoid hardcoding details, follow hooks/providers pattern for state.

## Requirements
- All backend communication goes through domain service classes in `src/services/`. **Do not use raw `fetch` or `axios` in components/hooks.**  
- Use **React Query** for data fetching and mutations
- All URL constants live in `src/lib/endpoints.ts` — **never hardcode paths elsewhere**.  
- Use **shadcn/ui components** for all UI elements. Never use raw HTML `<button>`, `<input>`, `<select>`, `<textarea>`, or `<a>` for actions.  
- **Color system & theme:** Defined in `frontend/src/styles/globals.css`. Use the CSS variables provided there (`--background`, `--foreground`, `--primary`, etc.). Do not hardcode colors elsewhere.
- All error messages in English — no Azerbaijani strings anywhere