---
name: frontend-services
description: JobClawd frontend service layer architecture guide. Use when creating or modifying service files, wiring up API calls, or structuring data-fetching logic. Enforces the axios + abstract APIService pattern — one base class, domain services that extend it, exported singletons consumed in components/hooks.
---

# JobClawd Frontend Service Architecture

## Pattern Overview

All backend communication is organized into **domain service classes** that extend a shared abstract `APIService` base. Never use raw `fetch` or raw `axios` calls in components.

```
frontend/src/
├── lib/
│   ├── api.service.ts       ← abstract base (axios instance + interceptors)
│   ├── endpoints.ts         ← all URL constants in one place
│   └── services/
│       ├── jobs.service.ts
│       ├── auth.service.ts
│       └── stats.service.ts
```

---

## 1. Abstract Base — `lib/api.service.ts`

```ts
import axios, { AxiosInstance, AxiosRequestConfig } from "axios";

export abstract class APIService {
  protected baseURL: string;
  private axiosInstance: AxiosInstance;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.axiosInstance = axios.create({ baseURL });
    this.setUpInterceptors();
  }

  private setUpInterceptors() {
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => Promise.reject(error)
    );
  }

  get(url: string, params = {}, config: AxiosRequestConfig = {}) {
    return this.axiosInstance.get(url, { params, ...config });
  }

  post(url: string, data = {}, config: AxiosRequestConfig = {}) {
    return this.axiosInstance.post(url, data, config);
  }

  patch(url: string, data = {}, config: AxiosRequestConfig = {}) {
    return this.axiosInstance.patch(url, data, config);
  }

  delete(url: string, config: AxiosRequestConfig = {}) {
    return this.axiosInstance.delete(url, config);
  }
}
```

---

## 2. Endpoints — `lib/endpoints.ts`

```ts
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const ENDPOINTS = {
  // Auth
  SEND_MAGIC_LINK:      "/api/auth/send-magic-link",
  VERIFY_MAGIC_LINK:    "/api/auth/verify-magic-link",
  GOOGLE_AUTH:          "/api/auth/google",

  // Jobs
  SEARCH:               "/api/search",
  JOB_DETAILS:          "/api/job-details",

  // Apply
  APPLY:                "/api/apply",

  // Stats
  STATS:                "/api/stats",
} as const;
```

---

## 3. Domain Services

### `lib/services/jobs.service.ts`

```ts
import { APIService } from "@/lib/api.service";
import { API_BASE_URL, ENDPOINTS } from "@/lib/endpoints";
import { SearchResponse, JobDetail, UserProfile, JobSource } from "@/types";

class JobsService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async search(
    query: string,
    profile: UserProfile,
    sources: JobSource[]
  ): Promise<SearchResponse> {
    return this.post(ENDPOINTS.SEARCH, { query, profile, sources })
      .then((r) => r.data);
  }

  async getDetail(url: string): Promise<JobDetail> {
    return this.post(ENDPOINTS.JOB_DETAILS, { url })
      .then((r) => r.data);
  }
}

export const jobsService = new JobsService();
```

### `lib/services/auth.service.ts`

```ts
import { APIService } from "@/lib/api.service";
import { API_BASE_URL, ENDPOINTS } from "@/lib/endpoints";

class AuthService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async sendMagicLink(email: string): Promise<void> {
    return this.post(ENDPOINTS.SEND_MAGIC_LINK, { email })
      .then((r) => r.data);
  }

  async verifyMagicLink(token: string): Promise<{ access_token: string; user: { email: string; name: string } }> {
    return this.post(ENDPOINTS.VERIFY_MAGIC_LINK, { token })
      .then((r) => r.data);
  }
}

export const authService = new AuthService();
```

### `lib/services/apply.service.ts`

```ts
import { APIService } from "@/lib/api.service";
import { API_BASE_URL, ENDPOINTS } from "@/lib/endpoints";
import { ApplyRequest, ApplyResponse } from "@/types";

class ApplyService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async apply(request: ApplyRequest): Promise<ApplyResponse> {
    return this.post(ENDPOINTS.APPLY, request)
      .then((r) => r.data);
  }
}

export const applyService = new ApplyService();
```

### `lib/services/stats.service.ts`

```ts
import { APIService } from "@/lib/api.service";
import { API_BASE_URL, ENDPOINTS } from "@/lib/endpoints";
import { StatsResponse } from "@/types";

class StatsService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getStats(): Promise<StatsResponse> {
    return this.get(ENDPOINTS.STATS, {})
      .then((r) => r.data);
  }
}

export const statsService = new StatsService();
```

---

## 4. Consuming Services in Components

Always call the exported singleton — never `new XxxService()` in a component.

### One-time fetch on mount

```tsx
import { statsService } from "@/lib/services/stats.service";

const [stats, setStats] = useState<StatsResponse>(EMPTY_STATS);
const [loading, setLoading] = useState(true);

useEffect(() => {
  statsService.getStats()
    .then(setStats)
    .catch(() => {})
    .finally(() => setLoading(false));
}, []);
```

### User-triggered fetch with error display

```tsx
import { jobsService } from "@/lib/services/jobs.service";

const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

async function handleSearch() {
  setLoading(true);
  setError(null);
  try {
    const result = await jobsService.search(query, profile, sources);
    setJobs(result.jobs);
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { detail?: string } } })
      ?.response?.data?.detail;
    setError(msg ?? "Search failed. Please try again.");
  } finally {
    setLoading(false);
  }
}
```

### Lazy detail fetch (on drawer open)

```tsx
import { jobsService } from "@/lib/services/jobs.service";

const [detail, setDetail] = useState<JobDetail | null>(null);
const [detailLoading, setDetailLoading] = useState(false);

useEffect(() => {
  if (!job) return;
  setDetail(null);
  setDetailLoading(true);
  jobsService.getDetail(job.url)
    .then(setDetail)
    .catch(() => {})
    .finally(() => setDetailLoading(false));
}, [job?.url]);
```

---

## 5. Adding a New Service — Checklist

1. Add endpoint constant(s) to `lib/endpoints.ts`
2. Create `lib/services/<domain>.service.ts` extending `APIService`
3. Add typed methods — each returns `this.get/post/patch(...).then(r => r.data)`
4. Export a singleton: `export const xxxService = new XxxService()`
5. Import the singleton in the component or custom hook — never `new` it again

---

## Rules

- **One singleton per service** — export at bottom of file, import everywhere else.
- **No raw axios or fetch in components** — always go through a service method.
- **Error shape from FastAPI** is `{ detail: string }` — access via `err.response.data.detail`.
- **`getDetail` is slow** (runs Playwright) — call lazily on drawer open, never on card render.
- **All URL strings live in `endpoints.ts`** — never hardcode paths in service methods.
- **`search()` always pass profile + sources** — enables backend match scoring.
