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
  { value: "relocation", label: "Relocation" },
];

export const FEED_EXPERIENCE_OPTIONS: FeedSelectOption[] = [
  { value: "intern", label: "Intern" },
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead / Manager" },
];

export const FEED_LOCATION_OPTIONS: FeedSelectOption[] = [
  { value: "baku", label: "Baku, Azerbaijan" },
  { value: "worldwide", label: "Worldwide" },
];

export type LocationZone = {
  label: string;
  value: string;
  flag?: string;
  fullWidth?: boolean;
};

export type LocationGroup = {
  heading: string;
  items: LocationZone[];
};

export const REMOTE_LOCATION_GROUPS: LocationGroup[] = [
  {
    heading: "REGION / COUNTRY",
    items: [
      { label: "Worldwide", value: "worldwide", flag: "🌍", fullWidth: true },
      { label: "Azerbaijan", value: "az", flag: "🇦🇿" },
      { label: "Europe (EMEA)", value: "europe", flag: "🇪🇺" },
      { label: "Turkey", value: "turkey", flag: "🇹🇷" },
      { label: "CIS / Russia", value: "cis", flag: "🌐" },
      { label: "USA", value: "us", flag: "🇺🇸" },
    ],
  },
];

export const ONSITE_LOCATION_GROUPS: LocationGroup[] = [
  {
    heading: "CITY",
    items: [
      { label: "Baku, Azerbaijan", value: "baku", flag: "📍", fullWidth: true },
      { label: "Sumqayit", value: "sumqayit", flag: "📍" },
      { label: "Ganja", value: "ganja", flag: "📍" },
    ],
  },
  {
    heading: "RELOCATION HUBS",
    items: [
      { label: "Dubai, UAE", value: "dubai", flag: "🇦🇪" },
      { label: "Berlin, Germany", value: "berlin", flag: "🇩🇪" },
      { label: "Amsterdam", value: "amsterdam", flag: "🇳🇱" },
      { label: "Warsaw", value: "warsaw", flag: "🇵🇱" },
    ],
  },
];

// Scenario C: both remote + on-site selected
export const MIXED_LOCATION_GROUPS: LocationGroup[] = [
  {
    heading: "CITY",
    items: [
      {
        label: "Include Worldwide Remote",
        value: "worldwide",
        flag: "🌍",
        fullWidth: true,
      },
      { label: "Baku, Azerbaijan", value: "baku", flag: "📍", fullWidth: true },
      { label: "Sumqayit", value: "sumqayit", flag: "📍" },
      { label: "Ganja", value: "ganja", flag: "📍" },
    ],
  },
  {
    heading: "RELOCATION HUBS",
    items: [
      { label: "Dubai, UAE", value: "dubai", flag: "🇦🇪" },
      { label: "Berlin, Germany", value: "berlin", flag: "🇩🇪" },
      { label: "Amsterdam", value: "amsterdam", flag: "🇳🇱" },
      { label: "Warsaw", value: "warsaw", flag: "🇵🇱" },
    ],
  },
];

// Legacy fallback (keep for backward compat)
export const LOCATION_GROUPS = REMOTE_LOCATION_GROUPS;

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
