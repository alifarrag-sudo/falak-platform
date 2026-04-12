import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';

const router = Router();

/** Returns true when demo records should be hidden (LIVE_VIEW_MODE or ?demo=false) */
function filterDemo(req: Request): boolean {
  return process.env.LIVE_VIEW_MODE === 'true' || req.query.demo === 'false';
}

// GET /api/campaigns
router.get('/', async (req: Request, res: Response) => {
  const demoClause = filterDemo(req) ? 'AND c.is_demo = 0' : '';
  const campaigns = await db.all(`
    SELECT c.*,
      COUNT(ci.id) as influencer_count,
      SUM(ci.rate) as total_cost
    FROM campaigns c
    LEFT JOIN campaign_influencers ci ON ci.campaign_id = c.id
    WHERE c.is_archived = 0 ${demoClause}
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `, []);
  return res.json(campaigns);
});

// GET /api/campaigns/export/csv — download all campaigns as CSV
router.get('/export/csv', async (_req: Request, res: Response) => {
  const rows = await db.all(`
    SELECT c.id, c.name, c.client_name, c.platform_focus, c.status,
           c.budget, c.currency, c.start_date, c.end_date, c.description,
           c.created_at,
           (SELECT COUNT(*) FROM campaign_influencers ci WHERE ci.campaign_id = c.id) AS influencer_count
    FROM campaigns c
    ORDER BY c.created_at DESC
  `, []) as Record<string, unknown>[];

  if (rows.length === 0) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="campaigns.csv"');
    return res.send('id,name\nNo data');
  }

  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
      }).join(',')
    ),
  ];

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="campaigns-${new Date().toISOString().slice(0, 10)}.csv"`);
  return res.send(csvLines.join('\n'));
});

// GET /api/campaigns/:id
router.get('/:id', async (req: Request, res: Response) => {
  const campaign = await db.get('SELECT * FROM campaigns WHERE id = ? AND is_archived = 0', [req.params.id]);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const influencers = await db.all(`
    SELECT ci.*, i.name_english, i.name_arabic, i.ig_handle, i.tiktok_handle,
           i.snap_handle, i.ig_followers, i.tiktok_followers, i.snap_followers,
           i.profile_photo_url, i.main_category, i.account_tier
    FROM campaign_influencers ci
    JOIN influencers i ON i.id = ci.influencer_id
    WHERE ci.campaign_id = ?
    ORDER BY ci.added_at ASC
  `, [req.params.id]);

  return res.json({ ...campaign as object, influencers });
});

// POST /api/campaigns
router.post('/', async (req: Request, res: Response) => {
  const id = uuidv4();
  const {
    name, client_name, start_date, end_date, budget,
    brief, platform_focus, status = 'draft'
  } = req.body as Record<string, string>;

  if (!name) return res.status(400).json({ error: 'Campaign name is required' });

  await db.run(`
    INSERT INTO campaigns (id, name, client_name, start_date, end_date, budget, brief, platform_focus, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, name, client_name, start_date, end_date, budget || null, brief, platform_focus, status]);

  return res.status(201).json(await db.get('SELECT * FROM campaigns WHERE id = ?', [id]));
});

