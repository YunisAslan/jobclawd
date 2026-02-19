# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**JobClawd** is a full SaaS-style job application dashboard. It searches multiple job boards (jobsearch.az, LinkedIn, Indeed) using Playwright browser automation, scores vacancies against the user's profile, extracts HR emails, and either opens `mailto:` or sends via SMTP autopilot.

**All UI text, error messages, and email templates must be in Azerbaijani.**

## Architecture

```
frontend (Next.js 16, port 3000) ←→ backend (FastAPI, port 8000)
                                          ↕
                         Playwright → jobsearch.az / LinkedIn / Indeed
                                          ↕
                                    SQLite (jobclawd.db)
```

**Full request flow:**
1. User fills profile at `/profile` → saved to `localStorage` via `ProfileContext`
2. `/feed` page calls `POST /api/search` with profile + sources → backend fans out scrapers, scores results, returns sorted jobs
3. User clicks "Müraciət Et" / "Detallar" → `Sheet` drawer opens → `POST /api/job-details`
4. Backend navigates to job page, extracts HR email
5. User selects CV link, clicks "Müraciət Et" → `POST /api/apply`
6. If autopilot ON + SMTP configured + high match: email sent via `aiosmtplib`; otherwise `mailto:` URL opens
7. Application row inserted into SQLite `applications` table

**Browser lifecycle:** Single global Chromium instance in `backend/scraper/__init__.py`, reused across requests. Each request gets an isolated context+page. Shuts down via FastAPI lifespan.

**Scoring engine (`backend/engine/scoring.py`):**
- Work mode match: 35 pts (hard mismatch → trash)
- Experience level: 25 pts
- Location: 20 pts
- Title: 20 pts
- Blacklist / current employer → immediate trash (score 0)
- `>= 75` → `high`, `>= 45` → `review`, `< 45` → `trash` (filtered out)

**Email extraction priority (detail.py):**
1. Click `#apply-button a.apply` → find `mailto:` link
2. Find `.apply__send-mail` text
3. All `mailto:` links on page
4. Regex extraction from body text
5. Filter out `jobsearch.az`, `example.com`, `test.com` domains

## Running the Application

Both servers must run simultaneously.

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

**Install dependencies (first time):**
```bash
# Backend
cd backend && pip3 install -r requirements.txt
playwright install chromium

# Frontend
cd frontend && npm install
```

**Health check:** `curl http://localhost:8000/health`

## Key API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/search` | `{ query, profile?, sources[] }` → scored + sorted `jobs[]` |
| POST | `/api/job-details` | `{ url }` → `{ title, company, description, email?, ... }` |
| POST | `/api/apply` | Insert application row; optionally SMTP send |
| GET | `/api/applications` | All application records ordered by date |
| PATCH | `/api/applications/{id}` | Update status + notes |
| GET | `/api/stats` | Dashboard stats: today, total, replies, weekly chart, CV perf |
| GET/POST | `/api/settings/smtp` | Read/write SMTP config (password omitted from GET) |
| GET/POST | `/api/settings/autopilot` | Read/write `autopilot_enabled` |
| GET | `/health` | Liveness check |

Error responses use Azerbaijani messages: 400 (invalid URL), 502 (scraping failure), 504 (timeout).

## Backend Structure

```
backend/
├── main.py                   # FastAPI app, CORS (localhost:3000), lifespan → init_db + shutdown_browser
├── requirements.txt          # fastapi, uvicorn, playwright, pydantic, httpx, aiosmtplib
├── models/schemas.py         # All Pydantic models + enums (WorkMode, ExperienceLevel, MatchLevel, …)
├── db/
│   ├── schema.sql            # applications + settings tables
│   └── database.py           # init_db(), get_db() context manager, DB_PATH = jobclawd.db
├── engine/
│   └── scoring.py            # score_job(job, profile) → JobListing with match_score/level/flags
├── routers/
│   ├── jobs.py               # POST /search (multi-source + scoring), POST /job-details
│   ├── applications.py       # POST /apply, GET/PATCH /applications
│   ├── stats.py              # GET /stats
│   └── settings_router.py    # GET/POST /settings/smtp + /settings/autopilot
├── scraper/
│   ├── __init__.py           # get_browser() / shutdown_browser() singleton
│   ├── search.py             # scrape_search(query) — intercepts jobsearch.az /api-az/vacancies-az
│   ├── detail.py             # scrape_job_detail(url) — multi-strategy email extraction
│   ├── linkedin.py           # scrape_linkedin(query) — non-fatal, returns [] on error
│   └── indeed.py             # scrape_indeed(query) — non-fatal, returns [] on error
├── services/
│   └── smtp_sender.py        # send_application_email() via aiosmtplib STARTTLS
└── utils/
    └── email_extractor.py    # extract_emails(text): regex + dedup + domain filter
```

**Python version:** 3.9 — use `Optional[X]` not `X | None` in function signatures.

## Frontend Structure

