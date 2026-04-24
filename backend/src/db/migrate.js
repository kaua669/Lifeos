// src/db/migrate.js — Creates all tables if they don't exist
'use strict';

require('dotenv').config();
const { query } = require('./pool');

const SCHEMA = `
-- ═══════════════════════════════════════════════════
--  LifeOS Database Schema
--  All tables use soft-delete pattern (deleted_at)
--  Row-level isolation via user_id FK on every table
-- ═══════════════════════════════════════════════════

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── USERS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  bio           TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ─── REFRESH TOKENS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT         NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ  NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- ─── SCHEDULE EVENTS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS schedule_events (
  id          SERIAL PRIMARY KEY,
  user_id     INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  event_date  DATE         NOT NULL,
  event_time  TIME,
  category    VARCHAR(50)  DEFAULT 'Geral',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_events_user_date ON schedule_events(user_id, event_date) WHERE deleted_at IS NULL;

-- ─── STUDY SUBJECTS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS study_subjects (
  id          SERIAL PRIMARY KEY,
  user_id     INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_subjects_user ON study_subjects(user_id) WHERE deleted_at IS NULL;

-- ─── STUDY NOTES ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS study_notes (
  id          SERIAL PRIMARY KEY,
  user_id     INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id  INT          REFERENCES study_subjects(id) ON DELETE SET NULL,
  title       VARCHAR(200) NOT NULL,
  content     TEXT         NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notes_user       ON study_notes(user_id)     WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notes_subject    ON study_notes(subject_id)  WHERE deleted_at IS NULL;

-- ─── GYM WORKOUTS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS gym_workouts (
  id              SERIAL PRIMARY KEY,
  user_id         INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_name   VARCHAR(100) NOT NULL,
  exercise_type   VARCHAR(50)  DEFAULT 'Musculação',
  sets            SMALLINT,
  reps            SMALLINT,
  weight          NUMERIC(6,2),
  workout_date    DATE         NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON gym_workouts(user_id, workout_date DESC) WHERE deleted_at IS NULL;

-- ─── NUTRITION ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS nutrition_entries (
  id           SERIAL PRIMARY KEY,
  user_id      INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meal_name    VARCHAR(100) NOT NULL,
  calories     NUMERIC(7,1) DEFAULT 0,
  protein      NUMERIC(6,1) DEFAULT 0,
  carbs        NUMERIC(6,1) DEFAULT 0,
  fats         NUMERIC(6,1) DEFAULT 0,
  entry_date   DATE         NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_nutrition_user_date ON nutrition_entries(user_id, entry_date DESC) WHERE deleted_at IS NULL;

-- ─── FINANCE TRANSACTIONS ────────────────────────────
CREATE TABLE IF NOT EXISTS finance_transactions (
  id           SERIAL PRIMARY KEY,
  user_id      INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description  VARCHAR(200) NOT NULL,
  type         VARCHAR(10)  NOT NULL CHECK (type IN ('INCOME','EXPENSE')),
  amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category     VARCHAR(50),
  trans_date   DATE         NOT NULL,
  frequency    VARCHAR(20)  DEFAULT 'Único',
  notes        TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_trans_user_date ON finance_transactions(user_id, trans_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_trans_user_type ON finance_transactions(user_id, type)             WHERE deleted_at IS NULL;

-- ─── SALARIES / FIXED INCOME ─────────────────────────
CREATE TABLE IF NOT EXISTS finance_salaries (
  id            SERIAL PRIMARY KEY,
  user_id       INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source        VARCHAR(100) NOT NULL,
  amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  day_of_month  SMALLINT      CHECK (day_of_month BETWEEN 1 AND 31),
  notes         TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_salaries_user ON finance_salaries(user_id) WHERE deleted_at IS NULL;

-- ─── TRIGGER: auto-update updated_at ─────────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  -- users
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_users') THEN
    CREATE TRIGGER set_updated_at_users
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
  -- schedule_events
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_events') THEN
    CREATE TRIGGER set_updated_at_events
      BEFORE UPDATE ON schedule_events
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
  -- study_subjects
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_subjects') THEN
    CREATE TRIGGER set_updated_at_subjects
      BEFORE UPDATE ON study_subjects
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
  -- study_notes
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_notes') THEN
    CREATE TRIGGER set_updated_at_notes
      BEFORE UPDATE ON study_notes
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
END $$;
`;

async function migrate() {
  try {
    console.log('🔄 Running database migrations...');
    await query(SCHEMA);
    console.log('✅ Database schema ready!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
