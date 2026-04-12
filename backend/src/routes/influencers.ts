import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import liveEmitter from '../events/liveEmitter';

const router = Router();

/** Returns true when demo records should be hidden (LIVE_VIEW_MODE or ?demo=false) */
function filterDemo(req: Request): boolean {
  return process.env.LIVE_VIEW_MODE === 'true' || req.query.demo === 'false';
}

// GET /api/influencers - list with search, filter, sort, pagination
router.get('/', async (req: Request, res: Response) => {
  const {
    search, category, platform, tier, country, city, nationality,
    mawthouq, hasPhone, supplierSource, tags,
    minFollowers, maxFollowers, minRate, maxRate,
    enrichment_status,
    sortBy = 'created_at', sortDir = 'desc',
    page = '1', limit = '50'
  } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  const whereClauses: string[] = ['i.is_archived = 0'];
  if (filterDemo(req)) whereClauses.push('i.is_demo = 0');
  const params: unknown[] = [];

  // Full-text search (includes Arabic)
  if (search) {
    const isPostgres = !!process.env.DATABASE_URL;
    if (isPostgres) {
      whereClauses.push(`i.search_vector @@ plainto_tsquery('simple', ?)`);
      params.push(search.trim());
    } else {
      whereClauses.push(`i.id IN (
        SELECT id FROM influencers_fts WHERE influencers_fts MATCH ?
      )`);
      params.push(search.replace(/['"*]/g, '') + '*');
    }
  }

  if (category) {
    whereClauses.push(`(i.main_category LIKE ? OR i.sub_category_1 LIKE ? OR i.sub_category_2 LIKE ?)`);
    params.push(`%${category}%`, `%${category}%`, `%${category}%`);
  }

  if (platform) {
    const platformMap: Record<string, string[]> = {
      instagram: ['ig_handle IS NOT NULL', "ig_handle != ''"],
      tiktok: ['tiktok_handle IS NOT NULL', "tiktok_handle != ''"],
      snapchat: ['snap_handle IS NOT NULL', "snap_handle != ''"],
      facebook: ['fb_handle IS NOT NULL', "fb_handle != ''"],
    };
    if (platformMap[platform.toLowerCase()]) {
      whereClauses.push(`(${platformMap[platform.toLowerCase()].join(' AND ')})`);
    }
  }

  if (tier) {
    whereClauses.push(`i.account_tier = ?`);
    params.push(tier);
  }

  if (country) {
    whereClauses.push(`i.country LIKE ?`);
    params.push(`%${country}%`);
  }

  if (city) {
    whereClauses.push(`i.city LIKE ?`);
    params.push(`%${city}%`);
  }

  if (nationality) {
    whereClauses.push(`i.nationality LIKE ?`);
    params.push(`%${nationality}%`);
  }

  if (mawthouq === 'true') {
    whereClauses.push(`i.mawthouq_certificate = 1`);
  }

  if (hasPhone === 'true') {
    whereClauses.push(`i.phone_number IS NOT NULL AND i.phone_number != ''`);
  }

  if (supplierSource) {
    whereClauses.push(`i.supplier_source = ?`);
    params.push(supplierSource);
  }

  if (tags) {
    whereClauses.push(`i.tags LIKE ?`);
    params.push(`%${tags}%`);
  }

  if (enrichment_status) {
    whereClauses.push(`i.enrichment_status = ?`);
    params.push(enrichment_status);
  }

  if (minFollowers) {
    whereClauses.push(`(i.ig_followers >= ? OR i.tiktok_followers >= ? OR i.snap_followers >= ?)`);
    params.push(minFollowers, minFollowers, minFollowers);
  }

  if (maxFollowers) {
    whereClauses.push(`(
      (i.ig_followers IS NULL OR i.ig_followers <= ?) AND
      (i.tiktok_followers IS NULL OR i.tiktok_followers <= ?) AND
      (i.snap_followers IS NULL OR i.snap_followers <= ?)
    )`);
    params.push(maxFollowers, maxFollowers, maxFollowers);
  }

  if (minRate) {
    whereClauses.push(`(
      i.ig_rate >= ? OR i.tiktok_rate >= ? OR
      i.snapchat_rate >= ? OR i.package_rate >= ?
    )`);
    params.push(minRate, minRate, minRate, minRate);
  }

  if (maxRate) {
    whereClauses.push(`(
      (i.ig_rate IS NULL OR i.ig_rate <= ?) AND
      (i.tiktok_rate IS NULL OR i.tiktok_rate <= ?) AND
      (i.snapchat_rate IS NULL OR i.snapchat_rate <= ?) AND
      (i.package_rate IS NULL OR i.package_rate <= ?)
    )`);
    params.push(maxRate, maxRate, maxRate, maxRate);
  }

  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const validSortFields: Record<string, string> = {
    name: 'COALESCE(i.name_english, i.name_arabic)',
    followers: 'COALESCE(i.ig_followers, i.tiktok_followers, i.snap_followers, 0)',
    rate: 'COALESCE(i.ig_rate, i.tiktok_rate, i.package_rate, 0)',
    created_at: 'i.created_at',
    updated_at: 'i.updated_at',
    ig_followers: 'i.ig_followers',
    tiktok_followers: 'i.tiktok_followers',
    trust_score: 'COALESCE(i.trust_score, 0)',
    engagement: 'COALESCE(i.ig_engagement_rate, i.tiktok_engagement_rate, 0)',
  };

  const orderBy = validSortFields[sortBy] || 'i.created_at';
  const dir = sortDir === 'asc' ? 'ASC' : 'DESC';

  const countRow = await db.get(`SELECT COUNT(*) as total FROM influencers i ${where}`, params) as { total: number };
  const total = countRow.total;

  const rows = await db.all(`
    SELECT i.* FROM influencers i
    ${where}
    ORDER BY ${orderBy} ${dir}
    LIMIT ? OFFSET ?
  `, [...params, limitNum, offset]);

  res.json({
    data: rows,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  });
});

// GET /api/influencers/export/csv — download all influencers as CSV
router.get('/export/csv', async (_req: Request, res: Response) => {
  const rows = await db.all(`
    SELECT id, name_english, name_arabic, ig_handle, tiktok_handle, snap_handle,
           ig_followers, tiktok_followers, snap_followers,
           main_category, account_tier, nationality, country, city,
           ig_rate, tiktok_rate, snapchat_rate, package_rate,
           email, phone_number, supplier_source, enrichment_status,
           created_at, updated_at
    FROM influencers WHERE is_archived = 0
    ORDER BY created_at DESC
  `, []) as Record<string, unknown>[];

  if (rows.length === 0) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="influencers.csv"');
    return res.send('id,name_english\nNo data');
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
  res.setHeader('Content-Disposition', `attachment; filename="influencers-${new Date().toISOString().slice(0, 10)}.csv"`);
  return res.send(csvLines.join('\n'));
});

// GET /api/influencers/public — paginated public creator directory (no auth required)
router.get('/public', async (req: Request, res: Response) => {
  const { search, category, platform, page = '1', limit = '24' } = req.query;
  const conditions: string[] = ['is_archived = 0'];
  const params: unknown[] = [];

  if (search) {
    conditions.push(`(name_english LIKE ? OR ig_handle LIKE ? OR tiktok_handle LIKE ?)`);
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  if (category) { conditions.push('main_category = ?'); params.push(category); }
  if (platform === 'instagram') conditions.push('ig_handle IS NOT NULL');
  if (platform === 'tiktok')    conditions.push('tiktok_handle IS NOT NULL');
  if (platform === 'youtube')   conditions.push('youtube_handle IS NOT NULL');

  const where = 'WHERE ' + conditions.join(' AND ');
  const offset = (parseInt(String(page)) - 1) * parseInt(String(limit));

  const totalRow = await db.get(`SELECT COUNT(*) as n FROM influencers ${where}`, params) as { n: number };
  const rows = await db.all(`
    SELECT id, name_english, name_arabic, ig_handle, tiktok_handle, snap_handle,
           ig_followers, tiktok_followers, snap_followers,
           profile_photo_url, main_category, account_tier,
           nationality, country, mawthouq_certificate,
           ig_url, tiktok_url
    FROM influencers ${where}
    ORDER BY ig_followers DESC NULLS LAST
    LIMIT ? OFFSET ?
  `, [...params, parseInt(String(limit)), offset]);

  res.json({ data: rows, total: totalRow.n, page: parseInt(String(page)), limit: parseInt(String(limit)) });
});

// GET /api/influencers/:id/public — public-safe profile (no contact/rates/notes)
router.get('/:id/public', async (req: Request, res: Response) => {
  const row = await db.get('SELECT * FROM influencers WHERE id = ? AND is_archived = 0', [req.params.id]) as Record<string, unknown> | undefined;
  if (!row) return res.status(404).json({ error: 'Influencer not found' });

  // Strip private fields
  const PRIVATE = ['phone_number','way_of_contact','email','national_id','address',
    'internal_notes','supplier_source','ig_rate','tiktok_rate','snapchat_rate',
    'facebook_rate','package_rate','rate_per_deliverable','last_known_rate_date',
    'is_archived','serial'];
  const pub: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!PRIVATE.includes(k)) pub[k] = v;
  }

  // Latest platform_stats per platform
  const stats = await db.all(`
    SELECT DISTINCT platform,
      first_value(follower_count) OVER w AS follower_count,
      first_value(avg_engagement_rate) OVER w AS avg_engagement_rate,
      first_value(avg_views) OVER w AS avg_views,
      first_value(avg_likes) OVER w AS avg_likes,
      first_value(data_source) OVER w AS data_source,
      first_value(captured_at) OVER w AS captured_at
    FROM platform_stats
    WHERE influencer_id = ?
    WINDOW w AS (PARTITION BY platform ORDER BY captured_at DESC)
  `, [req.params.id]);

  // Top posts
  const posts = await db.all(`
    SELECT id, platform, post_url, thumbnail_url, caption, media_type,
           likes, comments, views, shares, posted_at, is_pinned
    FROM influencer_posts
    WHERE influencer_id = ?
    ORDER BY is_pinned DESC, (likes + comments + views) DESC
    LIMIT 12
  `, [req.params.id]);

  return res.json({ ...pub, platform_stats: stats, top_posts: posts });
});

// GET /api/influencers/:id/posts — top/recent posts
router.get('/:id/posts', async (req: Request, res: Response) => {
  const { platform, limit = '12' } = req.query as Record<string, string>;
  let query = `
    SELECT id, platform, post_url, thumbnail_url, caption, media_type,
           likes, comments, views, shares, posted_at, is_pinned, source
    FROM influencer_posts WHERE influencer_id = ?
  `;
  const params: unknown[] = [req.params.id];
  if (platform) { query += ' AND platform = ?'; params.push(platform); }
  query += ' ORDER BY is_pinned DESC, (likes + comments + views) DESC LIMIT ?';
  params.push(Math.min(24, parseInt(limit)));
  const posts = await db.all(query, params);
  return res.json({ posts });
});

// GET /api/influencers/:id/performance — compute performance score from offer history
router.get('/:id/performance', async (req: Request, res: Response) => {
  const offers = await db.all(`
    SELECT status FROM portal_offers WHERE influencer_id = ?
  `, [req.params.id]) as { status: string }[];

  const deliverables = await db.all(`
    SELECT d.status FROM portal_deliverables d
    JOIN portal_offers o ON d.offer_id = o.id
    WHERE o.influencer_id = ?
  `, [req.params.id]) as { status: string }[];

  const total = offers.length;
  const accepted  = offers.filter(o => ['accepted','in_progress','submitted','approved','completed'].includes(o.status)).length;
  const completed = offers.filter(o => ['approved','completed'].includes(o.status)).length;
  const declined  = offers.filter(o => o.status === 'declined').length;
  const totalDeliverables = deliverables.length;
  const approvedDeliverables = deliverables.filter(d => d.status === 'approved').length;

  const responseRate    = total > 0 ? Math.round((accepted / total) * 100) : null;
  const completionRate  = accepted > 0 ? Math.round((completed / accepted) * 100) : null;
  const deliverableRate = totalDeliverables > 0 ? Math.round((approvedDeliverables / totalDeliverables) * 100) : null;

  // Score: weighted average (response 30%, completion 40%, deliverable 30%)
  let score: number | null = null;
  if (responseRate !== null && completionRate !== null) {
    const r = responseRate / 100;
    const c = completionRate / 100;
    const d = deliverableRate !== null ? deliverableRate / 100 : c;
    score = Math.round((r * 30 + c * 40 + d * 30));
  }

  res.json({
    total_offers: total,
    accepted_offers: accepted,
    completed_offers: completed,
    declined_offers: declined,
    response_rate: responseRate,
    completion_rate: completionRate,
    deliverable_approval_rate: deliverableRate,
    score,
  });
});

// GET /api/influencers/duplicates — find likely duplicates (same ig_handle or tiktok_handle)
router.get('/duplicates', async (_req: Request, res: Response) => {
  const byIg = await db.all(`
    SELECT ig_handle, COUNT(*) as cnt, string_agg(id, ',') as ids
    FROM influencers
    WHERE is_archived = 0 AND ig_handle IS NOT NULL AND ig_handle != ''
    GROUP BY LOWER(TRIM(ig_handle))
    HAVING COUNT(*) > 1
  `, []) as { ig_handle: string; cnt: number; ids: string }[];

  const byTiktok = await db.all(`
    SELECT tiktok_handle, COUNT(*) as cnt, string_agg(id, ',') as ids
    FROM influencers
    WHERE is_archived = 0 AND tiktok_handle IS NOT NULL AND tiktok_handle != ''
    GROUP BY LOWER(TRIM(tiktok_handle))
    HAVING COUNT(*) > 1
  `, []) as { tiktok_handle: string; cnt: number; ids: string }[];

  const seen = new Set<string>();
  const groups: { reason: string; ids: string[] }[] = [];

  for (const row of byIg) {
    const key = row.ids;
    if (!seen.has(key)) { seen.add(key); groups.push({ reason: `Same IG handle: @${row.ig_handle}`, ids: row.ids.split(',') }); }
  }
  for (const row of byTiktok) {
    const key = row.ids;
    if (!seen.has(key)) { seen.add(key); groups.push({ reason: `Same TikTok handle: @${row.tiktok_handle}`, ids: row.ids.split(',') }); }
  }

  const result = await Promise.all(groups.map(async g => ({
    reason: g.reason,
    influencers: (await Promise.all(g.ids.map(id =>
      db.get(`SELECT id, name_english, name_arabic, ig_handle, tiktok_handle, ig_followers, tiktok_followers, created_at FROM influencers WHERE id = ?`, [id])
    ))).filter(Boolean),
  })));

  res.json(result);
});

// GET /api/influencers/:id
router.get('/:id', async (req: Request, res: Response) => {
  const row = await db.get('SELECT * FROM influencers WHERE id = ? AND is_archived = 0', [req.params.id]) as Record<string, unknown> | undefined;
  if (!row) return res.status(404).json({ error: 'Influencer not found' });

  // Augment with latest platform_stats and trust_score
  const latestStats = await db.all(`
    SELECT platform, follower_count, avg_engagement_rate, avg_views, data_source, captured_at
    FROM platform_stats WHERE influencer_id = ?
    GROUP BY platform HAVING captured_at = MAX(captured_at)
  `, [req.params.id]);

  return res.json({ ...row, platform_stats: latestStats });
});

// POST /api/influencers
router.post('/', async (req: Request, res: Response) => {
  const id = uuidv4();
  const data = { ...req.body, id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };

  const fields = Object.keys(data).filter(k => data[k] !== null && data[k] !== undefined);
  const placeholders = fields.map(() => '?').join(', ');
  const values = fields.map((f: string) => data[f]);

  await db.run(`INSERT INTO influencers (${fields.join(', ')}) VALUES (${placeholders})`, values);
  const created = await db.get('SELECT * FROM influencers WHERE id = ?', [id]) as Record<string, unknown>;

  // Broadcast to live SSE clients
  liveEmitter.emit('event', {
    type: 'new_influencer',
    data: { id: created?.id, name: created?.name_english || created?.name_arabic, country: created?.country },
    ts: new Date().toISOString(),
  });

  return res.status(201).json(created);
});

// PUT /api/influencers/:id
router.put('/:id', async (req: Request, res: Response) => {
  const existing = await db.get('SELECT * FROM influencers WHERE id = ? AND is_archived = 0', [req.params.id]) as Record<string, unknown> | undefined;
  if (!existing) return res.status(404).json({ error: 'Influencer not found' });

  const updates = req.body as Record<string, unknown>;
  const logEntries: Array<{ field: string; old: unknown; new: unknown }> = [];

  // Log changes
  for (const [key, newVal] of Object.entries(updates)) {
    if (existing[key] !== newVal) {
      logEntries.push({ field: key, old: existing[key], new: newVal });
    }
  }

  const fields = Object.keys(updates).filter(k => !['id', 'created_at'].includes(k));
  if (fields.length === 0) return res.json(existing);

  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map((f: string) => updates[f]);

  await db.run(`UPDATE influencers SET ${setClause}, updated_at = NOW() WHERE id = ?`,
    [...values, req.params.id]);

  // Write edit log
  for (const entry of logEntries) {
    await db.run(`
      INSERT INTO edit_log (id, influencer_id, field_name, old_value, new_value, edited_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [uuidv4(), req.params.id, entry.field, String(entry.old ?? ''), String(entry.new ?? ''), 'admin']);
  }

  const updated = await db.get('SELECT * FROM influencers WHERE id = ?', [req.params.id]);
  return res.json(updated);
});

// DELETE /api/influencers/:id (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
  await db.run(`UPDATE influencers SET is_archived = 1, updated_at = NOW() WHERE id = ?`, [req.params.id]);
  return res.json({ success: true });
});

// GET /api/influencers/meta/filters - get unique values for filters
router.get('/meta/filters', async (_req: Request, res: Response) => {
  const categories = await db.all(`
    SELECT DISTINCT main_category FROM influencers
    WHERE main_category IS NOT NULL AND is_archived = 0
    ORDER BY main_category
  `, []) as { main_category: string }[];

  const countries = await db.all(`
    SELECT DISTINCT country FROM influencers
    WHERE country IS NOT NULL AND is_archived = 0
    ORDER BY country
  `, []) as { country: string }[];

  const sources = await db.all(`
    SELECT DISTINCT supplier_source FROM influencers
    WHERE supplier_source IS NOT NULL AND is_archived = 0
    ORDER BY supplier_source
  `, []) as { supplier_source: string }[];

  const tiers = await db.all(`
    SELECT DISTINCT account_tier FROM influencers
    WHERE account_tier IS NOT NULL AND is_archived = 0
    ORDER BY account_tier
  `, []) as { account_tier: string }[];

  const stats = await db.get(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN mawthouq_certificate = 1 THEN 1 ELSE 0 END) as mawthouq_count,
      MAX(COALESCE(ig_followers, tiktok_followers, snap_followers, 0)) as max_followers,
      MAX(COALESCE(ig_rate, tiktok_rate, package_rate, 0)) as max_rate
    FROM influencers WHERE is_archived = 0
  `, []) as Record<string, number>;

  return res.json({
    categories: categories.map(r => r.main_category),
    countries: countries.map(r => r.country),
    sources: sources.map(r => r.supplier_source),
    tiers: tiers.map(r => r.account_tier),
    stats
  });
});

// GET /api/influencers/:id/history - edit history
router.get('/:id/history', async (req: Request, res: Response) => {
  const rows = await db.all(`
    SELECT * FROM edit_log WHERE influencer_id = ? ORDER BY edited_at DESC LIMIT 100
  `, [req.params.id]);
  return res.json(rows);
});

// POST /api/influencers/:id/invite — generate a portal invite link for this influencer
router.post('/:id/invite', async (req: Request, res: Response) => {
  const inf = await db.get('SELECT id, name_english, name_arabic, email FROM influencers WHERE id = ? AND is_archived = 0', [req.params.id]) as Record<string, unknown> | undefined;
  if (!inf) return res.status(404).json({ error: 'Influencer not found' });

  // Generate a unique 32-char token
  const token = uuidv4().replace(/-/g, '');
  await db.run(`UPDATE influencers SET invite_token = ? WHERE id = ?`, [token, req.params.id]);

  // The invite URL points to the portal register page with the token
  const baseUrl = req.headers.origin || `${req.protocol}://${req.headers.host}`;
  const inviteUrl = `${baseUrl}/portal/register?invite=${token}`;

  res.json({ token, invite_url: inviteUrl, influencer: inf });
});

// POST /api/influencers/merge — merge duplicates into one primary record
router.post('/merge', async (req: Request, res: Response) => {
  const { primary_id, duplicate_ids } = req.body as { primary_id: string; duplicate_ids: string[] };
  if (!primary_id || !Array.isArray(duplicate_ids) || duplicate_ids.length === 0) {
    return res.status(400).json({ error: 'primary_id and duplicate_ids are required' });
  }

  const primary = await db.get('SELECT * FROM influencers WHERE id = ?', [primary_id]) as Record<string, unknown> | undefined;
  if (!primary) return res.status(404).json({ error: 'Primary influencer not found' });

  for (const dupId of duplicate_ids) {
    if (dupId === primary_id) continue;
    // Re-point campaign entries
    await db.run(`UPDATE campaign_influencers SET influencer_id = ? WHERE influencer_id = ?`, [primary_id, dupId]);
    // Re-point offers
    await db.run(`UPDATE portal_offers SET influencer_id = ? WHERE influencer_id = ?`, [primary_id, dupId]);
    // Archive the duplicate
    await db.run(`UPDATE influencers SET is_archived = 1, updated_at = NOW() WHERE id = ?`, [dupId]);
  }

  const merged = await db.get('SELECT * FROM influencers WHERE id = ?', [primary_id]);
  res.json({ success: true, primary: merged, merged_count: duplicate_ids.length });
});

// POST /api/influencers/bulk-invite — generate portal invite links for multiple influencers
router.post('/bulk-invite', async (req: Request, res: Response) => {
  const { ids } = req.body as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array required' });
  }

  const baseUrl = req.headers.origin || `${req.protocol}://${req.headers.host}`;
  const results: { id: string; name: string; invite_url: string }[] = [];

  for (const id of ids) {
    const inf = await db.get('SELECT id, name_english, name_arabic FROM influencers WHERE id = ? AND is_archived = 0', [id]) as Record<string, unknown> | undefined;
    if (!inf) continue;
    const token = uuidv4().replace(/-/g, '');
    await db.run(`UPDATE influencers SET invite_token = ? WHERE id = ?`, [token, id]);
    results.push({
      id,
      name: String(inf.name_english || inf.name_arabic || id),
      invite_url: `${baseUrl}/portal/register?invite=${token}`,
    });
  }

  return res.json({ results });
});

// GET /api/influencers/export/contacts — export contact details for given ids
router.get('/export/contacts', async (req: Request, res: Response) => {
  const { ids } = req.query as { ids?: string };
  let rows: Record<string, unknown>[];

  if (ids) {
    const idList = ids.split(',').filter(Boolean);
    const placeholders = idList.map(() => '?').join(',');
    rows = await db.all(`
      SELECT id, name_english, name_arabic, ig_handle, tiktok_handle, snap_handle,
             email, phone, country, city, main_category, ig_followers, tiktok_followers,
             ig_rate, tiktok_rate, account_tier, tags
      FROM influencers WHERE id IN (${placeholders}) AND is_archived = 0
    `, idList) as Record<string, unknown>[];
  } else {
    rows = await db.all(`
      SELECT id, name_english, name_arabic, ig_handle, tiktok_handle, snap_handle,
             email, phone, country, city, main_category, ig_followers, tiktok_followers,
             ig_rate, tiktok_rate, account_tier, tags
      FROM influencers WHERE is_archived = 0
      ORDER BY created_at DESC LIMIT 5000
    `, []) as Record<string, unknown>[];
  }

  if (rows.length === 0) {
    res.setHeader('Content-Type', 'text/csv');
    return res.send('No data');
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        const s = String(val).replace(/"/g, '""');
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
      }).join(',')
    ),
  ];

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="contacts-${Date.now()}.csv"`);
  return res.send(lines.join('\n'));
});

// POST /api/influencers/bulk-delete
router.post('/bulk-delete', async (req: Request, res: Response) => {
  const { ids } = req.body as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array required' });
  }
  const placeholders = ids.map(() => '?').join(',');
  await db.run(`UPDATE influencers SET is_archived = 1 WHERE id IN (${placeholders})`, ids);
  return res.json({ success: true, count: ids.length });
});

export default router;
