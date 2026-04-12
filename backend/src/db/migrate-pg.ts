/**
 * PostgreSQL schema migration runner.
 *
 * Usage (one-time, before first deploy):
 *   DATABASE_URL=postgresql://... npx ts-node src/db/migrate-pg.ts
 *
 * Or via npm script:
 *   DATABASE_URL=postgresql://... npm run db:migrate-pg
 *
 * This is idempotent — all DDL uses CREATE TABLE IF NOT EXISTS.
 * Safe to run again if the process is interrupted.
 */

import path from 'path';
import fs from 'fs';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌  DATABASE_URL is not set. Aborting.');
    process.exit(1);
  }

  console.log('🐘  Connecting to PostgreSQL…');
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  const sqlPath = path.join(__dirname, 'migrate-pg.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = await pool.connect();
  try {
    console.log('⚙️   Running migration…');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅  Migration complete.');

    // Verify table count
    const result = await client.query(`
      SELECT COUNT(*) AS table_count
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    `);
    console.log(`📊  Tables in public schema: ${result.rows[0].table_count}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌  Migration failed — rolled back.');
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
