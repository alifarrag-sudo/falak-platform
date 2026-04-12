/**
 * Ad Network routes.
 * Manages custom audiences (Meta/TikTok Ads lookalike seeds) and fraud alerts.
 * Custom audiences are built from campaign influencer followers for retargeting.
 */
import { Router } from 'express';
import { createHash } from 'crypto';
import { requireAuth } from '../middleware/auth';
import { db } from '../db/connection';

const router = Router();

/** GET /api/adnetwork/status — configured ad platforms */
router.get('/status', requireAuth(), (_req, res) => {
  res.json({
    meta_configured: !!(process.env.META_AD_ACCOUNT_ID && process.env.META_ACCESS_TOKEN),
    tiktok_configured: !!(process.env.TIKTOK_AD_ACCOUNT_ID && process.env.TIKTOK_ACCESS_TOKEN),
    snapchat_configured: !!(process.env.SNAPCHAT_AD_ACCOUNT_ID && process.env.SNAPCHAT_ACCESS_TOKEN),
  });
});

// ── Custom Audiences ─────────────────────────────────────────────────────────

/** GET /api/adnetwork/audiences — list custom audiences */
router.get('/audiences', requireAuth('platform_admin', 'agency', 'brand'), async (req, res) => {
  const { campaign_id, platform } = req.query;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (campaign_id) {
    params.push(campaign_id);
    conditions.push(`campaign_id = ?`);
  }
  if (platform) {
    params.push(platform);
    conditions.push(`platform = ?`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await db.all(`
    SELECT ca.*,
      (SELECT COUNT(*) FROM audience_members am WHERE am.custom_audience_id = ca.id) as member_count
    FROM custom_audiences ca
    ${where}
    ORDER BY ca.created_at DESC
  `, params);

  res.json(rows);
});

/** POST /api/adnetwork/audiences — create a custom audience */
router.post('/audiences', requireAuth('platform_admin', 'agency'), async (req, res) => {
  const { campaign_id, agency_id, brand_id, audience_name, platform } = req.body;

  if (!audience_name || !platform) {
    return res.status(400).json({ error: 'audience_name and platform are required' });
  }

  const id = crypto.randomUUID();
  await db.run(`
    INSERT INTO custom_audiences (id, campaign_id, agency_id, brand_id, audience_name, platform, status)
    VALUES (?, ?, ?, ?, ?, ?, 'building')
  `, [id, campaign_id || null, agency_id || null, brand_id || null, audience_name, platform]);

  const row = await db.get('SELECT * FROM custom_audiences WHERE id = ?', [id]);
  res.status(201).json(row);
});

/** POST /api/adnetwork/audiences/:id/build — auto-populate from campaign influencers */
router.post('/audiences/:id/build', requireAuth('platform_admin', 'agency'), async (req, res) => {
  const { id } = req.params;

  const audience = await db.get('SELECT * FROM custom_audiences WHERE id = ?', [id]);
  if (!audience) return res.status(404).json({ error: 'Audience not found' });
  if (!audience.campaign_id) return res.status(400).json({ error: 'Audience has no linked campaign' });

  // Collect emails from influencers in the campaign
  const influencers = await db.all(`
    SELECT i.email, i.ig_handle, i.tiktok_handle
    FROM campaign_influencers ci
    JOIN influencers i ON i.id = ci.influencer_id
    WHERE ci.campaign_id = ? AND i.email IS NOT NULL
  `, [audience.campaign_id]) as Array<{ email: string; ig_handle: string; tiktok_handle: string }>;

  if (influencers.length === 0) {
    return res.status(400).json({ error: 'No influencers with email found in campaign' });
  }

  let added = 0;
  for (const inf of influencers) {
    const hashed = createHash('sha256').update(inf.email.toLowerCase().trim()).digest('hex');
    await db.run(`
      INSERT INTO audience_members (id, custom_audience_id, identifier_type, identifier_value, source)
      VALUES (?, ?, 'hashed_email', ?, 'campaign_influencer')
      ON CONFLICT DO NOTHING
    `, [crypto.randomUUID(), id, hashed]);
    added++;
  }

  // Update audience size + mark ready
  await db.run(`UPDATE custom_audiences SET audience_size = ?, status = 'ready', synced_at = NOW() WHERE id = ?`, [added, id]);

  res.json({ ok: true, members_added: added, audience_id: id });
});

/** PUT /api/adnetwork/audiences/:id — update audience */
router.put('/audiences/:id', requireAuth('platform_admin', 'agency'), async (req, res) => {
  const { status, match_rate, external_audience_id } = req.body;
  const fields: Record<string, unknown> = {};
  if (status !== undefined) fields.status = status;
  if (match_rate !== undefined) fields.match_rate = match_rate;
  if (external_audience_id !== undefined) fields.external_audience_id = external_audience_id;

  if (!Object.keys(fields).length) return res.status(400).json({ error: 'Nothing to update' });

  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  const vals = [...Object.values(fields), req.params.id];
  await db.run(`UPDATE custom_audiences SET ${sets} WHERE id = ?`, vals);

  const row = await db.get('SELECT * FROM custom_audiences WHERE id = ?', [req.params.id]);
  res.json(row);
});

/** DELETE /api/adnetwork/audiences/:id */
router.delete('/audiences/:id', requireAuth('platform_admin', 'agency'), async (req, res) => {
  await db.run('DELETE FROM audience_members WHERE custom_audience_id = ?', [req.params.id]);
  await db.run('DELETE FROM custom_audiences WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// ── Fraud Alerts ─────────────────────────────────────────────────────────────

/** GET /api/adnetwork/fraud-alerts — list fraud alerts */
router.get('/fraud-alerts', requireAuth('platform_admin', 'agency'), async (req, res) => {
  const { reviewed, severity } = req.query;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (reviewed === 'false') conditions.push('fa.reviewed_at IS NULL');
  if (reviewed === 'true')  conditions.push('fa.reviewed_at IS NOT NULL');
  if (severity) {
    params.push(severity);
    conditions.push(`fa.severity = ?`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await db.all(`
    SELECT fa.*, i.name_english, i.name_arabic, i.ig_handle
    FROM fraud_alerts fa
    LEFT JOIN influencers i ON i.id = fa.influencer_id
    ${where}
    ORDER BY fa.created_at DESC
    LIMIT 200
  `, params);

  res.json(rows);
});

/** POST /api/adnetwork/fraud-alerts — create a fraud alert */
router.post('/fraud-alerts', requireAuth('platform_admin', 'agency'), async (req, res) => {
  const { influencer_id, alert_type, severity = 'medium', details } = req.body;

  if (!influencer_id || !alert_type) {
    return res.status(400).json({ error: 'influencer_id and alert_type are required' });
  }

  const id = crypto.randomUUID();
  await db.run('INSERT INTO fraud_alerts (id, influencer_id, alert_type, severity, details) VALUES (?, ?, ?, ?, ?)',
    [id, influencer_id, alert_type, severity, details || null]);

  const row = await db.get('SELECT * FROM fraud_alerts WHERE id = ?', [id]);
  res.status(201).json(row);
});

/** PUT /api/adnetwork/fraud-alerts/:id — review/dismiss */
router.put('/fraud-alerts/:id', requireAuth('platform_admin'), async (req, res) => {
  const { action_taken } = req.body;

  await db.run(`UPDATE fraud_alerts SET reviewed_at = NOW(), action_taken = ? WHERE id = ?`,
    [action_taken || 'dismissed', req.params.id]);

  const row = await db.get('SELECT * FROM fraud_alerts WHERE id = ?', [req.params.id]);
  res.json(row);
});

/** POST /api/adnetwork/fraud-check/:influencerId — auto-detect potential fraud */
router.post('/fraud-check/:influencerId', requireAuth('platform_admin', 'agency'), async (req, res) => {
  const { influencerId } = req.params;

  const inf = await db.get(`
    SELECT id, ig_followers, ig_engagement_rate,
           tiktok_followers, tiktok_engagement_rate
    FROM influencers WHERE id = ?
  `, [influencerId]) as Record<string, unknown> | undefined;

  if (!inf) return res.status(404).json({ error: 'Influencer not found' });

  const alerts: Array<{ alert_type: string; severity: string; details: string }> = [];

  // Rule 1: Very high followers + very low engagement → bot activity
  const igFollowers = (inf.ig_followers as number) || 0;
  const igEng = (inf.ig_engagement_rate as number) || 0;
  if (igFollowers > 50_000 && igEng < 0.5) {
    alerts.push({ alert_type: 'low_engagement', severity: 'high', details: `IG followers ${igFollowers.toLocaleString()} but only ${igEng}% engagement — potential bot inflation.` });
  }

  // Rule 2: Engagement rate unrealistically high (>20%) — could be engagement pods
  if (igFollowers > 10_000 && igEng > 20) {
    alerts.push({ alert_type: 'engagement_pod', severity: 'medium', details: `Unusually high engagement (${igEng}%) — possible engagement pod activity.` });
  }

  // Rule 3: Check audience quality data
  const quality = await db.get('SELECT bot_score, suspicious_followers_pct FROM audience_quality WHERE influencer_id = ? ORDER BY updated_at DESC LIMIT 1', [influencerId]) as { bot_score: number; suspicious_followers_pct: number } | undefined;
  if (quality) {
    if (quality.bot_score > 30) {
      alerts.push({ alert_type: 'high_bot_score', severity: 'high', details: `Bot score ${quality.bot_score}% (threshold: 30%).` });
    }
    if (quality.suspicious_followers_pct > 20) {
      alerts.push({ alert_type: 'suspicious_followers', severity: 'medium', details: `${quality.suspicious_followers_pct}% suspicious followers detected.` });
    }
  }

  if (alerts.length === 0) {
    return res.json({ ok: true, alerts_created: 0, message: 'No fraud signals detected.' });
  }

  // Insert detected alerts
  for (const a of alerts) {
    await db.run('INSERT INTO fraud_alerts (id, influencer_id, alert_type, severity, details) VALUES (?, ?, ?, ?, ?)',
      [crypto.randomUUID(), influencerId, a.alert_type, a.severity, a.details]);
  }

  res.json({ ok: true, alerts_created: alerts.length, alerts });
});

export default router;
