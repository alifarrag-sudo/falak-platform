/**
 * Outreach management routes.
 * Handles shadow profile discovery, outreach logging, and pipeline tracking.
 * Shadow profiles = influencers discovered online but not yet on the platform.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { db } from '../db/connection';

const router = Router();

// ── Shadow Profiles ──────────────────────────────────────────────────────────

/** GET /api/outreach/shadows — list shadow profiles with outreach counts */
router.get('/shadows', requireAuth('platform_admin', 'agency'), async (req, res) => {
  const { platform, status, search, page = '1', limit = '50' } = req.query;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (platform) { conditions.push('sp.platform = ?'); params.push(platform); }
  if (status)   { conditions.push('sp.claim_status = ?'); params.push(status); }
  if (search) {
    conditions.push('(sp.name LIKE ? OR sp.handle LIKE ? OR sp.email LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (Number(page) - 1) * Number(limit);

  const countRow = await db.get(`SELECT COUNT(*) as n FROM shadow_profiles sp ${where}`, params) as { n: number };
  const total = countRow.n;

  const rows = await db.all(`
    SELECT sp.*,
      (SELECT COUNT(*) FROM outreach_log ol WHERE ol.shadow_profile_id = sp.id) as outreach_count,
      (SELECT COUNT(*) FROM outreach_log ol WHERE ol.shadow_profile_id = sp.id AND ol.response IS NOT NULL) as response_count
    FROM shadow_profiles sp
    ${where}
    ORDER BY sp.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, Number(limit), offset]) as Record<string, unknown>[];

  res.json({ profiles: rows, total, page: Number(page), limit: Number(limit) });
});

/** POST /api/outreach/shadows — create a shadow profile */
router.post('/shadows', requireAuth('platform_admin', 'agency'), async (req, res) => {
  const { name, handle, platform, follower_count, category, country, profile_url, email } = req.body;

  if (!handle || !platform) {
    return res.status(400).json({ error: 'handle and platform are required' });
  }

  const id = crypto.randomUUID();
  const claimToken = crypto.randomUUID();

  await db.run(`
    INSERT INTO shadow_profiles (id, name, handle, platform, follower_count, category, country, profile_url, email, claim_token)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, name || null, handle, platform, follower_count || 0, category || null, country || null, profile_url || null, email || null, claimToken]);

  res.status(201).json(await db.get('SELECT * FROM shadow_profiles WHERE id = ?', [id]));
});

/** PUT /api/outreach/shadows/:id — update a shadow profile */
router.put('/shadows/:id', requireAuth('platform_admin', 'agency'), async (req, res) => {
  const { id } = req.params;
  const allowed: Record<string, unknown> = {};
  for (const key of ['name', 'handle', 'platform', 'follower_count', 'category', 'country', 'profile_url', 'email', 'claim_status']) {
    if (req.body[key] !== undefined) allowed[key] = req.body[key];
  }

  if (!Object.keys(allowed).length) return res.status(400).json({ error: 'No fields to update' });

  const sets = Object.keys(allowed).map(k => `${k} = ?`).join(', ');
  await db.run(`UPDATE shadow_profiles SET ${sets} WHERE id = ?`, [...Object.values(allowed), id]);
  res.json(await db.get('SELECT * FROM shadow_profiles WHERE id = ?', [id]));
});

/** DELETE /api/outreach/shadows/:id */
router.delete('/shadows/:id', requireAuth('platform_admin'), async (req, res) => {
  await db.run('DELETE FROM outreach_log WHERE shadow_profile_id = ?', [req.params.id]);
  await db.run('DELETE FROM shadow_profiles WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// ── Outreach Log ─────────────────────────────────────────────────────────────

/** GET /api/outreach/log/:shadowId — history for a shadow profile */
router.get('/log/:shadowId', requireAuth('platform_admin', 'agency'), async (req, res) => {
  res.json(
    await db.all('SELECT * FROM outreach_log WHERE shadow_profile_id = ? ORDER BY sent_at DESC', [req.params.shadowId])
  );
});

/** POST /api/outreach/log/:shadowId — log an outreach attempt */
router.post('/log/:shadowId', requireAuth('platform_admin', 'agency'), async (req, res) => {
  const { shadowId } = req.params;
  const { channel = 'email', message_sent } = req.body;

  const profile = await db.get('SELECT id, contact_attempts FROM shadow_profiles WHERE id = ?', [shadowId]) as { id: string; contact_attempts: number } | undefined;
  if (!profile) return res.status(404).json({ error: 'Shadow profile not found' });

  const id = crypto.randomUUID();
  await db.run('INSERT INTO outreach_log (id, shadow_profile_id, channel, message_sent) VALUES (?, ?, ?, ?)', [id, shadowId, channel, message_sent || null]);

  await db.run(`UPDATE shadow_profiles SET contact_attempts = ?, last_contacted_at = NOW() WHERE id = ?`, [profile.contact_attempts + 1, shadowId]);

  res.status(201).json(await db.get('SELECT * FROM outreach_log WHERE id = ?', [id]));
});

/** PUT /api/outreach/log-entry/:logId — record a response */
router.put('/log-entry/:logId', requireAuth('platform_admin', 'agency'), async (req, res) => {
  const { response } = req.body;

  await db.run(`UPDATE outreach_log SET response = ?, responded_at = NOW() WHERE id = ?`, [response || null, req.params.logId]);

  // Auto-promote shadow profile to 'responded' status
  const entry = await db.get('SELECT shadow_profile_id FROM outreach_log WHERE id = ?', [req.params.logId]) as { shadow_profile_id: string } | undefined;
  if (entry && response) {
    await db.run(`UPDATE shadow_profiles SET claim_status = 'responded' WHERE id = ? AND claim_status = 'unclaimed'`, [entry.shadow_profile_id]);
  }

  res.json(await db.get('SELECT * FROM outreach_log WHERE id = ?', [req.params.logId]));
});

// ── Stats ────────────────────────────────────────────────────────────────────

/** GET /api/outreach/stats — pipeline funnel */
router.get('/stats', requireAuth('platform_admin', 'agency'), async (_req, res) => {
  const byStatus = await db.all(`
    SELECT claim_status, COUNT(*) as count FROM shadow_profiles GROUP BY claim_status
  `, []) as Array<{ claim_status: string; count: number }>;

  const contactedRow = await db.get('SELECT COUNT(DISTINCT shadow_profile_id) as n FROM outreach_log', []) as { n: number };
  const contacted = contactedRow.n;

  const respondedRow = await db.get('SELECT COUNT(DISTINCT shadow_profile_id) as n FROM outreach_log WHERE response IS NOT NULL', []) as { n: number };
  const responded = respondedRow.n;

  const byPlatform = await db.all('SELECT platform, COUNT(*) as count FROM shadow_profiles GROUP BY platform ORDER BY count DESC', []) as Array<{ platform: string; count: number }>;

  const byChannel = await db.all('SELECT channel, COUNT(*) as count FROM outreach_log GROUP BY channel ORDER BY count DESC', []) as Array<{ channel: string; count: number }>;

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
