/**
 * Creates two read-only viewer accounts for investor and partner access.
 * Run with: npm run seed:viewers
 *
 * Prints the plaintext passwords once — store them securely.
 * Viewer role can see: analytics, influencers, campaigns, revenue (read-only).
 * Viewer role cannot: create, edit, delete, access users/integrations/settings.
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { initializeDatabase } from '../db/schema';
import { db } from '../db/connection';

const ACCOUNTS = [
  {
    email:        'investor@falak.io',
    password:     'Xk9$mPqR!vNb3wLz',
    display_name: 'Investor Access',
    label:        'Investor',
  },
  {
    email:        'partner@falak.io',
    password:     'Jh7#nYtF@cWs5eKm',
    display_name: 'Partner Access',
    label:        'Partner',
  },
];

async function seedViewers() {
  initializeDatabase();

  console.log('\n── Viewer Accounts ─────────────────────────────────────────');
  console.log('┌────────────────────────────┬────────────────────┬────────────────────┐');
  console.log('│ Account                    │ Email              │ Password           │');
  console.log('├────────────────────────────┼────────────────────┼────────────────────┤');

  for (const account of ACCOUNTS) {
    const existing = await db.get('SELECT id, role FROM users WHERE email = ?', [account.email]) as { id: string; role: string } | undefined;

    if (existing) {
      // Update password and ensure role is viewer
      const hash = await bcrypt.hash(account.password, 10);
      await db.run(
        `UPDATE users SET password_hash = ?, role = 'viewer', display_name = ?, status = 'active' WHERE id = ?`,
        [hash, account.display_name, existing.id],
      );
      console.log(`│ ${account.label.padEnd(26)} │ ${account.email.padEnd(18)} │ ${account.password.padEnd(18)} │  (updated)`);
    } else {
      const id = uuidv4();
      const hash = await bcrypt.hash(account.password, 10);
      await db.run(
        `INSERT INTO users (id, email, password_hash, role, display_name, status) VALUES (?, ?, ?, 'viewer', ?, 'active')`,
        [id, account.email, hash, account.display_name],
      );
      console.log(`│ ${account.label.padEnd(26)} │ ${account.email.padEnd(18)} │ ${account.password.padEnd(18)} │  (created)`);
    }
  }

  console.log('└────────────────────────────┴────────────────────┴────────────────────┘');
  console.log('\n  ⚠  These passwords are shown ONCE. Store them securely now.');
  console.log('  Role: viewer — read-only access to analytics, influencers, campaigns, revenue.\n');
}

seedViewers()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1); });
