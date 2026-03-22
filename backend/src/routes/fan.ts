/**
 * Fan Access API
 * - Fans can register/login, browse public influencer profiles, and submit requests
 * - Request types: shoutout, video_message, photo, meetup, live_chat, custom
 * - Influencers manage their fan requests via /api/portal/fan-requests
 */
import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../db/schema';

const router = Router();
type P = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const JWT_SECRET = process.env.JWT_SECRET || 'fan_secret_change_in_production';

/** Legacy SHA-256 hash — used only for migration check */
function legacyHash(pw: string) {
  return createHash('sha256').update(pw + 'fan_salt').digest('hex');
}

/** Verify password against stored hash (supports both bcrypt and legacy SHA-256) */
async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  if (stored.startsWith('$2')) {
    // bcrypt hash
    return bcrypt.compare(pw, stored);
  }
  // Legacy SHA-256 — constant-time compare via bcrypt.compare timing isn't critical here since
  // we'll upgrade immediately on success
  return stored === legacyHash(pw);
}

// ── Auth middleware ────────────────────────────────────────────────────────────
interface FanRequest extends Request {
  fanUser?: { id: string; email: string; name?: string };
}

function requireFanAuth(req: FanRequest, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { id: string; email: string; name?: string; type: string };
    if (payload.type !== 'fan') { res.status(401).json({ error: 'Unauthorized' }); return; }
    req.fanUser = { id: payload.id, email: payload.email, name: payload.name };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

const REQUEST_TYPES = ['shoutout', 'video_message', 'photo', 'meetup', 'live_chat', 'custom'];

// ── Fan Auth ──────────────────────────────────────────────────────────────────

// POST /api/fan/auth/register
router.post('/auth/register', async (req, res) => {
  const { email, password, name, username } = req.body;
  if (!email?.trim() || !password?.trim()) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const db = getDb();
  const existing = db.prepare('SELECT id FROM fan_users WHERE email = ?').get(email.trim().toLowerCase() as P);
  if (existing) return res.status(400).json({ error: 'Email already registered' });

  const id = uuidv4();
  const hash = await bcrypt.hash(String(password), 10);
  db.prepare(`
    INSERT INTO fan_users (id, email, password, name, username)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, email.trim().toLowerCase(), hash, name?.trim() || null, username?.trim() || null);

  const token = jwt.sign({ id, email: email.trim().toLowerCase(), name: name?.trim(), type: 'fan' }, JWT_SECRET, { expiresIn: '30d' });
  const user = db.prepare('SELECT id, email, name, username, created_at FROM fan_users WHERE id = ?').get(id as P);
  res.status(201).json({ token, user });
});

// POST /api/fan/auth/login
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email?.trim() || !password?.trim()) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const db = getDb();
  const user = db.prepare('SELECT * FROM fan_users WHERE email = ?').get(email.trim().toLowerCase() as P) as Record<string, unknown> | undefined;
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await verifyPassword(String(password), String(user.password));
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  // Upgrade legacy SHA-256 hash to bcrypt on first successful login
  if (!String(user.password).startsWith('$2')) {
    try {
      const newHash = await bcrypt.hash(String(password), 10);
      db.prepare('UPDATE fan_users SET password = ? WHERE id = ?').run(newHash, user.id as P);
    } catch { /* non-critical, will retry next login */ }
  }

  const token = jwt.sign({ id: user.id, email: user.email, name: user.name, type: 'fan' }, JWT_SECRET, { expiresIn: '30d' });
  const { password: _, ...safeUser } = user;
  res.json({ token, user: safeUser });
});

// GET /api/fan/auth/me
router.get('/auth/me', requireFanAuth, (req: FanRequest, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, email, name, username, bio, country, avatar_url, created_at FROM fan_users WHERE id = ?')
    .get(req.fanUser!.id as P);
  res.json(user);
});

// PUT /api/fan/auth/me — update fan profile
router.put('/auth/me', requireFanAuth, (req: FanRequest, res) => {
  const { name, username, bio, country } = req.body;
  const db = getDb();
  db.prepare(`UPDATE fan_users SET name = ?, username = ?, bio = ?, country = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(name || null, username || null, bio || null, country || null, req.fanUser!.id as P);
  const user = db.prepare('SELECT id, email, name, username, bio, country, avatar_url, created_at FROM fan_users WHERE id = ?')
    .get(req.fanUser!.id as P);
  res.json(user);
});

// ── Public Influencer Browse ───────────────────────────────────────────────────

// GET /api/fan/influencers — browse public influencer profiles
router.get('/influencers', (req, res) => {
  const db = getDb();
  const { search, platform, category, page = '1', limit = '20' } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let where = "WHERE i.fan_requests_enabled = 1 OR i.fan_requests_enabled IS NULL";
  const params: P[] = [];

  if (search) {
    where += ' AND (i.name LIKE ? OR i.handle LIKE ? OR i.bio LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q, q);
  }
  if (platform) { where += ' AND i.platform = ?'; params.push(platform); }
  if (category) { where += ' AND i.category = ?'; params.push(category); }

  const influencers = db.prepare(`
    SELECT i.id, i.name, i.handle, i.platform, i.category, i.bio,
           i.followers_count, i.engagement_rate, i.profile_image_url, i.city, i.country,
           i.fan_shoutout_price, i.fan_video_price, i.fan_photo_price,
           i.fan_meetup_price, i.fan_live_chat_price, i.fan_custom_price,
           (SELECT COUNT(*) FROM fan_requests fr WHERE fr.influencer_id = i.id AND fr.status = 'fulfilled') AS completed_requests
    FROM influencers i
    ${where}
    ORDER BY i.followers_count DESC NULLS LAST
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit) as P, offset as P);

  const total = (db.prepare(`SELECT COUNT(*) as n FROM influencers i ${where}`).get(...params) as { n: number }).n;
  res.json({ influencers, total, page: Number(page), limit: Number(limit) });
});

// GET /api/fan/influencers/:id — public influencer profile
router.get('/influencers/:id', (req, res) => {
  const db = getDb();
  const influencer = db.prepare(`
    SELECT i.id, i.name, i.handle, i.platform, i.category, i.bio,
           i.followers_count, i.following_count, i.engagement_rate,
           i.profile_image_url, i.city, i.country, i.profile_url,
           i.fan_shoutout_price, i.fan_video_price, i.fan_photo_price,
           i.fan_meetup_price, i.fan_live_chat_price, i.fan_custom_price,
           i.fan_response_time, i.fan_bio,
           (SELECT COUNT(*) FROM fan_requests fr WHERE fr.influencer_id = i.id AND fr.status = 'fulfilled') AS completed_requests,
           (SELECT AVG(CASE WHEN fr.status = 'fulfilled' THEN 1.0 WHEN fr.status = 'declined' THEN 0.0 END)
            FROM fan_requests fr WHERE fr.influencer_id = i.id) AS acceptance_rate
    FROM influencers i
    WHERE i.id = ?
  `).get(req.params.id as P);

  if (!influencer) return res.status(404).json({ error: 'Influencer not found' });
  res.json(influencer);
});

// ── Fan Requests ──────────────────────────────────────────────────────────────

// GET /api/fan/requests — fan's own requests
router.get('/requests', requireFanAuth, (req: FanRequest, res) => {
  const db = getDb();
  const requests = db.prepare(`
    SELECT fr.*, i.name AS influencer_name, i.handle AS influencer_handle, i.platform AS influencer_platform
    FROM fan_requests fr
    JOIN influencers i ON i.id = fr.influencer_id
    WHERE fr.fan_user_id = ?
    ORDER BY fr.submitted_at DESC
  `).all(req.fanUser!.id as P);
  res.json(requests);
});

// GET /api/fan/requests/:id — single request detail
router.get('/requests/:id', requireFanAuth, (req: FanRequest, res) => {
  const db = getDb();
  const request = db.prepare(`
    SELECT fr.*, i.name AS influencer_name, i.handle AS influencer_handle, i.platform AS influencer_platform
    FROM fan_requests fr
    JOIN influencers i ON i.id = fr.influencer_id
    WHERE fr.id = ? AND fr.fan_user_id = ?
  `).get(req.params.id as P, req.fanUser!.id as P);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  res.json(request);
});

// POST /api/fan/requests — submit a new fan request
router.post('/requests', requireFanAuth, (req: FanRequest, res) => {
  const { influencer_id, request_type, title, message, budget, currency, platform, deadline } = req.body;

  if (!influencer_id || !request_type || !title?.trim()) {
    return res.status(400).json({ error: 'influencer_id, request_type and title are required' });
  }
  if (!REQUEST_TYPES.includes(request_type)) {
    return res.status(400).json({ error: `request_type must be one of: ${REQUEST_TYPES.join(', ')}` });
  }

  const db = getDb();
  const influencer = db.prepare('SELECT id FROM influencers WHERE id = ?').get(influencer_id as P);
  if (!influencer) return res.status(404).json({ error: 'Influencer not found' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO fan_requests (id, fan_user_id, influencer_id, request_type, title, message, budget, currency, platform, deadline)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.fanUser!.id as P, influencer_id, request_type, title.trim(), message?.trim() || null,
    budget ? Number(budget) : null, currency || 'SAR', platform || null, deadline || null);

  const request = db.prepare('SELECT * FROM fan_requests WHERE id = ?').get(id as P);
  res.status(201).json(request);
});

// PUT /api/fan/requests/:id/cancel — fan cancels their request
router.put('/requests/:id/cancel', requireFanAuth, (req: FanRequest, res) => {
  const db = getDb();
  const request = db.prepare('SELECT * FROM fan_requests WHERE id = ? AND fan_user_id = ?')
    .get(req.params.id as P, req.fanUser!.id as P) as Record<string, unknown> | undefined;
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (!['pending', 'accepted'].includes(String(request.status))) {
    return res.status(400).json({ error: 'Cannot cancel a fulfilled or declined request' });
  }
  db.prepare(`UPDATE fan_requests SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).run(req.params.id as P);
  const updated = db.prepare('SELECT * FROM fan_requests WHERE id = ?').get(req.params.id as P);
  res.json(updated);
});

// GET /api/fan/request-types — available request type definitions
router.get('/request-types', (_req, res) => {
  res.json([
    { key: 'shoutout',       label: 'Social Shoutout',     icon: '📣', description: 'A shoutout mention on their social media feed or stories' },
    { key: 'video_message',  label: 'Video Message',        icon: '🎥', description: 'A personalized video message just for you' },
    { key: 'photo',          label: 'Photo / Selfie',       icon: '📸', description: 'A signed photo or a custom selfie sent digitally' },
    { key: 'meetup',         label: 'Meet & Greet',         icon: '🤝', description: 'An in-person meet up or event appearance' },
    { key: 'live_chat',      label: 'Live Video Call',      icon: '📹', description: 'A 1-on-1 live video call session' },
    { key: 'custom',         label: 'Custom Request',       icon: '✨', description: 'Anything else — describe your idea!' },
  ]);
});

export default router;
