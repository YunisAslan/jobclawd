# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**JobClawd** is a full SaaS-style job application dashboard. It searches multiple job boards (jobsearch.az, LinkedIn, Indeed) using Playwright browser automation, scores vacancies against the user's profile, extracts HR emails, and either opens `mailto:` or sends via SMTP autopilot.

**All UI text and error messages must be in English.**

## Architecture

```
frontend (Next.js 16, port 3000) ←→ backend (FastAPI, port 8000)
                                          ↕
                         Playwright → jobsearch.az / LinkedIn / Indeed
                                          ↕
                                    SQLite (jobclawd.db)
```

**Full request flow:**
1. User signs in via magic link or Google OAuth → JWT stored in `jc_token` cookie (30 days)
2. User fills profile at `/dashboard/profile` → held in-memory via `ProfileContext` (seeded from auth, not persisted)
3. `/dashboard/feed` calls `POST /api/search` with query + filters → backend fans out scrapers, AI-filters, scores, returns sorted jobs
4. `applyLocalFilters()` in `feed/page.tsx` refines results client-side on every filter change (no re-fetch for non-location/query filters)
5. User clicks "Apply" / "Details" → `Sheet` drawer opens → `POST /api/job-details`
6. Backend navigates to job page, extracts HR email
7. User selects CV link, clicks "Apply" → `POST /api/apply`
8. If autopilot ON + SMTP configured + high match: email sent via `aiosmtplib`; otherwise `mailto:` URL opens
9. Application row inserted into SQLite `applications` table

**Auth flow (magic link):**
1. User enters email on `/auth/login` → `POST /api/auth/send-magic-link`
2. Backend generates one-time token (15 min TTL), saves to `auth_tokens` table, sends email via Gmail SMTP
3. User clicks link → `/auth/verify?token=...`
4. Frontend POSTs token to `POST /api/auth/verify-magic-link` via `authService.verifyMagicLink(token)`
5. Backend validates token, marks as used, issues signed JWT (30 day TTL)
6. Frontend stores JWT in `jc_token` cookie, redirects to `/dashboard/feed`
7. `middleware.ts` protects `/dashboard/:path*` by checking `jc_token` cookie

**Auth flow (Google OAuth):**
1. User clicks "Continue with Google" → `window.location.href = ${API_BASE_URL}/api/auth/google`
2. Backend redirects to Google consent screen
3. Google redirects back to `GET /api/auth/callback/google`
4. Backend exchanges code for tokens, gets user email/name, issues JWT
5. Backend redirects browser to `/auth/google-callback?token=...`
6. Frontend page reads `?token=`, calls `login(token)`, redirects to `/dashboard/feed`

**Browser lifecycle:** Single global Chromium instance in `backend/scraper/__init__.py`, reused across requests. Each request gets an isolated context+page. Shuts down via FastAPI lifespan.

**Semantic filter engine (`backend/services/ai_filter.py`):**
- Replaces LLM filtering with fast deterministic heuristics — zero API cost, instant, predictable
- Step 1: Domain isolation — prevents cross-domain pollution (e.g. "frontend" search never returns pure "QA" jobs)
- Step 2: Experience matching — rejects mismatched seniority signals in job titles
- Step 3: Location whitelisting — uses pycountry (ISO 3166-1) + DB (countriesnow.space) to match 249 countries; drops jobs with empty `location_str` when location filter is active
- Step 4: Date posted — supports ISO timestamps and relative strings ("3 days ago")
- Step 5: Salary — best-effort: checks `title + location_str + description_snippet` for explicit rate patterns (`$40/hr`, `$80k`, `€120,000`); jobs without salary mention are kept (no false negatives)

**Scoring engine (`backend/engine/scoring.py`):**
- Work mode match: 35 pts (hard mismatch → trash)
- Experience level: 25 pts
- Location: 20 pts
- Title: 20 pts
- Blacklist / current employer → immediate trash (score 0)
- `>= 75` → `high`, `>= 45` → `review`, `< 45` → `trash` (filtered out)

