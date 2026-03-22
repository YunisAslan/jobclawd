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

  // Screening Answers
  SCREENING_ANSWERS: "/api/screening-answers",

  // Settings
  SMTP_SETTINGS: "/api/settings/smtp",

  // Account
  DELETE_ACCOUNT: "/api/auth/account",
} as const;
