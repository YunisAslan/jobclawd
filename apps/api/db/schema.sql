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
