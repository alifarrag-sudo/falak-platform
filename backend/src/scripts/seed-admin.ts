/**
 * Seed script: creates the first platform_admin account.
 * Run with: npx ts-node src/scripts/seed-admin.ts
 * Or: npm run seed:admin
 *
 * Reads ADMIN_EMAIL and ADMIN_PASSWORD from .env (or uses defaults).
 * Safe to re-run — uses INSERT OR IGNORE so no duplicate is created.
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { initializeDatabase, getDb } from '../db/schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P = any;

const email = (process.env.ADMIN_EMAIL || 'admin@cp-nsm.com').toLowerCase();
const password = process.env.ADMIN_PASSWORD || 'Admin@NSM2024';
const displayName = process.env.ADMIN_NAME || 'Platform Admin';

async function seed() {
  initializeDatabase();
  const db = getDb();

  // Check if already exists
  const existing = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email as P) as
    | Record<string, unknown>
    | undefined;

  if (existing) {
    console.log(`✓ Admin account already exists: ${email}`);
    process.exit(0);
  }

  const id = uuidv4();
  const hash = await bcrypt.hash(password, 10);

  db.prepare(
    `INSERT INTO users (id, email, password_hash, role, display_name, status)
     VALUES (?, ?, ?, 'platform_admin', ?, 'active')`
  ).run(id as P, email as P, hash as P, displayName as P);

  console.log('');
  console.log('✅ Platform Admin account created');
  console.log('──────────────────────────────────');
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   Role:     platform_admin`);
  console.log('──────────────────────────────────');
  console.log('Change the password after first login.\n');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
