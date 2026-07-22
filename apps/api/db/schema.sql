CREATE TABLE IF NOT EXISTS applications (
  id          SERIAL PRIMARY KEY,
  job_url     TEXT NOT NULL,
  job_title   TEXT NOT NULL,
  company     TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'jobsearch',
  hr_email    TEXT,
  cv_name     TEXT,
  cv_url      TEXT,
  match_score INTEGER,
  match_level TEXT,
  status      TEXT NOT NULL DEFAULT 'sent',
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes       TEXT,
  CONSTRAINT applications_job_url_key UNIQUE (job_url)
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id         SERIAL PRIMARY KEY,
  email      TEXT NOT NULL,
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS filter_options (
  id       SERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  value    TEXT NOT NULL,
  label    TEXT NOT NULL,
  CONSTRAINT filter_options_category_value_key UNIQUE (category, value)
);

CREATE TABLE IF NOT EXISTS countries (
  code     TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  flag     TEXT,
  currency TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cities (
  value        TEXT NOT NULL,
  country_code TEXT NOT NULL REFERENCES countries(code),
  name         TEXT NOT NULL,
  PRIMARY KEY (value, country_code)
);

CREATE TABLE IF NOT EXISTS profiles (
  email      TEXT PRIMARY KEY,
  data       JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_credits (
  email       TEXT PRIMARY KEY,
  credits     INTEGER NOT NULL DEFAULT 10,
  max_credits INTEGER NOT NULL DEFAULT 10,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS search_cache (
  id           SERIAL PRIMARY KEY,
  filters_hash TEXT NOT NULL UNIQUE,
  filters_json JSONB NOT NULL,
  result_json  JSONB NOT NULL,
  job_count    INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL,
  hit_count    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_search_cache_expires
  ON search_cache (expires_at);

CREATE TABLE IF NOT EXISTS job_metadata (
  url            TEXT PRIMARY KEY,
  seniority_str  TEXT,
  seniority_src  TEXT,
  experience_years_str TEXT,
  experience_years_src TEXT,
  experience_str TEXT,
  experience_src TEXT,
  job_type_str   TEXT,
  job_type_src   TEXT,
  salary_str     TEXT,
  salary_src     TEXT,
  work_mode_str  TEXT,
  work_mode_src  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

ALTER TABLE job_metadata ADD COLUMN IF NOT EXISTS experience_src TEXT;
ALTER TABLE job_metadata ADD COLUMN IF NOT EXISTS seniority_str TEXT;
ALTER TABLE job_metadata ADD COLUMN IF NOT EXISTS seniority_src TEXT;
ALTER TABLE job_metadata ADD COLUMN IF NOT EXISTS experience_years_str TEXT;
ALTER TABLE job_metadata ADD COLUMN IF NOT EXISTS experience_years_src TEXT;
ALTER TABLE job_metadata ADD COLUMN IF NOT EXISTS job_type_src TEXT;
ALTER TABLE job_metadata ADD COLUMN IF NOT EXISTS salary_src TEXT;
ALTER TABLE job_metadata ADD COLUMN IF NOT EXISTS work_mode_src TEXT;
ALTER TABLE job_metadata ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
UPDATE job_metadata SET expires_at = NOW() + INTERVAL '24 hours' WHERE expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_job_metadata_expires
  ON job_metadata (expires_at);

-- Vacancy Intelligence Engine: new columns for job_metadata
ALTER TABLE job_metadata ADD COLUMN IF NOT EXISTS fingerprint       TEXT;
ALTER TABLE job_metadata ADD COLUMN IF NOT EXISTS skills_str        TEXT;
ALTER TABLE job_metadata ADD COLUMN IF NOT EXISTS languages_str     TEXT;
ALTER TABLE job_metadata ADD COLUMN IF NOT EXISTS parse_confidence  INTEGER;
ALTER TABLE job_metadata ADD COLUMN IF NOT EXISTS parser_version    TEXT;

CREATE INDEX IF NOT EXISTS idx_job_metadata_fingerprint
  ON job_metadata (fingerprint) WHERE fingerprint IS NOT NULL;

-- Saved Vacancies with 7-day TTL
CREATE TABLE IF NOT EXISTS saved_vacancies (
  id         SERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  job_url    TEXT NOT NULL,
  job_data   JSONB NOT NULL DEFAULT '{}',
  saved_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  CONSTRAINT saved_vacancies_user_job_key UNIQUE (user_email, job_url)
);

CREATE INDEX IF NOT EXISTS idx_saved_vacancies_user_email
  ON saved_vacancies (user_email);

CREATE INDEX IF NOT EXISTS idx_saved_vacancies_expires
  ON saved_vacancies (expires_at);

-- CV analysis results cache: (user, cv, job) → match + suggestions, 7-day TTL
CREATE TABLE IF NOT EXISTS cv_analysis_cache (
  id               SERIAL PRIMARY KEY,
  email            TEXT NOT NULL,
  cv_url           TEXT NOT NULL,
  job_url          TEXT NOT NULL,
  analysis_json    JSONB NOT NULL,
  suggestions_json JSONB NOT NULL,
  cv_name          TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  CONSTRAINT cv_analysis_cache_unique UNIQUE (email, cv_url, job_url)
);

CREATE INDEX IF NOT EXISTS idx_cv_analysis_cache_email
  ON cv_analysis_cache (email);

CREATE INDEX IF NOT EXISTS idx_cv_analysis_cache_expires
  ON cv_analysis_cache (expires_at);

-- CV parse cache: cv_url → structured CVData JSON (permanent, URL contains UUID)
CREATE TABLE IF NOT EXISTS cv_parse_cache (
  cv_url         TEXT PRIMARY KEY,
  parsed_json    JSONB NOT NULL,
  cv_name        TEXT NOT NULL DEFAULT '',
  schema_version INT NOT NULL DEFAULT 1,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration for existing installs: ensure schema_version column exists.
ALTER TABLE cv_parse_cache ADD COLUMN IF NOT EXISTS schema_version INT NOT NULL DEFAULT 1;

-- Analytics event tables (permanent — no TTL)

CREATE TABLE IF NOT EXISTS cv_analysis_events (
  id            SERIAL PRIMARY KEY,
  user_email    TEXT NOT NULL,
  cv_url        TEXT,
  cv_name       TEXT,
  job_url       TEXT,
  job_title     TEXT,
  company       TEXT,
  overall_score INTEGER,
  match_level   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cv_analysis_events_user    ON cv_analysis_events (user_email);
CREATE INDEX IF NOT EXISTS idx_cv_analysis_events_created ON cv_analysis_events (created_at);

CREATE TABLE IF NOT EXISTS suggestion_events (
  id          SERIAL PRIMARY KEY,
  user_email  TEXT NOT NULL,
  cv_name     TEXT,
  job_url     TEXT,
  category    TEXT NOT NULL,
  priority    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_suggestion_events_user ON suggestion_events (user_email);

CREATE TABLE IF NOT EXISTS impact_check_events (
  id           SERIAL PRIMARY KEY,
  user_email   TEXT NOT NULL,
  cv_name      TEXT,
  job_url      TEXT,
  score_before INTEGER NOT NULL,
  score_after  INTEGER NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_impact_check_events_user ON impact_check_events (user_email);

CREATE TABLE IF NOT EXISTS apply_click_events (
  id         SERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  job_url    TEXT,
  job_title  TEXT,
  company    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_apply_click_events_user ON apply_click_events (user_email);

CREATE TABLE IF NOT EXISTS search_events (
  id           SERIAL PRIMARY KEY,
  user_email   TEXT NOT NULL,
  query        TEXT,
  result_count INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_search_events_user ON search_events (user_email);

-- Email change verification requests (one pending request per user at a time)
CREATE TABLE IF NOT EXISTS email_change_requests (
  id          SERIAL PRIMARY KEY,
  old_email   TEXT NOT NULL,
  new_email   TEXT NOT NULL,
  token       TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_change_token     ON email_change_requests (token);
CREATE INDEX IF NOT EXISTS idx_email_change_old_email ON email_change_requests (old_email);

-- Re-auth OTP codes sent to current email before allowing an email change
CREATE TABLE IF NOT EXISTS email_reauth_codes (
  id         SERIAL PRIMARY KEY,
  email      TEXT NOT NULL,
  code       TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reauth_codes_email ON email_reauth_codes (email);

-- Revert tokens stored after a successful email change (7-day window to undo)
CREATE TABLE IF NOT EXISTS email_revert_tokens (
  id          SERIAL PRIMARY KEY,
  old_email   TEXT NOT NULL,
  new_email   TEXT NOT NULL,
  token       TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_revert_tokens_token ON email_revert_tokens (token);

-- Credit purchase waitlist (payment not yet live)
CREATE TABLE IF NOT EXISTS credit_waitlist (
  id         SERIAL PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_waitlist_created ON credit_waitlist (created_at DESC);

-- Per-user OpenAI API keys (bring-your-own-key). Stored encrypted at rest.
CREATE TABLE IF NOT EXISTS user_api_keys (
  email         TEXT PRIMARY KEY,
  openai_key    TEXT NOT NULL,        -- Fernet-encrypted ciphertext, never plaintext
  key_hint      TEXT,                 -- last 4 chars, safe to display (e.g. "…a1b2")
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin system logs (self-healing monitor)
CREATE TABLE IF NOT EXISTS admin_logs (
  id         SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level      TEXT NOT NULL DEFAULT 'INFO',   -- INFO | SUCCESS | WARNING | ERROR | CRITICAL
  source     TEXT NOT NULL DEFAULT 'system', -- scraper name or component
  event      TEXT NOT NULL DEFAULT '',       -- short event type slug
  message    TEXT NOT NULL,
  details    JSONB
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_level   ON admin_logs (level);
CREATE INDEX IF NOT EXISTS idx_admin_logs_source  ON admin_logs (source);