// PUT /api/campaigns/:id
router.put('/:id', async (req: Request, res: Response) => {
  const existing = await db.get('SELECT * FROM campaigns WHERE id = ? AND is_archived = 0', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Campaign not found' });

  const allowed = ['name', 'client_name', 'start_date', 'end_date', 'budget', 'brief', 'platform_focus', 'status'];
  const updates = req.body as Record<string, unknown>;
  const fields = Object.keys(updates).filter(k => allowed.includes(k));
  if (fields.length === 0) return res.json(existing);

  const set = fields.map(f => `${f} = ?`).join(', ');
  const vals = fields.map(f => updates[f]);
  await db.run(`UPDATE campaigns SET ${set}, updated_at = NOW() WHERE id = ?`, [...vals, req.params.id]);

  return res.json(await db.get('SELECT * FROM campaigns WHERE id = ?', [req.params.id]));
});

// DELETE /api/campaigns/:id (soft)
router.delete('/:id', async (req: Request, res: Response) => {
  await db.run(`UPDATE campaigns SET is_archived = 1 WHERE id = ?`, [req.params.id]);
  return res.json({ success: true });
});

// POST /api/campaigns/:id/influencers - add influencer to campaign
router.post('/:id/influencers', async (req: Request, res: Response) => {
  const campaign = await db.get('SELECT * FROM campaigns WHERE id = ? AND is_archived = 0', [req.params.id]);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const { influencer_id, platform, num_posts = 1, rate, deliverables, notes } = req.body as Record<string, unknown>;
  if (!influencer_id) return res.status(400).json({ error: 'influencer_id required' });

  const id = uuidv4();
  await db.run(`
    INSERT INTO campaign_influencers (id, campaign_id, influencer_id, platform, num_posts, rate, deliverables, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, req.params.id, influencer_id, platform, num_posts, rate || null, deliverables, notes]);

  return res.status(201).json(await db.get('SELECT * FROM campaign_influencers WHERE id = ?', [id]));
});

// PUT /api/campaigns/:id/influencers/:ciId
router.put('/:id/influencers/:ciId', async (req: Request, res: Response) => {
  const allowed = ['platform', 'num_posts', 'rate', 'deliverables', 'notes', 'status'];
  const updates = req.body as Record<string, unknown>;
  const fields = Object.keys(updates).filter(k => allowed.includes(k));
  if (fields.length === 0) return res.json({});

  const set = fields.map(f => `${f} = ?`).join(', ');
  const vals = fields.map(f => updates[f]);
  await db.run(`UPDATE campaign_influencers SET ${set} WHERE id = ? AND campaign_id = ?`,
    [...vals, req.params.ciId, req.params.id]);

  return res.json(await db.get('SELECT * FROM campaign_influencers WHERE id = ?', [req.params.ciId]));
});

// DELETE /api/campaigns/:id/influencers/:ciId
router.delete('/:id/influencers/:ciId', async (req: Request, res: Response) => {
  await db.run('DELETE FROM campaign_influencers WHERE id = ? AND campaign_id = ?',
    [req.params.ciId, req.params.id]);
  return res.json({ success: true });
});

// GET /api/campaigns/:id/stats
router.get('/:id/stats', async (req: Request, res: Response) => {
  const campaignId = req.params.id;

  const campaign = await db.get('SELECT budget, currency FROM campaigns WHERE id = ? AND is_archived = 0', [campaignId]) as { budget: number | null; currency: string | null } | undefined;
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const influencerCountRow = await db.get('SELECT COUNT(*) as count FROM campaign_influencers WHERE campaign_id = ?', [campaignId]) as { count: number };
  const influencer_count = influencerCountRow.count;

  const spentRow = await db.get(`
    SELECT COALESCE(SUM(rate), 0) AS total_spent FROM portal_offers
    WHERE campaign_id = ? AND status IN ('accepted','in_progress','submitted','approved','completed')
  `, [campaignId]) as { total_spent: number };
  const total_spent = spentRow.total_spent;

  const offerStatusRows = await db.all('SELECT status, COUNT(*) as count FROM portal_offers WHERE campaign_id = ? GROUP BY status', [campaignId]) as { status: string; count: number }[];
  const offers_by_status: Record<string, number> = {};
  for (const row of offerStatusRows) {
    offers_by_status[row.status] = row.count;
  }

  const reachRow = await db.get(`
    SELECT COALESCE(SUM(i.ig_followers), 0) + COALESCE(SUM(i.tiktok_followers), 0) AS total_reach
    FROM campaign_influencers ci JOIN influencers i ON ci.influencer_id = i.id
    WHERE ci.campaign_id = ?
  `, [campaignId]) as { total_reach: number };
  const total_followers_reach = reachRow.total_reach;

  const deliverablesRow = await db.get(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN pd.status = 'approved' THEN 1 ELSE 0 END) as approved
    FROM portal_deliverables pd
    JOIN portal_offers po ON pd.offer_id = po.id
    WHERE po.campaign_id = ?
  `, [campaignId]) as { total: number; approved: number };

  return res.json({
    influencer_count,
    total_budget: campaign.budget || 0,
    total_spent,
    currency: campaign.currency || 'SAR',
    offers_by_status,
    total_followers_reach,
    deliverables_count: deliverablesRow.total,
    deliverables_approved: deliverablesRow.approved || 0,
  });
});

// GET /api/campaigns/:id/notes
router.get('/:id/notes', async (req: Request, res: Response) => {
  const notes = await db.all(`
    SELECT * FROM campaign_notes WHERE campaign_id = ? ORDER BY created_at ASC
  `, [req.params.id]);
  return res.json(notes);
});

// POST /api/campaigns/:id/notes
router.post('/:id/notes', async (req: Request, res: Response) => {
  const { author, content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'content is required' });
  const id = uuidv4();
  await db.run(`
    INSERT INTO campaign_notes (id, campaign_id, author, content) VALUES (?, ?, ?, ?)
  `, [id, req.params.id, author || 'Agency', content.trim()]);
  const note = await db.get('SELECT * FROM campaign_notes WHERE id = ?', [id]);
  return res.status(201).json(note);
});

