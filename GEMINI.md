# JobClawd — AI Job Automation Agent (MVP) Architecture Context

## 1. Project Overview

**JobClawd** is a B2C SaaS platform designed to automate the job search and application process. The system aggregates vacancies from multiple sources (Jobsearch.az, LinkedIn, Indeed), applies intelligent filtering (**Match Score**) based on the user's profile, and executes applications in either "Assistant" (Semi-automated) or "Autopilot" (Fully automated) modes.

## 2. Tech Stack

### 🖥️ Frontend (Client)

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + **shadcn/ui** (Radix UI)
- **State Management:** TanStack Query (React Query) + URL Search Params
- **Forms:** React Hook Form + Zod Validation
- **Http Client:** Axios (Typed instances)
- **Icons:** Lucide React

### ⚙️ Backend (Server)

- **Framework:** FastAPI (Python 3.11+)
- **Server:** Uvicorn
- **Scraping:** Playwright (Headless Browser) + BeautifulSoup4
- **Validation:** Pydantic V2
- **Database:** SQLite (for MVP), PostgreSQL (for Prod)
- **Task Queue:** FastAPI BackgroundTasks

## 3. Folder Structure (Monorepo)

```text
root/
├── frontend/                          # Next.js Application
│   ├── app/                           # App Router
│   │   ├── (auth)/                    # login, register layouts
│   │   ├── (dashboard)/               # Protected routes (Sidebar layout)
│   │   │   ├── feed/                  # Job Search & "Command Center"
│   │   │   ├── applications/          # Status tracking board
│   │   │   ├── profile/               # User CV & Preferences
│   │   │   └── settings/              # Blacklist, Autopilot toggles
│   │   ├── api/                       # Next.js API Routes (if needed for proxy)
│   │   ├── layout.tsx                 # Root Layout
│   │   └── page.tsx                   # Landing Page
│   ├── components/
│   │   ├── ui/                        # Shadcn primitives (button, input, card...)
│   │   ├── feed/                      # JobCard, FeedFilterForm, LocationPicker
│   │   ├── layout/                    # Sidebar, TopBar, UserNav
│   │   └── shared/                    # StatusBadge, MatchScoreRing, EmptyState
│   ├── lib/
│   │   ├── api.ts                     # Axios instance + Interceptors
│   │   ├── utils.ts                   # cn() helper
│   │   └── constants.ts               # Static data (Countries, Job Types)
│   ├── hooks/                         # use-job-search, use-profile
│   ├── services/                      # API wrapper functions (AuthService, JobService)
│   └── validations/                   # Zod schemas (searchSchema, profileSchema)
│
├── backend/                           # FastAPI Service
│   ├── main.py                        # Entry point + CORS setup
│   ├── config.py                      # Env variables management
│   ├── database.py                    # SQLite connection & SessionLocal
│   ├── models/                        # SQLAlchemy ORM models (User, Job, Application)
│   ├── schemas/                       # Pydantic models (Request/Response)
│   ├── routers/                       # API Endpoints
│   │   ├── auth.py                    # JWT Login/Register
│   │   ├── jobs.py                    # Search & Feed logic
│   │   ├── applications.py            # Apply logic
│   │   └── user.py                    # Profile & Settings
│   ├── services/                      # Business Logic Layer
│   │   ├── matcher.py                 # "Match Score" algorithm
│   │   ├── mailer.py                  # Email sending logic
│   │   └── safety.py                  # Anti-fail & Blacklist checks
│   └── scrapers/                      # Scraping Engines
│       ├── core.py                    # Base Scraper Class
│       ├── jobsearch_az.py            # Jobsearch.az parser
│       ├── linkedin.py                # LinkedIn parser (Playwright)
│       └── indeed.py                  # Indeed parser
└── jobclawd.db                        # SQLite Database file
```

## 4. API Endpoints (Core)

| Group     | Endpoint              | Method  | Description                                               |
| :-------- | :-------------------- | :------ | :-------------------------------------------------------- |
| **Auth**  | `/api/auth/login`     | POST    | Returns JWT Access Token                                  |
| **Auth**  | `/api/auth/register`  | POST    | Creates new user                                          |
| **Jobs**  | `/api/jobs/search`    | GET     | Real-time scraping + DB cache. Params: `q`, `loc`, `mode` |
| **Jobs**  | `/api/jobs/feed`      | GET     | Returns personalized feed based on user profile           |
| **Apply** | `/api/apply/generate` | POST    | Generates cover letter & email body (Draft)               |
| **Apply** | `/api/apply/send`     | POST    | Executes application (Assistant or Autopilot)             |
| **User**  | `/api/user/profile`   | GET/PUT | Manage CVs, Experience, Bio                               |
| **User**  | `/api/user/blacklist` | POST    | Add company to blocklist                                  |

