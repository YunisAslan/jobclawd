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
ALTER TABLE job_metadata ADD COLUMN IF NOT EXISTS job_type_src TEXT;
ALTER TABLE job_metadata ADD COLUMN IF NOT EXISTS salary_src TEXT;
ALTER TABLE job_metadata ADD COLUMN IF NOT EXISTS work_mode_src TEXT;
ALTER TABLE job_metadata ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
UPDATE job_metadata SET expires_at = NOW() + INTERVAL '24 hours' WHERE expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_job_metadata_expires
  ON job_metadata (expires_at);

CREATE TABLE IF NOT EXISTS screening_answers (
  id         SERIAL PRIMARY KEY,
  email      TEXT NOT NULL,
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT screening_answers_email_question_key UNIQUE (email, question)
);