**Email extraction priority (detail.py):**
1. Click apply button inside `#apply-button` → find `mailto:` link
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
| GET | `/api/auth/google` | Redirect to Google OAuth consent screen |
| GET | `/api/auth/callback/google` | Google OAuth callback → issues JWT, redirects to `/auth/google-callback` |
| POST | `/api/auth/send-magic-link` | `{ email }` → sends Gmail magic link |
| POST | `/api/auth/verify-magic-link` | `{ token }` → validates token, returns `{ access_token, user }` |
| POST | `/api/search` | `{ query, sources[], location?, workModes?, experience?, jobTypes?, datePosted?, salaryMin?, sortBy? }` → scored + sorted `jobs[]` |
| POST | `/api/job-details` | `{ url }` → `{ title, company, description, email?, ... }` |
| POST | `/api/apply` | Insert application row; optionally SMTP send |
| GET | `/api/stats` | Dashboard stats: today, total, replies, weekly chart, CV perf |
| GET | `/api/meta/filters` | All filter options + countries/cities from DB |
| GET | `/api/settings/smtp` | Get SMTP config (password omitted) |
| POST | `/api/settings/smtp` | Save SMTP config |
| GET | `/api/settings/autopilot` | Get autopilot enabled state |
| POST | `/api/settings/autopilot` | Set autopilot enabled state |
| GET | `/health` | Liveness check |

## Backend Structure

```
backend/
├── main.py                       # FastAPI app, CORS (localhost:3000), lifespan → init_db + shutdown_browser
├── requirements.txt              # fastapi, uvicorn, playwright, pydantic, httpx, aiosmtplib, python-dotenv, PyJWT, pycountry
├── .env                          # GMAIL_USER, GMAIL_APP_PASSWORD, JWT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI (not committed)
├── jobclawd.db                   # SQLite DB (auto-created on first run)
├── models/schemas.py             # All Pydantic models + enums (WorkMode, ExperienceLevel, MatchLevel, …)
│                                 # JobListing: title, company, url, date_posted, source, logo_url,
│                                 #   match_score, match_level, match_flags, location_str,
│                                 #   work_mode_str, experience_str, description_snippet
├── db/
│   ├── schema.sql                # applications + settings + auth_tokens + countries + cities + filter_options tables
│   ├── database.py               # init_db(), get_db() context manager, DB_PATH = jobclawd.db
│   └── seed.py                   # Seeds countries, cities, filter_options on first run
├── engine/
│   └── scoring.py                # score_job(job, profile) → JobListing with match_score/level/flags
├── routers/
│   ├── auth_router.py            # Magic link + Google OAuth endpoints; issues JWT
│   ├── jobs.py                   # POST /search, POST /job-details
│   ├── applications.py           # POST /apply
│   ├── stats.py                  # GET /stats
│   ├── meta.py                   # GET /meta/filters — sources, work modes, experience, job types, date ranges, sort, countries/cities
│   └── settings_router.py        # GET/POST /settings/smtp, GET/POST /settings/autopilot
├── scraper/
│   ├── __init__.py               # get_browser() / shutdown_browser() singleton
│   ├── search.py                 # scrape_search(query) — intercepts jobsearch.az /api-az/vacancies-az JSON
│   ├── detail.py                 # scrape_job_detail(url) — multi-strategy email extraction
│   ├── linkedin.py               # scrape_linkedin(query, location, filters) — non-fatal; extracts description_snippet
│   └── indeed.py                 # scrape_indeed(query, location, filters) — non-fatal; extracts description_snippet
├── services/
│   ├── ai_filter.py              # ai_filter_jobs() — 5-step deterministic semantic filter
│   ├── search_service.py         # run_search() — fans out scrapers per location shard, merges, deduplicates, filters, scores
│   ├── apply_service.py          # process_apply() — persists to DB, optionally sends SMTP
│   └── smtp_sender.py            # send_application_email() via aiosmtplib STARTTLS
├── repositories/
│   ├── application_repo.py       # insert_application(), get_all_applications(), update_application(), get_stats()
│   └── settings_repo.py          # get/save smtp_config, get/save autopilot_enabled
└── utils/
    └── email_extractor.py        # extract_emails(text): regex + dedup + domain filter
```

