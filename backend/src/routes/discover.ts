import { Router } from 'express';
import { discoverInfluencers, importDiscoveredInfluencer } from '../services/discoveryService';

const router = Router();

/** GET /api/discover?q=food&platform=instagram&limit=20&country=SA&min_followers=10000&sort_by=followers_desc */
router.get('/', async (req, res) => {
  const {
    q, platform = 'both', limit = '20',
    country, min_followers, max_followers, sort_by = 'followers_desc', category,
  } = req.query;

  if (!q || String(q).trim().length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }

  const plat = String(platform) as 'instagram' | 'tiktok' | 'both';
  const lim = Math.min(parseInt(String(limit), 10) || 20, 50);

  const { results, error } = await discoverInfluencers(String(q).trim(), plat, lim);

  // Apply filters client-side (RapidAPI doesn't support these natively)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let filtered: any[] = results;

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
    if (!isNaN(minF)) filtered = filtered.filter(r => (r.followers ?? 0) >= minF);
  }
  if (max_followers) {
    const maxF = parseInt(String(max_followers), 10);
    if (!isNaN(maxF)) filtered = filtered.filter(r => (r.followers ?? Infinity) <= maxF);
  }

  const sortKey = String(sort_by);
  if (sortKey === 'followers_desc')   filtered.sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0));
  else if (sortKey === 'followers_asc') filtered.sort((a, b) => (a.followers ?? 0) - (b.followers ?? 0));
  else if (sortKey === 'engagement_desc') filtered.sort((a, b) => (b.engagement_rate ?? 0) - (a.engagement_rate ?? 0));

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
