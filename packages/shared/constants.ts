// ──────────────────────────────────────────────
// Shared enums & constants — single source of truth
// Keep in sync with apps/api/models/schemas.py
// ──────────────────────────────────────────────

export const WORK_MODES = ["remote", "hybrid", "onsite"] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export const EXPERIENCE_LEVELS = ["intern", "junior", "mid", "senior", "lead"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const MATCH_LEVELS = ["high", "review", "trash"] as const;
export type MatchLevel = (typeof MATCH_LEVELS)[number];

export const APPLICATION_STATUSES = ["sent", "replied", "rejected", "withdrawn"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const JOB_SOURCES = ["jobsearch", "linkedin", "indeed"] as const;
export type JobSource = (typeof JOB_SOURCES)[number];

export const APPLY_METHODS = ["email", "easy_apply", "external", "direct"] as const;
export type ApplyMethod = (typeof APPLY_METHODS)[number];

export const SALARY_PERIODS = ["annual", "monthly", "hourly"] as const;
export type SalaryPeriod = (typeof SALARY_PERIODS)[number];

export const LOCATION_TYPES = ["region", "country", "city"] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];