**Python version:** 3.9 — use `Optional[X]` not `X | None` in function signatures.

**Key backend design rules:**
- Routers are thin — no business logic, only HTTP handling and delegation to services/repos
- Services contain business logic; repositories contain only SQL
- `pycountry` (ISO 3166-1) + DB (countriesnow.space) together cover 249 countries — never add manual country aliases
- All error messages in English — no Azerbaijani strings anywhere

## Frontend Structure

```
frontend/src/
├── middleware.ts             # Protects /dashboard/:path* — checks jc_token cookie, redirects to /auth/login
├── app/
│   ├── layout.tsx            # Root layout: QueryProvider + AuthProvider + ProfileProvider + Sidebar + <main>
│   ├── page.tsx              # Landing page; redirects logged-in users to /dashboard/feed
│   ├── auth/
│   │   ├── login/page.tsx        # Magic link email form + Google OAuth button
│   │   ├── verify/page.tsx       # Reads ?token=, calls authService.verifyMagicLink(), stores JWT via login()
│   │   └── google-callback/      # Reads ?token= from Google OAuth redirect, calls login(), redirects to feed
│   └── dashboard/
│       ├── page.tsx              # Redirects to /dashboard/feed
│       ├── feed/page.tsx         # Job search: FeedFilterForm + FeedResults + applyLocalFilters()
│       ├── analytics/page.tsx    # Stats cards + weekly chart + CV performance table
│       ├── profile/page.tsx      # Extended profile form
│       ├── applications/page.tsx # Placeholder
│       └── settings/page.tsx     # Placeholder
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx           # Dark sidebar with DropdownMenu on profile section
│   │   └── TopBar.tsx            # Page title + optional action + autopilot badge
│   ├── providers/
│   │   └── QueryProvider.tsx     # TanStack QueryClient provider (client component)
│   ├── SelectBox.tsx             # Unified single/multi-select wrapper around Select primitive
│   ├── ui/                       # shadcn/ui primitives — existing files PascalCase; new installs lowercase
│   │   ├── MatchBadge.tsx        # Green/amber Badge for match score
│   │   ├── SourceBadge.tsx       # Colored Badge per job source (jobsearch/linkedin/indeed)
│   │   └── SkeletonCard.tsx      # Pulse skeleton using shadcn Skeleton
│   ├── dashboard/                # StatsCard, WeeklyChart (CSS-only bars), CVPerformanceTable
│   ├── feed/
│   │   ├── FeedFilterForm.tsx    # Full filter form: query, sources, work mode, LocationPicker, experience,
│   │   │                         #   job type, salary (yr/mo/hr period selector + currency), date posted, sort by
│   │   ├── FeedResults.tsx       # Results grid with LoadingStages animation, empty states with filter tips,
│   │   │                         #   results meta bar showing position count + active filter count
│   │   ├── FeedJobCard.tsx       # Job card with match badge, source badge, company logo
│   │   ├── FeedResultSectionHeader.tsx  # Section header for High Match / Needs Review
│   │   ├── LocationPicker.tsx    # Popover trigger for location selection
│   │   ├── LocationModal.tsx     # Two-step picker: country list → city drill-down; emits LocationValue
│   │   ├── JobDetailDrawer.tsx   # Sheet drawer for job details + email + apply actions
│   │   └── EmptyState.tsx        # Reusable empty state component
│   ├── applications/             # ApplicationsTable (Tabs + Table), StatusBadge (DropdownMenu)
│   ├── profile/                  # ExtendedProfileForm (email locked), CVLinkManager, BlacklistManager
│   └── settings/                 # AutopilotToggle (Dialog + Switch), SMTPForm
├── contexts/
│   ├── AuthContext.tsx           # useAuth() → { user, isLoading, login(token), logout() }; reads/writes jc_token cookie
│   └── ProfileContext.tsx        # useProfile() hook; in-memory only; email always locked to auth email
├── hooks/
│   ├── use-feed.ts               # useMutation for search; manages job list, skipped, selected state
│   ├── use-meta.ts               # useMetaFilters() — useQuery for GET /api/meta/filters; staleTime Infinity
│   ├── use-job-detail.ts         # useQuery for job detail (lazy); useMutation for apply
│   ├── use-stats.ts              # useQuery wrapping statsService.getStats(); staleTime 30s
│   ├── use-autopilot.ts          # useQuery + useMutation for autopilot toggle
│   ├── use-smtp-form.ts          # useQuery + useMutation for SMTP settings form
│   └── use-mobile.ts             # Breakpoint hook
├── services/
│   ├── api.service.ts            # Abstract APIService base class with axios instance + interceptors
│   ├── auth.service.ts           # sendMagicLink(), verifyMagicLink(); exports authService
│   ├── jobs.service.ts           # search(), getDetail(); exports jobsService
│   ├── apply.service.ts          # apply(); exports applyService
│   └── stats.service.ts          # getStats(); exports statsService
├── validations/
│   └── feed.ts                   # feedFilterSchema (zod) + FeedFilterValues type
│                                 # Fields: query, sources, workModes, location (LocationValue),
│                                 #   experience, jobTypes, salaryMin (digits+commas),
│                                 #   salaryPeriod (annual/monthly/hourly), datePosted, sortBy
├── lib/
│   ├── endpoints.ts              # API_BASE_URL + ENDPOINTS map — all URL strings live here
│   ├── mailto.ts                 # buildMailtoUrl(profile, jobDetail, cvUrl?) → cover letter
│   ├── localStorage.ts           # EMPTY stub — localStorage removed
│   └── utils.ts                  # cn() from shadcn (clsx + tailwind-merge)
└── types/index.ts                # All TypeScript interfaces mirroring backend schemas
                                  # JobListing includes description_snippet?: string | null
```

