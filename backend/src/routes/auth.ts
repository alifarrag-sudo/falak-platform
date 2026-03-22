/**
 * Unified authentication routes for all 6 roles.
 * POST /api/auth/register — create new account
 * POST /api/auth/login    — sign in, receive JWT
 * GET  /api/auth/me       — return current user from token
 */
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/schema';
import { requireAuth, signToken, AuthRequest } from '../middleware/auth';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../services/emailService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P = any;

const router = Router();

// ── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, role, display_name, agency_name, brand_name } = req.body as Record<string, string>;

    if (!email || !password || !role) {
      res.status(400).json({ error: 'email, password, and role are required' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }
    const validRoles = ['platform_admin', 'agency', 'brand', 'influencer', 'public', 'talent_manager'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    const db = getDb();

    // Check duplicate email
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase() as P);
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    let linkedAgencyId: string | null = null;
    let linkedBrandId: string | null = null;

    // If agency role, create agency record
    if (role === 'agency' && agency_name) {
      const agencyId = uuidv4();
      db.prepare(
        'INSERT INTO agencies (id, name, contact_email) VALUES (?, ?, ?)'
      ).run(agencyId as P, agency_name as P, email.toLowerCase() as P);
      linkedAgencyId = agencyId;
    }

    // If brand role, create brand record
    if (role === 'brand' && brand_name) {
      const brandId = uuidv4();
      db.prepare(
        'INSERT INTO brands (id, name, contact_email) VALUES (?, ?, ?)'
      ).run(brandId as P, brand_name as P, email.toLowerCase() as P);
      linkedBrandId = brandId;
    }

    db.prepare(
      `INSERT INTO users (id, email, password_hash, role, display_name, linked_agency_id, linked_brand_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userId as P,
      email.toLowerCase() as P,
      passwordHash as P,
      role as P,
      (display_name || email.split('@')[0]) as P,
      linkedAgencyId as P,
      linkedBrandId as P
    );

    const user = db.prepare(
      'SELECT id, email, role, display_name, avatar_url, linked_influencer_id, linked_agency_id, linked_brand_id, status, created_at FROM users WHERE id = ?'
    ).get(userId as P) as Record<string, unknown>;

    const token = signToken(userId);

    // Send welcome email (non-blocking)
    const finalName = display_name || email.split('@')[0];
    sendWelcomeEmail(email.toLowerCase(), finalName, role).catch(() => {});

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as Record<string, string>;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND status = ?')
      .get(email.toLowerCase() as P, 'active' as P) as Record<string, unknown> | undefined;

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash as string);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Update last login
    db.prepare('UPDATE users SET last_login_at = datetime(\'now\') WHERE id = ?')
      .run(user.id as P);

    // Return user without password hash
    const { password_hash: _, ...safeUser } = user;
    const token = signToken(user.id as string);
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', requireAuth(), (req: AuthRequest, res: Response): void => {
  res.json({ user: req.user });
});

// ── GET /api/auth/users ───────────────────────────────────────────────────────
router.get('/users', requireAuth('platform_admin'), (req: AuthRequest, res: Response): void => {
  try {
    const db = getDb();
    const { search, role, page = '1', limit = '50' } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = ["status != 'deleted'"];
    const params: P[] = [];

    if (search) {
      conditions.push("(email LIKE ? OR display_name LIKE ?)");
      params.push(`%${search}%` as P, `%${search}%` as P);
    }
    if (role && role !== 'all') {
      conditions.push("role = ?");
      params.push(role as P);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const total = (db.prepare(`SELECT COUNT(*) as count FROM users ${where}`)
      .get(...params as P[]) as Record<string, number>).count;

    const users = db.prepare(
      `SELECT id, email, role, display_name, status, created_at, last_login_at
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    ).all(...params as P[], limitNum as P, offset as P) as Record<string, unknown>[];

    res.json({ users, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// ── POST /api/auth/users ──────────────────────────────────────────────────────
router.post('/users', requireAuth('platform_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password, role, display_name } = req.body as Record<string, string>;

    if (!email || !password || !role) {
      res.status(400).json({ error: 'email, password, and role are required' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }
    const validRoles = ['platform_admin', 'agency', 'brand', 'influencer', 'public', 'talent_manager'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase() as P);
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    db.prepare(
      `INSERT INTO users (id, email, password_hash, role, display_name)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      userId as P,
      email.toLowerCase() as P,
      passwordHash as P,
      role as P,
      (display_name || email.split('@')[0]) as P
    );

    const user = db.prepare(
      'SELECT id, email, role, display_name, status, created_at, last_login_at FROM users WHERE id = ?'
    ).get(userId as P) as Record<string, unknown>;

    // Send welcome email (non-blocking)
    sendWelcomeEmail(email.toLowerCase(), display_name || email.split('@')[0], role).catch(() => {});

    res.status(201).json({ user });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// ── PUT /api/auth/users/:id ───────────────────────────────────────────────────
router.put('/users/:id', requireAuth('platform_admin'), (req: AuthRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const { status, role, display_name } = req.body as Record<string, string>;

    const db = getDb();
    const user = db.prepare("SELECT id FROM users WHERE id = ? AND status != 'deleted'")
      .get(id as P) as Record<string, unknown> | undefined;

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const fields: string[] = [];
    const params: P[] = [];

    if (status !== undefined) {
      const validStatuses = ['active', 'suspended'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ error: 'Invalid status' });
        return;
      }
      fields.push('status = ?');
      params.push(status as P);
    }
    if (role !== undefined) {
      const validRoles = ['platform_admin', 'agency', 'brand', 'influencer', 'public', 'talent_manager'];
      if (!validRoles.includes(role)) {
        res.status(400).json({ error: 'Invalid role' });
        return;
      }
      fields.push('role = ?');
      params.push(role as P);
    }
    if (display_name !== undefined) {
      fields.push('display_name = ?');
      params.push(display_name as P);
    }

    if (fields.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    params.push(id as P);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...params as P[]);

    const updated = db.prepare(
      'SELECT id, email, role, display_name, status, created_at, last_login_at FROM users WHERE id = ?'
    ).get(id as P) as Record<string, unknown>;

    res.json({ user: updated });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ── DELETE /api/auth/users/:id ────────────────────────────────────────────────
router.delete('/users/:id', requireAuth('platform_admin'), (req: AuthRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const db = getDb();

    const user = db.prepare("SELECT id FROM users WHERE id = ? AND status != 'deleted'")
      .get(id as P) as Record<string, unknown> | undefined;

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Prevent self-deletion
    if (req.user && req.user.id === id) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    db.prepare("UPDATE users SET status = 'deleted' WHERE id = ?").run(id as P);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body as { email: string };
    if (!email) { res.status(400).json({ error: 'Email required' }); return; }

    const db = getDb();

    // Add reset token columns if they don't exist yet
    try { db.exec('ALTER TABLE users ADD COLUMN reset_token TEXT'); } catch { /* exists */ }
    try { db.exec('ALTER TABLE users ADD COLUMN reset_token_expires TEXT'); } catch { /* exists */ }

    const user = db.prepare("SELECT id, email, display_name FROM users WHERE email = ? AND status = 'active'")
      .get(email.toLowerCase() as P) as { id: string; email: string; display_name: string } | undefined;

    // Always respond OK to prevent email enumeration
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
      db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?')
        .run(token as P, expires as P, user.id as P);
      sendPasswordResetEmail(user.email, user.display_name || user.email, token).catch(() => {});
    }

    res.json({ ok: true, message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// ── POST /api/auth/reset-password ────────────────────────────────────────────
router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body as { token: string; password: string };
    if (!token || !password) { res.status(400).json({ error: 'Token and new password are required' }); return; }
    if (password.length < 8) { res.status(400).json({ error: 'Password must be at least 8 characters' }); return; }

    const db = getDb();
    const user = db.prepare(
      "SELECT id, reset_token_expires FROM users WHERE reset_token = ? AND status = 'active'"
    ).get(token as P) as { id: string; reset_token_expires: string } | undefined;

    if (!user) { res.status(400).json({ error: 'Invalid or expired reset token' }); return; }
    if (new Date(user.reset_token_expires) < new Date()) {
      res.status(400).json({ error: 'Reset token has expired. Please request a new one.' }); return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?')
      .run(passwordHash as P, user.id as P);

    res.json({ ok: true, message: 'Password updated successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
