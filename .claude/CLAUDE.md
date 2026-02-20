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
3. `/dashboard/feed` calls `POST /api/search` with profile + sources → backend fans out scrapers, scores results, returns sorted jobs
4. User clicks "Apply" / "Details" → `Sheet` drawer opens → `POST /api/job-details`
5. Backend navigates to job page, extracts HR email
6. User selects CV link, clicks "Apply" → `POST /api/apply`
7. If autopilot ON + SMTP configured + high match: email sent via `aiosmtplib`; otherwise `mailto:` URL opens
8. Application row inserted into SQLite `applications` table

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
| GET | `/api/auth/google` | Redirect to Google OAuth consent screen |
| GET | `/api/auth/callback/google` | Google OAuth callback → issues JWT, redirects to `/auth/google-callback` |
| POST | `/api/auth/send-magic-link` | `{ email }` → sends Gmail magic link |
| POST | `/api/auth/verify-magic-link` | `{ token }` → validates token, returns `{ access_token, user }` |
| POST | `/api/search` | `{ query, profile?, sources[] }` → scored + sorted `jobs[]` |
| POST | `/api/job-details` | `{ url }` → `{ title, company, description, email?, ... }` |
| POST | `/api/apply` | Insert application row; optionally SMTP send |
| GET | `/api/stats` | Dashboard stats: today, total, replies, weekly chart, CV perf |
| GET | `/health` | Liveness check |

## Backend Structure

```
backend/
├── main.py                   # FastAPI app, CORS (localhost:3000), lifespan → init_db + shutdown_browser
├── requirements.txt          # fastapi, uvicorn, playwright, pydantic, httpx, aiosmtplib, python-dotenv, PyJWT
├── .env                      # GMAIL_USER, GMAIL_APP_PASSWORD, JWT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI (not committed)
├── models/schemas.py         # All Pydantic models + enums (WorkMode, ExperienceLevel, MatchLevel, …)
├── db/
│   ├── schema.sql            # applications + settings + auth_tokens tables
│   └── database.py           # init_db(), get_db() context manager, DB_PATH = jobclawd.db
├── engine/
│   └── scoring.py            # score_job(job, profile) → JobListing with match_score/level/flags
├── routers/
│   ├── auth_router.py        # Magic link + Google OAuth endpoints; issues JWT
│   ├── jobs.py               # POST /search (multi-source + scoring), POST /job-details
│   ├── applications.py       # POST /apply only
│   └── stats.py              # GET /stats
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
├── middleware.ts             # Protects /dashboard/:path* — checks jc_token cookie, redirects to /auth/login
├── proxy.ts                  # UNUSED — empty stub, ignore
├── app/
│   ├── layout.tsx            # Root layout: QueryProvider + AuthProvider + ProfileProvider + Sidebar + <main>
│   ├── page.tsx              # Landing page; uses useAuth() to redirect logged-in users to /dashboard/feed
│   ├── auth/
│   │   ├── login/page.tsx        # Magic link email form + Google OAuth button; uses authService + useMutation
│   │   ├── verify/page.tsx       # Reads ?token=, calls authService.verifyMagicLink(), stores JWT via login()
│   │   └── google-callback/      # Reads ?token= from Google OAuth redirect, calls login(), redirects to feed
│   └── dashboard/
│       ├── page.tsx              # Redirects to /dashboard/feed
│       ├── feed/page.tsx         # Job search: query + source checkboxes, scored grid, Sheet drawer, bulk apply
│       ├── analytics/page.tsx    # Stats cards + weekly chart + CV performance table
│       ├── profile/page.tsx      # Extended profile form
│       ├── applications/page.tsx # Placeholder (empty)
│       └── settings/page.tsx     # Placeholder (empty)
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx       # Dark sidebar with DropdownMenu on profile section (logout, profile, settings)
│   │   └── TopBar.tsx        # Page title + optional action + autopilot badge
│   ├── providers/
│   │   └── QueryProvider.tsx # TanStack QueryClient provider (client component)
│   ├── ui/                   # shadcn/ui primitives — existing files are PascalCase; NEW installs via shadcn CLI arrive as lowercase
│   │   ├── MatchBadge.tsx    # Green/amber Badge for match score
│   │   ├── SourceBadge.tsx   # Colored Badge per job source
│   │   └── SkeletonCard.tsx  # Pulse skeleton using shadcn Skeleton
│   ├── dashboard/            # StatsCard, WeeklyChart (CSS-only bars), CVPerformanceTable
│   ├── feed/                 # FeedJobCard, JobDetailDrawer (Sheet), BulkActionBar
│   ├── applications/         # ApplicationsTable (Tabs + Table), StatusBadge (DropdownMenu)
│   ├── profile/              # ExtendedProfileForm (email locked), CVLinkManager, BlacklistManager
│   └── settings/             # AutopilotToggle (Dialog + Switch), SMTPForm
├── contexts/
│   ├── AuthContext.tsx       # useAuth() → { user, isLoading, login(token), logout() }; login/logout are useCallback; reads/writes jc_token cookie
│   └── ProfileContext.tsx    # useProfile() hook; in-memory only, seeded from auth user on mount; email always locked to auth email
├── hooks/
│   ├── use-stats.ts          # useQuery wrapping statsService.getStats(); staleTime 30s
│   ├── use-feed.ts           # useMutation for search + apply; manages job list, skipped, selected state
│   └── use-job-detail.ts     # useQuery for job detail (lazy, enabled by job URL); useMutation for apply
├── services/                 # Domain service singletons (axios-based)
│   ├── api.service.ts        # Abstract APIService base class with axios instance + interceptors
│   ├── auth.service.ts       # sendMagicLink(), verifyMagicLink(); exports authService
│   ├── jobs.service.ts       # search(), getDetail(); exports jobsService
│   ├── apply.service.ts      # apply(); exports applyService
│   └── stats.service.ts      # getStats(); exports statsService
├── lib/
│   ├── endpoints.ts          # API_BASE_URL + ENDPOINTS constant map (all URL strings live here)
│   ├── mailto.ts             # buildMailtoUrl(profile, jobDetail, cvUrl?) → cover letter
│   ├── localStorage.ts       # EMPTY — localStorage removed, kept as stub
│   └── utils.ts              # cn() from shadcn (clsx + tailwind-merge)
└── types/index.ts            # All TypeScript interfaces mirroring backend schemas (UserProfile has no phone field)
```

