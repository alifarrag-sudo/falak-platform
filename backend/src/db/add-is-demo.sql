-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: add is_demo flag to core tables
-- Run once against an existing PostgreSQL database.
-- Safe to re-run — uses IF NOT EXISTS logic via DO blocks.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE influencers  ADD COLUMN is_demo INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE users        ADD COLUMN is_demo INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE campaigns    ADD COLUMN is_demo INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE portal_offers ADD COLUMN is_demo INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE portal_users ADD COLUMN is_demo INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE fan_users    ADD COLUMN is_demo INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
