import { JobListing } from "@/types";

export type FeedSelectOption = {
  value: string;
  label: string;
};

export const FEED_SOURCE_OPTIONS: FeedSelectOption[] = [
  { value: "jobsearch", label: "Jobsearch" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "indeed", label: "Indeed" },
];

export const FEED_WORK_MODE_OPTIONS: FeedSelectOption[] = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
];

export const FEED_EXPERIENCE_OPTIONS: FeedSelectOption[] = [
  { value: "intern", label: "Intern" },
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead / Manager" },
];

// ─── Location types (API-ready) ─────────────────────────────

// On-site / Hybrid / Remote mode — cascading country → city
export type OnsiteCountry = {
  label: string;
  value: string; // ISO code
  flag?: string;
  cities: { label: string; value: string }[];
};

export const ONSITE_COUNTRIES: OnsiteCountry[] = [
  {
    label: "Azerbaijan",
    value: "AZ",
    flag: "🇦🇿",
    cities: [
      { label: "Baku", value: "baku" },
      { label: "Sumqayit", value: "sumqayit" },
      { label: "Ganja", value: "ganja" },
    ],
  },
  {
    label: "UAE",
    value: "AE",
    flag: "🇦🇪",
    cities: [
      { label: "Dubai", value: "dubai" },
      { label: "Abu Dhabi", value: "abu-dhabi" },
    ],
  },
  {
    label: "Germany",
    value: "DE",
    flag: "🇩🇪",
    cities: [
      { label: "Berlin", value: "berlin" },
      { label: "Munich", value: "munich" },
      { label: "Hamburg", value: "hamburg" },
    ],
  },
  {
    label: "Netherlands",
    value: "NL",
    flag: "🇳🇱",
    cities: [
      { label: "Amsterdam", value: "amsterdam" },
      { label: "Rotterdam", value: "rotterdam" },
    ],
  },
  {
    label: "Poland",
    value: "PL",
    flag: "🇵🇱",
    cities: [
      { label: "Warsaw", value: "warsaw" },
      { label: "Kraków", value: "krakow" },
    ],
  },
  {
    label: "Turkey",
    value: "TR",
    flag: "🇹🇷",
    cities: [
      { label: "Istanbul", value: "istanbul" },
      { label: "Ankara", value: "ankara" },
    ],
  },
];

export const FEED_CV_OPTIONS: FeedSelectOption[] = [
  { value: "default", label: "CV: Default (CV_Main.pdf)" },
  { value: "cv_optimized", label: "CV: CV_Product_Manager.pdf" },
  { value: "cv_general", label: "CV: CV_General.pdf" },
];

export const FEED_DATE_OPTIONS: FeedSelectOption[] = [
  { value: "1d", label: "Past 24 hours" },
  { value: "3d", label: "Past 3 days" },
  { value: "7d", label: "Past week" },
  { value: "1m", label: "Past month" },
  { value: "all", label: "All time" },
];

export const FEED_SORT_OPTIONS: FeedSelectOption[] = [
  { value: "job-title-ascending", label: "Job title (A-Z)" },
  { value: "job-title-descending", label: "Job title (Z-A)" },
  { value: "latest", label: "Latest" },
];

export const FEED_JOB_TYPE_OPTIONS: FeedSelectOption[] = [
  { value: "full-time", label: "Full-time" },
  { value: "contract", label: "Contract" },
  { value: "part-time", label: "Part-time" },
];

export const FEED_BLOCKED_COMPANIES = ["Kapital Bank", "Pasha Bank"];

export const FEED_JOBS_MOCK: JobListing[] = [
  {
    title: "Product Manager",
    company: "Finhub",
    url: "https://example.com/jobs/1",
    date_posted: "2026-02-21",
    source: "linkedin",
    match_score: 92,
    match_level: "high",
    match_flags: ["Strong product strategy fit"],
  },
  {
    title: "Technical Project Manager",
    company: "Cloudlane",
    url: "https://example.com/jobs/2",
    date_posted: "2026-02-20",
    source: "jobsearch",
    match_score: 88,
    match_level: "high",
    match_flags: ["Roadmap and stakeholder fit"],
  },
  {
    title: "Operations Analyst",
    company: "NordicPay",
    url: "https://example.com/jobs/3",
    date_posted: "2026-02-19",
    source: "indeed",
    match_score: 72,
    match_level: "review",
    match_flags: ["Domain fit is moderate"],
  },
  {
    title: "Business Analyst",
    company: "ScaleDock",
    url: "https://example.com/jobs/4",
    date_posted: "2026-02-18",
    source: "linkedin",
    match_score: 68,
    match_level: "review",
    match_flags: ["Requires deeper tools check"],
  },
];
