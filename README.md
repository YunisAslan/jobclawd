# JobClawd

**AI-powered job search & CV optimization platform.** JobClawd aggregates job listings from 10+ sources, scores each vacancy against your CV with AI, and helps you tailor an ATS-ready resume — so you apply to the right roles with the right CV.

> ℹ️ **Self-hostable & bring-your-own-key.** JobClawd is a portfolio project, not a hosted service — clone or fork it and run your own instance. There is **no shared OpenAI key**: every user adds their own key in-app (Settings → OpenAI API key), so you're only ever billed for your own usage. Paid credit purchases are disabled; every account starts with free credits.

---

## Demo

<video src="https://github.com/YunisAslan/jobclawd/raw/main/apps/web/public/jobclawd-intro.mp4" controls width="100%"></video>

▶️ **[Watch the demo video](apps/web/public/jobclawd-intro.mp4)** _(if the player above doesn't load, click to view)_

---

## Features

- **Job feed** — aggregated listings from jobsearch.az, LinkedIn, Indeed, Glassdoor, RemoteOK, WeWorkRemotely, Jobicy and more, with an **AI match score** per CV.
- **CV editor** — structured section editing, live ATS preview, and an **AI suggestion engine** (accept/reject suggestions, re-score with *Check Impact*).
- **Multi-CV comparison** — score several CV versions against one vacancy, side by side.
- **Saved vacancies & application tracking** — bookmark jobs and track where you've applied.
- **Analytics dashboard** — activity trends, score distribution, source breakdown, top titles, CV performance.
- **Auth** — magic-link email login + Google OAuth (JWT).

---

## How it works

```
Scrape (Playwright) → parse to structured CVData → AI match scoring (OpenAI)
                                                  → AI suggestions → ReportLab PDF
```

1. **Aggregate** listings from multiple boards via Playwright browser automation.
2. **Parse** the user's CV into a structured `CVData` schema.
3. **Score** each vacancy against the CV using the OpenAI API (deterministic, `temperature=0`).
4. **Suggest** targeted, ATS-focused improvements; re-score on demand.
5. **Export** a polished CV as PDF.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui, React Query |
| **Backend** | FastAPI (Python), Playwright/patchright, ReportLab |
| **Database** | PostgreSQL |
| **AI** | OpenAI API — **bring-your-own-key** (match scoring, suggestions, metadata extraction) |
| **Infra** | Docker Compose, Caddy (reverse proxy + TLS) |

---

## Monorepo Structure

```
repo/
  apps/
    api/      → FastAPI backend
      routers/       → HTTP handlers (thin)
      services/      → business logic
      repositories/  → SQL only
      scraper/       → job-board scrapers (Playwright)
      models/        → Pydantic + CV schema
    web/      → Next.js frontend (App Router)
      src/app/          → routes (landing, /dashboard/*, /admin/*)
      src/components/    → UI + feature components
      src/services/      → API client classes
  packages/shared/  → shared TypeScript types
  docker-compose.yml
```

The backend follows a clean split: **routers** handle HTTP only, **services** hold business logic, **repositories** contain SQL only, **scrapers** talk to external sources.

---

## Getting Started (self-host)

Clone or fork the repo and run your own instance. Two paths: **Docker** (simplest) or **manual**.

### Prerequisites

- **Docker + Docker Compose** — for the one-command path, or
- **Node.js 20+**, **Python 3.11+**, and a **PostgreSQL 16** database — for manual setup
- An **OpenAI API key** — *not* set in env; each user adds their own in the app after signing in

### 1. Clone & configure

```bash
git clone https://github.com/YunisAslan/jobclawd.git
cd jobclawd
cp .env.local.example .env          # local dev  (use .env.prod.example for a server)
```

Open `.env` and fill in the **required** values — the file documents every one:

- `DATABASE_URL` — Postgres connection string (defaults match the Docker DB below)
- `JWT_SECRET` — generate with `openssl rand -hex 32`
- **At least one login method:**
  - **SMTP** (`SMTP_*`) for magic-link email login, **and/or**
  - **Google OAuth** (`GOOGLE_CLIENT_ID/SECRET`) — add `http://localhost:8000/api/auth/callback/google` as an Authorized redirect URI in Google Cloud Console

Everything else (OpenAI model, encryption secret, etc.) has working defaults.

### 2a. Run with Docker (recommended)

```bash
docker compose up --build          # web → http://localhost:3000, api → http://localhost:8000
```

Postgres, the API, and the web app all start together; the database schema is created automatically on first boot.

### 2b. Run manually

Start a PostgreSQL 16 instance and point `DATABASE_URL` at it, then:

**Backend**
```bash
cd apps/api
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
playwright install chromium        # browser for scraping
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend** (in a second terminal)
```bash
cd apps/web
npm install
npm run dev                        # http://localhost:3000
```

### 3. Add your OpenAI key 🔑

1. Open http://localhost:3000 and **sign in** (magic link or Google).
2. Go to **Settings → OpenAI API key** and paste your key (`sk-...`) — get one at
   [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
3. The key is validated with OpenAI, stored **encrypted**, and used only for your own requests.

Until a key is added, AI features (CV match, suggestions, analysis) prompt you to add one;
job search still works without AI enrichment.

---

## Configuration reference

| File | Use |
|------|-----|
| [`.env.local.example`](.env.local.example) | Local development template → copy to `.env` |
| [`.env.prod.example`](.env.prod.example) | Production/server template → copy to `.env.prod` |

Production deploy (behind Caddy + TLS):
```bash
cp .env.prod.example .env.prod     # fill in domains, secrets, SMTP, OAuth
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

---

## License

Personal portfolio project — provided as-is for learning and self-hosting. Not licensed for commercial resale.
