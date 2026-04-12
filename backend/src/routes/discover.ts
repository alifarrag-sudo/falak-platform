import { Router } from 'express';
import { discoverInfluencers, importDiscoveredInfluencer } from '../services/discoveryService';
import { db } from '../db/connection';

const router = Router();

/** Internal DB fallback — searches seeded influencers when no RapidAPI key is configured */
async function searchInternalDb(q: string, platform: string, limit: number, filters: Record<string, string>) {
  const term = q.trim().replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, '') + '*';

  let rows: Record<string, unknown>[] = [];
  const isPostgres = !!process.env.DATABASE_URL;

  try {
    if (isPostgres) {
      rows = await db.all(`
        SELECT * FROM influencers
        WHERE is_archived = 0 AND search_vector @@ plainto_tsquery('simple', ?)
        ORDER BY ig_followers DESC LIMIT ?
      `, [q.trim(), limit]) as Record<string, unknown>[];
    } else {
      rows = await db.all(`
        SELECT i.* FROM influencers i
        JOIN influencers_fts fts ON i.rowid = fts.rowid
        WHERE influencers_fts MATCH ? AND i.is_archived = 0
        GROUP BY i.id
        ORDER BY i.ig_followers DESC LIMIT ?
      `, [term, limit]) as Record<string, unknown>[];
    }
  } catch {
    // FTS may fail on special chars — fallback to LIKE
    rows = await db.all(`
      SELECT * FROM influencers
      WHERE is_archived = 0 AND (
        name_english LIKE ? OR name_arabic LIKE ? OR main_category LIKE ? OR tags LIKE ?
      ) ORDER BY ig_followers DESC LIMIT ?
    `, [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, limit]) as Record<string, unknown>[];
  }

  // Platform filter
  if (platform !== 'both' && platform !== 'all') {
    rows = rows.filter((r) => {
      if (platform === 'instagram') return r.ig_handle;
      if (platform === 'tiktok')    return r.tiktok_handle;
      if (platform === 'snapchat')  return r.snap_handle;
      if (platform === 'youtube')   return r.youtube_followers;
      if (platform === 'twitter')   return r.twitter_followers;
      if (platform === 'facebook')  return r.fb_handle;
      return true;
    });
  }

  // Country filter
  if (filters.country) {
    rows = rows.filter((r) => r.country && String(r.country).toLowerCase().includes(filters.country.toLowerCase()));
  }
  if (filters.min_followers) {
    const min = parseInt(filters.min_followers);
    rows = rows.filter((r) => ((r.ig_followers as number) || (r.tiktok_followers as number) || 0) >= min);
  }
  if (filters.max_followers) {
    const max = parseInt(filters.max_followers);
    rows = rows.filter((r) => ((r.ig_followers as number) || (r.tiktok_followers as number) || 0) <= max);
  }

  // Map to the same shape as RapidAPI results
  return rows.map((r) => {
    const handle = (r.ig_handle || r.tiktok_handle || r.snap_handle || r.fb_handle || '') as string;
    const followers = ((r.ig_followers || r.tiktok_followers || r.snap_followers || 0) as number);
    return {
      platform: r.ig_handle ? 'instagram' : r.tiktok_handle ? 'tiktok' : platform,
      handle,
      display_name: r.name_english || r.name_arabic || handle,
      followers,
      engagement_rate: r.ig_engagement_rate || 0,
      bio: r.internal_notes || '',
      country: r.country || '',
      category: r.main_category || '',
      profile_pic: r.profile_photo_url || '',
      profile_url: r.ig_url || r.tiktok_url || '',
      is_verified: !!r.mawthouq_certificate,
      already_imported: true,
      source: 'internal',
    };
  });
}

