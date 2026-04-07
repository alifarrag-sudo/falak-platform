/**
 * Outreach management routes.
 * Handles shadow profile discovery, outreach logging, and pipeline tracking.
 * Shadow profiles = influencers discovered online but not yet on the platform.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getDb } from '../db/schema';

type P = any;

const router = Router();

// ── Shadow Profiles ──────────────────────────────────────────────────────────

/** GET /api/outreach/shadows — list shadow profiles with outreach counts */
router.get('/shadows', requireAuth('platform_admin', 'agency'), (req, res) => {
  const db = getDb();
  const { platform, status, search, page = '1', limit = '50' } = req.query;

  const conditions: string[] = [];
  const params: P[] = [];

  if (platform) { conditions.push('sp.platform = ?'); params.push(platform); }
  if (status)   { conditions.push('sp.claim_status = ?'); params.push(status); }
  if (search) {
    conditions.push('(sp.name LIKE ? OR sp.handle LIKE ? OR sp.email LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (Number(page) - 1) * Number(limit);

  const total = (db.prepare(`SELECT COUNT(*) as n FROM shadow_profiles sp ${where}`).get(...params) as { n: number }).n;

  const rows = db.prepare(`
    SELECT sp.*,
      (SELECT COUNT(*) FROM outreach_log ol WHERE ol.shadow_profile_id = sp.id) as outreach_count,
      (SELECT COUNT(*) FROM outreach_log ol WHERE ol.shadow_profile_id = sp.id AND ol.response IS NOT NULL) as response_count
    FROM shadow_profiles sp
    ${where}
    ORDER BY sp.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), offset) as Record<string, unknown>[];

  res.json({ profiles: rows, total, page: Number(page), limit: Number(limit) });
});

/** POST /api/outreach/shadows — create a shadow profile */
router.post('/shadows', requireAuth('platform_admin', 'agency'), (req, res) => {
  const db = getDb();
  const { name, handle, platform, follower_count, category, country, profile_url, email } = req.body;

  if (!handle || !platform) {
    return res.status(400).json({ error: 'handle and platform are required' });
  }

  const id = crypto.randomUUID();
  const claimToken = crypto.randomUUID();

  db.prepare(`
    INSERT INTO shadow_profiles (id, name, handle, platform, follower_count, category, country, profile_url, email, claim_token)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name || null, handle, platform, follower_count || 0, category || null, country || null, profile_url || null, email || null, claimToken);

  res.status(201).json(db.prepare('SELECT * FROM shadow_profiles WHERE id = ?').get(id));
});

/** PUT /api/outreach/shadows/:id — update a shadow profile */
router.put('/shadows/:id', requireAuth('platform_admin', 'agency'), (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const allowed: Record<string, unknown> = {};
  for (const key of ['name', 'handle', 'platform', 'follower_count', 'category', 'country', 'profile_url', 'email', 'claim_status']) {
    if (req.body[key] !== undefined) allowed[key] = req.body[key];
  }

  if (!Object.keys(allowed).length) return res.status(400).json({ error: 'No fields to update' });

  const sets = Object.keys(allowed).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE shadow_profiles SET ${sets} WHERE id = ?`).run(...(Object.values(allowed) as P[]), id);
  res.json(db.prepare('SELECT * FROM shadow_profiles WHERE id = ?').get(id));
});

/** DELETE /api/outreach/shadows/:id */
router.delete('/shadows/:id', requireAuth('platform_admin'), (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM outreach_log WHERE shadow_profile_id = ?').run(req.params.id);
  db.prepare('DELETE FROM shadow_profiles WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Outreach Log ─────────────────────────────────────────────────────────────

/** GET /api/outreach/log/:shadowId — history for a shadow profile */
router.get('/log/:shadowId', requireAuth('platform_admin', 'agency'), (req, res) => {
  const db = getDb();
  res.json(
    db.prepare('SELECT * FROM outreach_log WHERE shadow_profile_id = ? ORDER BY sent_at DESC')
      .all(req.params.shadowId)
  );
});

/** POST /api/outreach/log/:shadowId — log an outreach attempt */
router.post('/log/:shadowId', requireAuth('platform_admin', 'agency'), (req, res) => {
  const db = getDb();
  const { shadowId } = req.params;
  const { channel = 'email', message_sent } = req.body;

  const profile = db.prepare('SELECT id, contact_attempts FROM shadow_profiles WHERE id = ?')
    .get(shadowId) as { id: string; contact_attempts: number } | undefined;
  if (!profile) return res.status(404).json({ error: 'Shadow profile not found' });

  const id = crypto.randomUUID();
  db.prepare('INSERT INTO outreach_log (id, shadow_profile_id, channel, message_sent) VALUES (?, ?, ?, ?)')
    .run(id, shadowId, channel, message_sent || null);

  db.prepare(`UPDATE shadow_profiles SET contact_attempts = ?, last_contacted_at = datetime('now') WHERE id = ?`)
    .run(profile.contact_attempts + 1, shadowId);

  res.status(201).json(db.prepare('SELECT * FROM outreach_log WHERE id = ?').get(id));
});

/** PUT /api/outreach/log-entry/:logId — record a response */
router.put('/log-entry/:logId', requireAuth('platform_admin', 'agency'), (req, res) => {
  const db = getDb();
  const { response } = req.body;

  db.prepare(`UPDATE outreach_log SET response = ?, responded_at = datetime('now') WHERE id = ?`)
    .run(response || null, req.params.logId);

  // Auto-promote shadow profile to 'responded' status
  const entry = db.prepare('SELECT shadow_profile_id FROM outreach_log WHERE id = ?')
    .get(req.params.logId) as { shadow_profile_id: string } | undefined;
  if (entry && response) {
    db.prepare(`UPDATE shadow_profiles SET claim_status = 'responded' WHERE id = ? AND claim_status = 'unclaimed'`)
      .run(entry.shadow_profile_id);
  }

  res.json(db.prepare('SELECT * FROM outreach_log WHERE id = ?').get(req.params.logId));
});

// ── Stats ────────────────────────────────────────────────────────────────────

/** GET /api/outreach/stats — pipeline funnel */
router.get('/stats', requireAuth('platform_admin', 'agency'), (_req, res) => {
  const db = getDb();

  const byStatus = db.prepare(`
    SELECT claim_status, COUNT(*) as count FROM shadow_profiles GROUP BY claim_status
  `).all() as Array<{ claim_status: string; count: number }>;

  const contacted = (db.prepare(
    'SELECT COUNT(DISTINCT shadow_profile_id) as n FROM outreach_log'
  ).get() as { n: number }).n;

  const responded = (db.prepare(
    'SELECT COUNT(DISTINCT shadow_profile_id) as n FROM outreach_log WHERE response IS NOT NULL'
  ).get() as { n: number }).n;

  const byPlatform = db.prepare(
    'SELECT platform, COUNT(*) as count FROM shadow_profiles GROUP BY platform ORDER BY count DESC'
  ).all() as Array<{ platform: string; count: number }>;

  const byChannel = db.prepare(
    'SELECT channel, COUNT(*) as count FROM outreach_log GROUP BY channel ORDER BY count DESC'
  ).all() as Array<{ channel: string; count: number }>;

  const statusMap = Object.fromEntries(byStatus.map(r => [r.claim_status, r.count]));

  res.json({
    total_profiles: Object.values(statusMap).reduce((a, b) => a + b, 0),
    by_status: statusMap,
    contacted,
    responded,
    response_rate: contacted > 0 ? Math.round((responded / contacted) * 100) : 0,
    by_platform: byPlatform,
    by_channel: byChannel,
  });
});

export default router;