// DELETE /api/campaigns/:campaignId/notes/:noteId
router.delete('/:campaignId/notes/:noteId', async (req: Request, res: Response) => {
  await db.run(`DELETE FROM campaign_notes WHERE id = ? AND campaign_id = ?`, [req.params.noteId, req.params.campaignId]);
  return res.json({ success: true });
});

// GET /api/campaigns/:id/timeline — chronological event feed
router.get('/:id/timeline', async (req: Request, res: Response) => {
  const cid = req.params.id;

  // Campaign creation event
  const campaign = await db.get(`SELECT name, created_at, start_date, end_date, status FROM campaigns WHERE id = ?`, [cid]) as Record<string, unknown> | undefined;
  if (!campaign) return res.status(404).json({ error: 'Not found' });

  const events: { type: string; label: string; sub: string; ts: string }[] = [];

  events.push({ type: 'campaign_created', label: 'Campaign created', sub: String(campaign.name), ts: String(campaign.created_at) });
  if (campaign.start_date) events.push({ type: 'campaign_start', label: 'Campaign start date', sub: String(campaign.start_date), ts: String(campaign.start_date) });
  if (campaign.end_date) events.push({ type: 'campaign_end', label: 'Campaign end date', sub: String(campaign.end_date), ts: String(campaign.end_date) });

  // Influencer added events
  const ciRows = await db.all(`
    SELECT ci.created_at, i.full_name, i.ig_handle
    FROM campaign_influencers ci
    LEFT JOIN influencers i ON i.id = ci.influencer_id
    WHERE ci.campaign_id = ?
  `, [cid]) as Record<string, unknown>[];

  for (const row of ciRows) {
    const name = String(row.full_name || row.ig_handle || 'Influencer');
    events.push({ type: 'influencer_added', label: `${name} added`, sub: '', ts: String(row.created_at) });
  }

  // Offer events
  const offerRows = await db.all(`
    SELECT o.created_at, o.status, o.updated_at, o.title,
           i.full_name, i.ig_handle
    FROM portal_offers o
    LEFT JOIN influencers i ON i.id = o.influencer_id
    WHERE o.campaign_id = ?
    ORDER BY o.created_at ASC
  `, [cid]) as Record<string, unknown>[];

  for (const o of offerRows) {
    const name = String(o.full_name || o.ig_handle || 'Influencer');
    const title = String(o.title || 'Offer');
    events.push({ type: 'offer_sent', label: `Offer sent to ${name}`, sub: title, ts: String(o.created_at) });
    if (o.status === 'accepted' || o.status === 'in_progress' || o.status === 'submitted' || o.status === 'completed') {
      events.push({ type: 'offer_accepted', label: `${name} accepted offer`, sub: title, ts: String(o.updated_at || o.created_at) });
    }
    if (o.status === 'declined') {
      events.push({ type: 'offer_declined', label: `${name} declined offer`, sub: title, ts: String(o.updated_at || o.created_at) });
    }
    if (o.status === 'completed') {
      events.push({ type: 'offer_completed', label: `${name} completed`, sub: title, ts: String(o.updated_at || o.created_at) });
    }
  }

  // Deliverable events
  const delivRows = await db.all(`
    SELECT d.created_at, d.status, d.updated_at, d.content_type,
           i.full_name, i.ig_handle
    FROM deliverables d
    LEFT JOIN influencers i ON i.id = d.influencer_id
    WHERE d.campaign_id = ?
    ORDER BY d.created_at ASC
  `, [cid]) as Record<string, unknown>[];

  for (const d of delivRows) {
    const name = String(d.full_name || d.ig_handle || 'Influencer');
    const ctype = String(d.content_type || 'deliverable');
    if (d.status === 'submitted' || d.status === 'approved' || d.status === 'revision_requested') {
      events.push({ type: 'deliverable_submitted', label: `${name} submitted ${ctype}`, sub: '', ts: String(d.updated_at || d.created_at) });
    }
    if (d.status === 'approved') {
      events.push({ type: 'deliverable_approved', label: `${ctype} approved`, sub: name, ts: String(d.updated_at || d.created_at) });
    }
    if (d.status === 'revision_requested') {
      events.push({ type: 'revision_requested', label: `Revision requested`, sub: `${name} · ${ctype}`, ts: String(d.updated_at || d.created_at) });
    }
  }

  // Notes
  const noteRows = await db.all(`SELECT created_at, author, content FROM campaign_notes WHERE campaign_id = ? ORDER BY created_at ASC`, [cid]) as Record<string, unknown>[];
  for (const n of noteRows) {
    events.push({ type: 'note_added', label: `Note by ${String(n.author || 'Team')}`, sub: String(n.content || '').slice(0, 60), ts: String(n.created_at) });
  }

  // Sort by timestamp
  events.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  return res.json(events);
});

export default router;