## Auth — Important Details

- **No NextAuth** — fully custom JWT auth (next-auth has been removed)
- JWT payload: `{ sub: email, name, iat, exp }`
- Cookie: `jc_token`, max-age 30 days, SameSite=Lax
- `AuthContext` decodes JWT client-side (base64url) to read user — does NOT verify signature
- `login` and `logout` in `AuthContext` are wrapped in `useCallback(fn, [])` — stable references, no infinite loops
- `ProfileContext` always overwrites `profile.email` with `user.email` from auth — users cannot change their login email
- `UserProfile.phone` has been removed from the type and form
- Profile data is **not persisted** — resets on page refresh (future: save to backend DB)

## Service Layer — Important Details

All backend communication goes through domain service classes in `src/services/`. **Never use raw `fetch` or `axios` directly in components or hooks.**

- `APIService` (abstract base in `src/services/api.service.ts`): creates axios instance, provides `get/post/patch/delete` methods
- Domain services extend `APIService` and export a singleton: `export const jobsService = new JobsService()`
- All URL constants live in `src/lib/endpoints.ts` — never hardcode paths elsewhere
- Error shape from FastAPI: `{ detail: string }` — access via `err?.response?.data?.detail`
- Use **`useQuery`** for auto-fetched data (stats, job detail); use **`useMutation`** for user-triggered actions (search, apply, magic link send)
- `QueryProvider` wraps the full layout — all pages have access to TanStack Query

## Tech Stack

**Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, **shadcn/ui** (Radix UI primitives), lucide-react, **axios**, **@tanstack/react-query**

**shadcn components in use:** `Button`, `Input`, `Card`, `Badge`, `Switch`, `Table`, `Dialog`, `Tabs`, `Label`, `Checkbox`, `RadioGroup`, `Sheet`, `Separator`, `Skeleton`, `DropdownMenu`, `ScrollArea`, `Select`

**Styling rules:**
- Use shadcn components everywhere — NEVER write raw `<button>`, `<input>`, `<select>`, `<textarea>`, `<a>` (for actions) elements. Always import and use the shadcn equivalents: `<Button>`, `<Input>`, `<Select>`, `<Textarea>`, etc.
- Color system is **Dark Mode — default baseline** (defined in `frontend/src/styles/globals.css`, sourced from `docs/BRAND.MD`). There is NO light mode. All `:root` variables are dark:
  - Five core roles: Canvas · Surface · Primary Text · Muted Text · Brand
  - `--background: #11151C` (deep slate-blue canvas — not black, easy on eyes)
  - `--foreground: #E8EBF3` (soft cool white — high contrast, not piercing)
  - `--card: #1A1F2B` (clear elevation layer above canvas)
  - `--muted-foreground: #9AA3B2` (balanced slate — metadata, timestamps, labels)
  - `--primary: #5563FF` (brighter indigo — energy and visibility on dark surfaces)
  - `--primary-foreground: #FFFFFF`
  - `--secondary: #8E98FF` (lighter indigo — company avatars, secondary UI)
  - `--border: #222A3A` (dark subtle border)
  - `--muted: #161C27`, `--accent: #1E2535`
  - `--success: #10B981` (emerald), `--warning: #F59E0B` (amber), `--destructive: #FF4F4F` (red)
  - `--match-high: #10B981`, `--match-review: #F59E0B`
  - **Attention currency rule:** `--primary` is reserved for CTAs, active nav, focus rings, and key highlights. Do NOT apply it broadly.
  - **Match tokens:** always use `text-match-high` / `bg-match-high` for high-match states and `text-match-review` / `bg-match-review` for review states — never use `text-primary` for match indicators.
  - **Auth page rule:** login page uses `bg-sidebar` + `border-sidebar-border` for left panel, `bg-card` for right form panel. Input fields use `bg-background border-border`. Never hardcode any `slate-*` or raw hex colors.
- Sidebar CSS variables — sidebar is EVEN DEEPER than canvas:
  - `--sidebar: #0C1018` (deepest dark — anchors the layout)
  - `--sidebar-foreground: #9AA3B2`
  - `--sidebar-primary: #5563FF`, `--sidebar-primary-foreground: #FFFFFF`
  - `--sidebar-accent: #141A25`, `--sidebar-accent-foreground: #C8D0DC`
  - `--sidebar-border: #181E2C`, `--sidebar-ring: #5563FF`
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

**Backend:** Python 3.9, FastAPI, Pydantic v2, Playwright (Chromium), SQLite, aiosmtplib, PyJWT

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

SQLite DB is created automatically at `backend/jobclawd.db` on first run.
