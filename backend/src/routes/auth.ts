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
import { db } from '../db/connection';
import { requireAuth, signToken, AuthRequest } from '../middleware/auth';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../services/emailService';

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
    const validRoles = ['platform_admin', 'agency', 'brand', 'influencer', 'public', 'talent_manager', 'viewer'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    // Check duplicate email
    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
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
      await db.run(
        'INSERT INTO agencies (id, name, contact_email) VALUES (?, ?, ?)',
        [agencyId, agency_name, email.toLowerCase()]
      );
      linkedAgencyId = agencyId;
    }

    // If brand role, create brand record
    if (role === 'brand' && brand_name) {
      const brandId = uuidv4();
      await db.run(
        'INSERT INTO brands (id, name, contact_email) VALUES (?, ?, ?)',
        [brandId, brand_name, email.toLowerCase()]
      );
      linkedBrandId = brandId;
    }

    await db.run(
      `INSERT INTO users (id, email, password_hash, role, display_name, linked_agency_id, linked_brand_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, email.toLowerCase(), passwordHash, role, display_name || email.split('@')[0], linkedAgencyId, linkedBrandId]
    );

    const user = await db.get(
      'SELECT id, email, role, display_name, avatar_url, linked_influencer_id, linked_agency_id, linked_brand_id, status, created_at FROM users WHERE id = ?',
      [userId]
    ) as Record<string, unknown>;

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

    const user = await db.get('SELECT * FROM users WHERE email = ? AND status = ?', [email.toLowerCase(), 'active']) as Record<string, unknown> | undefined;

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
    await db.run(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [user.id]);

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
router.get('/users', requireAuth('platform_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, role, page = '1', limit = '50' } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = ["status != 'deleted'"];
    if (process.env.LIVE_VIEW_MODE === 'true' || req.query.demo === 'false') {
      conditions.push('is_demo = 0');
    }
    const params: unknown[] = [];

    if (search) {
      conditions.push("(email LIKE ? OR display_name LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }
    if (role && role !== 'all') {
      conditions.push("role = ?");
      params.push(role);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = await db.get(`SELECT COUNT(*) as count FROM users ${where}`, params) as Record<string, number>;
    const total = countRow.count;

    const users = await db.all(
      `SELECT id, email, role, display_name, status, created_at, last_login_at
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

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
    const validRoles = ['platform_admin', 'agency', 'brand', 'influencer', 'public', 'talent_manager', 'viewer'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    await db.run(
      `INSERT INTO users (id, email, password_hash, role, display_name) VALUES (?, ?, ?, ?, ?)`,
      [userId, email.toLowerCase(), passwordHash, role, display_name || email.split('@')[0]]
    );

    const user = await db.get(
      'SELECT id, email, role, display_name, status, created_at, last_login_at FROM users WHERE id = ?',
      [userId]
    );

    // Send welcome email (non-blocking)
    sendWelcomeEmail(email.toLowerCase(), display_name || email.split('@')[0], role).catch(() => {});

    res.status(201).json({ user });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// ── PUT /api/auth/users/:id ───────────────────────────────────────────────────
router.put('/users/:id', requireAuth('platform_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, role, display_name } = req.body as Record<string, string>;

    const user = await db.get("SELECT id FROM users WHERE id = ? AND status != 'deleted'", [id]) as Record<string, unknown> | undefined;

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const fields: string[] = [];
    const params: unknown[] = [];

    if (status !== undefined) {
      const validStatuses = ['active', 'suspended'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ error: 'Invalid status' });
        return;
      }
      fields.push('status = ?');
      params.push(status);
    }
    if (role !== undefined) {
      const validRoles = ['platform_admin', 'agency', 'brand', 'influencer', 'public', 'talent_manager', 'viewer'];
      if (!validRoles.includes(role)) {
        res.status(400).json({ error: 'Invalid role' });
        return;
      }
      fields.push('role = ?');
      params.push(role);
    }
    if (display_name !== undefined) {
      fields.push('display_name = ?');
      params.push(display_name);
    }

    if (fields.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    params.push(id);
    await db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);

    const updated = await db.get(
      'SELECT id, email, role, display_name, status, created_at, last_login_at FROM users WHERE id = ?',
      [id]
    );

    res.json({ user: updated });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ── DELETE /api/auth/users/:id ────────────────────────────────────────────────
router.delete('/users/:id', requireAuth('platform_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await db.get("SELECT id FROM users WHERE id = ? AND status != 'deleted'", [id]) as Record<string, unknown> | undefined;

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Prevent self-deletion
    if (req.user && req.user.id === id) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    await db.run("UPDATE users SET status = 'deleted' WHERE id = ?", [id]);
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

    const user = await db.get(
      "SELECT id, email, display_name FROM users WHERE email = ? AND status = 'active'",
      [email.toLowerCase()]
    ) as { id: string; email: string; display_name: string } | undefined;

    // Always respond OK to prevent email enumeration
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
      await db.run('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
        [token, expires, user.id]);
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

    const user = await db.get(
      "SELECT id, reset_token_expires FROM users WHERE reset_token = ? AND status = 'active'",
      [token]
    ) as { id: string; reset_token_expires: string } | undefined;

    if (!user) { res.status(400).json({ error: 'Invalid or expired reset token' }); return; }
    if (new Date(user.reset_token_expires) < new Date()) {
      res.status(400).json({ error: 'Reset token has expired. Please request a new one.' }); return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await db.run('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      [passwordHash, user.id]);

    res.json({ ok: true, message: 'Password updated successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
