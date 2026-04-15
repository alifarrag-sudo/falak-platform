/**
 * Idempotent migration: add is_demo column to core tables.
 * Called from start.sh on every boot — safe because DO blocks swallow duplicate_column errors.
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('ℹ️  No DATABASE_URL — skipping is_demo migration (SQLite mode)');
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const sql = `
CREATE TABLE IF NOT EXISTS webhook_events (
  id          TEXT PRIMARY KEY,
  event_type  TEXT NOT NULL,
  payload     TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed   INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type      ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_received  ON webhook_events(received_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);
DO $$ BEGIN ALTER TABLE influencers   ADD COLUMN is_demo INTEGER DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users         ADD COLUMN is_demo INTEGER DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE campaigns     ADD COLUMN is_demo INTEGER DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE portal_offers ADD COLUMN is_demo INTEGER DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE portal_users  ADD COLUMN is_demo INTEGER DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE fan_users     ADD COLUMN is_demo INTEGER DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users         ADD COLUMN last_login_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users         ADD COLUMN linked_influencer_id TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users         ADD COLUMN linked_agency_id TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users         ADD COLUMN linked_brand_id TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE portal_users  ADD COLUMN last_login_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
`;

  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('✅  is_demo columns ready');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  // Non-fatal: log and continue — server must start even if migration fails
  console.warn('⚠️  is_demo migration warning:', err.message);
});