## 5. Business Logic & Rules

### 🧠 1. Job Feed & "Dynamic Command Center"

Users can modify their profile data **temporarily** (session-based) while searching.

- **Context Bar:** "Chips" located below the search bar (CV, Level, Mode).
- **Override Logic:** If a user changes a chip (e.g., Default _Remote_ -> _On-site_), the chip changes color to indicate a "Modified State" for that search session only.

### 🌍 2. Dynamic Location Logic

The `Location` input behavior changes based on the selected `Work Mode`:

- **Case A (Remote):** Input becomes a "Region Selector" (Worldwide, EMEA, USA, Azerbaijan-Remote). Dropdown shows countries/regions.
- **Case B (On-site):** Input becomes a "City Selector" (Baku, Sumqayit, Relocation Hubs). Dropdown shows specific cities.

### 🛡️ 3. Safety Protocols

- **Anti-Fail:** The user's `current_employer` field is cross-referenced with the vacancy's `company_name` (using Fuzzy matching). If matched, the job is hidden to prevent accidental applications.
- **Blacklist:** If a user has blocked a company, it does not appear in search results.

### 📊 4. Matching Algorithm

A **0-100%** match score is calculated for every vacancy:

- `Skills Match` (40%)
- `Title Match` (30%)
- `Location/Mode Match` (20%) - _Critical (e.g., if User wants Remote but Job is On-site, score drops significantly)_
- `Experience Level` (10%)

## 6. 👨‍💻 Development Guideline (REQUIREMENTS)

### 🟢 General Principles

1.  **DRY (Don't Repeat Yourself):** Do not write the same code twice. If functionality (e.g., `formatCurrency` or a `Badge`) is used in multiple places, move it to `components/shared/` or `lib/utils.ts`.
2.  **KISS (Keep It Simple, Stupid):** Code must be readable and simple. Avoid unnecessary abstractions.
3.  **Naming Convention:**
    - Frontend Components: `PascalCase` (e.g., `JobCard.tsx`)
    - Functions/Hooks: `camelCase` (e.g., `useJobSearch`)
    - Backend Files: `snake_case` (e.g., `job_service.py`)
4.  **Remove unnecessary comments:** If a code is self-explanatory, remove the comments.
5.  **Don't keep unused imports:** If a code is not used, remove it.

### 🖥️ Frontend (Next.js 15 + Shadcn)

4.  **Shadcn First:** Always use **Shadcn/ui** components (`Button`, `Card`, `Input`, `Dialog`, `Select`) instead of writing custom CSS.
5.  **Server Components by Default:** In Next.js 15, everything is a Server Component by default. Add the `'use client'` directive at the top of the file **only** when interactivity (onClick, useState, useEffect) is strictly necessary.
6.  **Tailwind Merge:** Always use the `cn()` utility (clsx + tailwind-merge) to combine class names.
    - _Correct:_ `className={cn("p-4", isActive && "bg-blue-500")}`
7.  **Strict Type Safety:** The use of `any` is forbidden. Always define TypeScript interfaces for API data (e.g., `interface Job`).
8.  **Forms & Validation:** Do not manage form state manually. Always use **React Hook Form** + **Zod**.

### ⚙️ Backend (FastAPI + Python)

9.  **Pydantic Models:** Always use Pydantic schemas (`schemas/`) for Request and Response bodies. Avoid returning raw dictionaries.
10. **Type Hints:** Arguments and return values in Python functions must be typed. (`def get_jobs(...) -> list[JobSchema]:`)
11. **Scraping Safety:** Scrapers must never crash the server. Catch errors using `try/except` and log them properly.
12. **Env Variables:** Read API Keys and configurations from `config.py`. Never hardcode secrets.

### 🔄 Data & State

13. **Hardcoded Strings:** Do not write static values (e.g., "Remote", "Hybrid", City names) inside components. Store them in `lib/constants.ts`.
14. **Error Handling (UX):** When an error occurs, display a **Toast Notification** (Shadcn `use-toast`) to the user, not just a console log.