## Feed Page — Client-Side Filter Architecture

`feed/page.tsx` has two layers:

1. **Backend search** (`handleSearch` → `POST /api/search`): triggered only on form submit. Sends query, location, sources + all filter params. Backend scrapes, AI-filters, scores.

2. **`applyLocalFilters(jobs, filters)`**: runs client-side on every filter change — no re-fetch. Checks `title + location_str + description_snippet` for: sources, workModes (text detection), experience (seniority keywords), jobTypes (contract/part-time regex), salary (explicit rate patterns), datePosted, sortBy. Location and query changes require a new backend search.

`activeFilterCount` counts all 8 filter types (sources, workModes, location, experience, jobTypes, salaryMin, datePosted, sortBy) — everything except the free-text query.

**Salary filter limitation:** only fires when a rate is explicitly in the visible text (title/location/snippet). Jobs whose salary is buried in the full description page are not filtered at listing stage — that would require fetching each job's detail page.

## Auth — Important Details

- **No NextAuth** — fully custom JWT auth
- JWT payload: `{ sub: email, name, iat, exp }`
- Cookie: `jc_token`, max-age 30 days, SameSite=Lax
- `AuthContext` decodes JWT client-side (base64url) — does NOT verify signature
- `login` and `logout` wrapped in `useCallback(fn, [])` — stable references, no infinite loops
- `ProfileContext` always overwrites `profile.email` with `user.email` from auth — users cannot change their login email
- `UserProfile.phone` has been removed from the type and form
- Profile data is **not persisted** — resets on page refresh

## Service Layer — Important Details

All backend communication goes through domain service classes in `src/services/`. **Never use raw `fetch` or `axios` directly in components or hooks.**

- `APIService` (abstract base): creates axios instance, provides `get/post/patch/delete` methods
- Domain services extend `APIService` and export a singleton: `export const jobsService = new JobsService()`
- All URL constants live in `src/lib/endpoints.ts` — never hardcode paths elsewhere
- Error shape from FastAPI: `{ detail: string }` — access via `err?.response?.data?.detail`
- Use **`useQuery`** for auto-fetched data (stats, meta, job detail); use **`useMutation`** for user-triggered actions (search, apply, magic link send)