/** GET /api/discover?q=food&platform=instagram&limit=20&country=SA&min_followers=10000&sort_by=followers_desc */
router.get('/', async (req, res) => {
  const {
    q, platform = 'both', limit = '20',
    country, min_followers, max_followers, sort_by = 'followers_desc', category,
  } = req.query;

  if (!q || String(q).trim().length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }

  const plat = String(platform);
  const lim = Math.min(parseInt(String(limit), 10) || 20, 50);
  const filters = {
    country: String(country || ''),
    min_followers: String(min_followers || ''),
    max_followers: String(max_followers || ''),
  };

  // Check if RapidAPI key is configured
  const apiKeySetting = await db.get('SELECT value FROM settings WHERE key = ?', ['rapidapi_key']) as { value: string } | undefined;
  const hasApiKey = !!(apiKeySetting?.value || process.env.RAPIDAPI_KEY);

  // If no API key, use internal DB search
  if (!hasApiKey) {
    const internalResults = await searchInternalDb(String(q).trim(), plat, lim, filters);
    return res.json({
      results: internalResults,
      error: null,
      query: q,
      platform: plat,
      source: 'internal',
    });
  }

  const { results, error } = await discoverInfluencers(String(q).trim(), plat as 'instagram' | 'tiktok' | 'both', lim);

  // Apply filters client-side (RapidAPI doesn't support these natively)
  let filtered: Record<string, unknown>[] = (results as unknown) as Record<string, unknown>[];

  if (country && String(country).trim()) {
    const c = String(country).toLowerCase();
    filtered = filtered.filter(r => r.country && String(r.country).toLowerCase().includes(c));
  }
  if (category && String(category).trim()) {
    const cat = String(category).toLowerCase();
    filtered = filtered.filter(r => r.category && String(r.category).toLowerCase().includes(cat));
  }
  if (min_followers) {
    const minF = parseInt(String(min_followers), 10);
    if (!isNaN(minF)) filtered = filtered.filter(r => ((r.followers as number) ?? 0) >= minF);
  }
  if (max_followers) {
    const maxF = parseInt(String(max_followers), 10);
    if (!isNaN(maxF)) filtered = filtered.filter(r => ((r.followers as number) ?? Infinity) <= maxF);
  }

  const sortKey = String(sort_by);
  if (sortKey === 'followers_desc')   filtered.sort((a, b) => ((b.followers as number) ?? 0) - ((a.followers as number) ?? 0));
  else if (sortKey === 'followers_asc') filtered.sort((a, b) => ((a.followers as number) ?? 0) - ((b.followers as number) ?? 0));
  else if (sortKey === 'engagement_desc') filtered.sort((a, b) => ((b.engagement_rate as number) ?? 0) - ((a.engagement_rate as number) ?? 0));

  res.json({ results: filtered, error: error || null, query: q, platform: plat });
});

/** POST /api/discover/import  body: { platform, handle } */
router.post('/import', async (req, res) => {
  const { platform, handle } = req.body;

  if (!platform || !handle) {
    return res.status(400).json({ error: 'platform and handle are required' });
  }
  if (!['instagram', 'tiktok'].includes(platform)) {
    return res.status(400).json({ error: 'platform must be instagram or tiktok' });
  }

  try {
    const result = await importDiscoveredInfluencer(
      platform as 'instagram' | 'tiktok',
      String(handle).replace(/^@/, '')
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** POST /api/discover/import-bulk  body: { influencers: [{platform, handle}] } */
router.post('/import-bulk', async (req, res) => {
  const { influencers } = req.body;
  if (!Array.isArray(influencers)) return res.status(400).json({ error: 'influencers array required' });

  const results = [];
  for (const inf of influencers.slice(0, 25)) {
    try {
      const r = await importDiscoveredInfluencer(inf.platform, String(inf.handle).replace(/^@/, ''));
      results.push({ handle: inf.handle, ...r });
    } catch {
      results.push({ handle: inf.handle, error: true });
    }
  }
  res.json({ results, total: results.length, created: results.filter(r => r.created).length });
});

export default router;