```
frontend/src/
├── app/
│   ├── layout.tsx            # Root layout: ProfileProvider + Sidebar + <main>
│   ├── page.tsx              # Redirects → /dashboard
│   ├── dashboard/page.tsx    # Stats cards + weekly chart + CV performance table
│   ├── feed/page.tsx         # Job search: query + source checkboxes, scored grid, Sheet drawer, bulk apply
│   ├── applications/page.tsx # Application history table with status management
│   ├── profile/page.tsx      # Extended profile form
│   └── settings/page.tsx     # Autopilot toggle + SMTP form
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx       # Dark sidebar (custom, NOT shadcn Sidebar), usePathname active state
│   │   └── TopBar.tsx        # Page title + optional action + autopilot badge
│   ├── ui/                   # shadcn/ui primitives — existing files are PascalCase; NEW installs via shadcn CLI arrive as lowercase
│   │   ├── MatchBadge.tsx    # Green/amber Badge for match score
│   │   ├── SourceBadge.tsx   # Colored Badge per job source
│   │   └── SkeletonCard.tsx  # Pulse skeleton using shadcn Skeleton
│   ├── dashboard/            # StatsCard, WeeklyChart (CSS-only bars), CVPerformanceTable
│   ├── feed/                 # FeedJobCard, JobDetailDrawer (Sheet), BulkActionBar
│   ├── applications/         # ApplicationsTable (Tabs + Table), StatusBadge (DropdownMenu)
│   ├── profile/              # ExtendedProfileForm, CVLinkManager, BlacklistManager
│   └── settings/             # AutopilotToggle (Dialog + Switch), SMTPForm
├── contexts/
│   └── ProfileContext.tsx    # useProfile() hook; loads/saves localStorage on mount/change
├── lib/
│   ├── api.ts                # Typed fetch wrappers for all endpoints
│   ├── mailto.ts             # buildMailtoUrl(profile, jobDetail, cvUrl?) → Azerbaijani cover letter
│   ├── localStorage.ts       # loadProfile() with backward-compat defaults, saveProfile()
│   └── utils.ts              # cn() from shadcn (clsx + tailwind-merge)
└── types/index.ts            # All TypeScript interfaces mirroring backend schemas
```

## Tech Stack

**Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, **shadcn/ui** (Radix UI primitives), lucide-react

**shadcn components in use:** `Button`, `Input`, `Card`, `Badge`, `Switch`, `Table`, `Dialog`, `Tabs`, `Label`, `Checkbox`, `RadioGroup`, `Sheet`, `Separator`, `Skeleton`, `DropdownMenu`, `ScrollArea`, `Select`

**Styling rules:**
- Use shadcn components everywhere — NEVER write raw `<button>`, `<input>`, `<select>`, `<textarea>`, `<a>` (for actions) elements. Always import and use the shadcn equivalents: `<Button>`, `<Input>`, `<Select>`, `<Textarea>`, etc.
- Color system is **Emerald-based** (updated in `globals.css`):
  - `--primary: #10B981` (emerald-500)
  - `--secondary: #2563EB` (blue-600)
  - `--background: #F8FAFC` (slate-50)
  - `--foreground: #0F172A` (slate-900)
  - `--success: #10B981`, `--warning: #F59E0B`, `--destructive: #EF4444`
  - `--match-high: #10B981`, `--match-review: #F59E0B`
- Sidebar CSS variables (use these, NOT old `--sidebar-bg`/`--sidebar-fg` names):
  - `--sidebar: #0F172A`, `--sidebar-foreground: #CBD5E1`
  - `--sidebar-primary: #10B981`, `--sidebar-accent: #1E293B`
  - `--sidebar-border: #1E293B`, `--sidebar-ring: #10B981`
- `.sidebar-nav-item` / `.sidebar-nav-item.active` are the only remaining custom CSS classes

**ui/ folder naming convention:**
- Existing shadcn primitives in `components/ui/` are currently PascalCase (e.g., `Button.tsx`, `Card.tsx`) — keep imports consistent with the actual filename on disk.
- **Newly installed shadcn components** (via `npx shadcn@latest add`) are installed as **lowercase** (e.g., `button.tsx`, `card.tsx`). When referencing a newly added component, use the lowercase filename as installed.
- Never rename installed files — import them exactly as they exist on disk to avoid case-sensitive import errors.

**STRICT: No raw HTML interactive elements — ever:**
- `<button>` → use `<Button>` from `@/components/ui/Button` (or lowercase path if newly installed)
- `<input>` → use `<Input>`
- `<select>` → use `<Select>` + `<SelectTrigger>` + `<SelectContent>` + `<SelectItem>`
- `<textarea>` → use `<Textarea>`
- `<a>` for navigation → use Next.js `<Link>`; for actions → use `<Button variant="link">`
- Violations of this rule must be fixed immediately when spotted

**Backend:** Python 3.9, FastAPI, Pydantic v2, Playwright (Chromium), SQLite, aiosmtplib

## Environment Variables

| Variable | Location | Default | Purpose |
|----------|----------|---------|---------|
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` | `http://localhost:8000` | Backend base URL |

No backend `.env` file needed for development. SQLite DB is created automatically at `backend/jobclawd.db` on first run.
