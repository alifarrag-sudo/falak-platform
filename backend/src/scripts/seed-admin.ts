/**
 * Seed script: creates the first platform_admin account.
 * Run with: npx ts-node src/scripts/seed-admin.ts
 * Or: npm run seed:admin
 *
 * Reads ADMIN_EMAIL and ADMIN_PASSWORD from .env (or uses defaults).
 * Safe to re-run — uses ON CONFLICT DO NOTHING so no duplicate is created.
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { initializeDatabase } from '../db/schema';
import { db } from '../db/connection';

const email       = (process.env.ADMIN_EMAIL    || 'admin@cp-nsm.com').toLowerCase();
const password    = process.env.ADMIN_PASSWORD  || 'Admin@NSM2024';
const displayName = process.env.ADMIN_NAME      || 'Platform Admin';

async function seed() {
  initializeDatabase();

  // Check if already exists
  const existing = await db.get('SELECT id, email FROM users WHERE email = ?', [email]);

  if (existing) {
    console.log(`✓ Admin account already exists: ${email}`);
    process.exit(0);
  }

  const id   = uuidv4();
  const hash = await bcrypt.hash(password, 10);

  await db.run(
    `INSERT INTO users (id, email, password_hash, role, display_name, status)
     VALUES (?, ?, ?, 'platform_admin', ?, 'active')
     ON CONFLICT (email) DO NOTHING`,
    [id, email, hash, displayName]
  );

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
