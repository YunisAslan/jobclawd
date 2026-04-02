export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const ENDPOINTS = {
  // Auth
  SEND_MAGIC_LINK: "/api/auth/send-magic-link",
  VERIFY_MAGIC_LINK: "/api/auth/verify-magic-link",
  GOOGLE_AUTH: "/api/auth/google",

  // Jobs
  SEARCH: "/api/search",
  SEARCH_STREAM: "/api/search/stream",
  JOB_DETAILS: "/api/job-details",

  // Apply
  APPLY: "/api/apply",
  APPLY_READINESS: "/api/apply/readiness",

  // Stats
  STATS: "/api/stats",

  // Meta
  META_FILTERS: "/api/meta/filters",

  // Credits
  CREDITS: "/api/credits",

  // Profile
  PROFILE: "/api/profile",
  CV_UPLOAD: "/api/profile/cv/upload",
  AVATAR_UPLOAD: "/api/profile/avatar/upload",

  // Account
  DELETE_ACCOUNT: "/api/auth/account",

  // Saved Vacancies
  SAVED_VACANCIES: "/api/saved-vacancies",
  SAVED_VACANCIES_CHECK: "/api/saved-vacancies/check",

  // CV Analysis
  CV_ANALYSIS_BUNDLE: "/api/cv-analysis-bundle",
  CV_MATCH: "/api/cv-match",
  CV_SUGGESTIONS: "/api/cv-suggestions",
  CV_DRAFT: "/api/cv-draft",
  CV_EXPORT: "/api/cv-export",

  // Document session (ONLYOFFICE + PDF→DOCX)
  DOCUMENT_SESSION: "/api/document/session",
  DOCUMENT_CONVERT: "/api/document/convert-to-docx",
  DOCUMENT_EXPORT: "/api/document/export",
} as const;