## Tech Stack

**Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, **shadcn/ui** (Radix UI primitives), lucide-react, **axios**, **@tanstack/react-query**, **react-hook-form**, **zod** (`@hookform/resolvers/zod`)

**shadcn components in use:** `Button`, `Input`, `Card`, `Badge`, `Switch`, `Table`, `Dialog`, `Tabs`, `Label`, `Checkbox`, `RadioGroup`, `Sheet`, `Separator`, `Skeleton`, `DropdownMenu`, `ScrollArea`, `Select`, `Popover`

**Styling rules:**
- Use shadcn components everywhere — NEVER write raw `<button>`, `<input>`, `<select>`, `<textarea>`, `<a>` (for actions) elements. Always use: `<Button>`, `<Input>`, `<Select>`, `<Textarea>`, etc.
- Color system is **Dark Mode — default baseline** (defined in `frontend/src/styles/globals.css`). There is NO light mode. All `:root` variables are dark:
  - `--background: #11151C` (deep slate-blue canvas)
  - `--foreground: #E8EBF3` (soft cool white)
  - `--card: #1A1F2B` (elevation layer above canvas)
  - `--muted-foreground: #9AA3B2` (metadata, timestamps, labels)
  - `--primary: #5563FF` (brighter indigo — CTAs, active nav, focus rings only)
  - `--primary-foreground: #FFFFFF`
  - `--secondary: #8E98FF` (lighter indigo — avatars, secondary UI)
  - `--border: #222A3A`, `--muted: #161C27`, `--accent: #1E2535`
  - `--success: #10B981` (emerald), `--warning: #F59E0B` (amber), `--destructive: #FF4F4F` (red)
  - `--match-high: #10B981`, `--match-review: #F59E0B`
  - **Match tokens:** always use `text-match-high` / `bg-match-high` and `text-match-review` / `bg-match-review` — never `text-primary` for match states
  - **Auth page rule:** login uses `bg-sidebar` + `border-sidebar-border` for left panel, `bg-card` for right form panel
- Sidebar CSS variables:
  - `--sidebar: #0C1018`, `--sidebar-foreground: #9AA3B2`
  - `--sidebar-primary: #5563FF`, `--sidebar-accent: #141A25`, `--sidebar-border: #181E2C`
- `.sidebar-nav-item` / `.sidebar-nav-item.active` are the only remaining custom CSS classes

**ui/ folder naming convention:**
- Existing files are PascalCase (e.g., `Button.tsx`, `Card.tsx`) — keep imports consistent with actual filename on disk
- Newly installed shadcn components (via `npx shadcn@latest add`) arrive as lowercase — import as installed, never rename

**STRICT: No raw HTML interactive elements — ever:**
- `<button>` → `<Button>`, `<input>` → `<Input>`, `<select>` → `<Select>`, `<textarea>` → `<Textarea>`
- `<a>` for navigation → `<Link>`; for actions → `<Button variant="link">`
- Violations must be fixed immediately when spotted

**Backend:** Python 3.9, FastAPI, Pydantic v2, Playwright (Chromium), SQLite, aiosmtplib, PyJWT, pycountry

## Environment Variables

| Variable | Location | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` | Backend base URL (default: `http://localhost:8000`) |
| `GMAIL_USER` | `backend/.env` | Gmail address used to send magic link emails |
| `GMAIL_APP_PASSWORD` | `backend/.env` | Gmail App Password (16 chars, spaces stripped automatically) |
| `JWT_SECRET` | `backend/.env` | Secret for signing JWTs (HS256, 30-day TTL) |
| `GOOGLE_CLIENT_ID` | `backend/.env` | Google OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | `backend/.env` | Google OAuth 2.0 client secret |
| `GOOGLE_REDIRECT_URI` | `backend/.env` | Must be `http://localhost:8000/api/auth/callback/google` |

SQLite DB is created automatically at `backend/jobclawd.db` on first run. The file `db.sqlite3` is a stale artifact — it should not exist.
