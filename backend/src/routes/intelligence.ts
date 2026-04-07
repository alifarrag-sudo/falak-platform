/**
 * Audience Intelligence API routes.
 * Provides Phyllo SDK tokens, data sync, and intelligence reads.
 * Protected by role — admin, agency, brand (own campaigns), influencer (own data).
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getDb } from '../db/schema';
import * as phylloService from '../services/phylloService';
import * as sentimentService from '../services/sentimentService';

const router = Router();

/** GET /api/intelligence/status — check if Phyllo + OpenAI are configured */
router.get('/status', requireAuth(), (_req, res) => {
  res.json({
    phyllo_configured: !!(process.env.PHYLLO_CLIENT_ID && process.env.PHYLLO_CLIENT_SECRET),
    openai_configured: !!process.env.OPENAI_API_KEY,
  });
});

/** POST /api/intelligence/connect/:influencerId — initiate Phyllo connection */
router.post('/connect/:influencerId', requireAuth('platform_admin', 'agency', 'brand', 'influencer'), async (req, res) => {
  try {
    const { influencerId } = req.params;
    const { sdk_token, phyllo_user_id } = await phylloService.getSDKToken(influencerId);
    res.json({ sdk_token, phyllo_user_id });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/** GET /api/intelligence/token/:influencerId — get SDK token for frontend widget */
router.get('/token/:influencerId', requireAuth('platform_admin', 'agency', 'brand', 'influencer'), async (req, res) => {
  try {
    const { influencerId } = req.params;
    const result = await phylloService.getSDKToken(influencerId);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/** POST /api/intelligence/sync/:influencerId — full data sync */
router.post('/sync/:influencerId', requireAuth('platform_admin', 'agency', 'influencer'), async (req, res) => {
  try {
    const { influencerId } = req.params;
    const result = await phylloService.fullSync(influencerId);

    // Also run sentiment
    await sentimentService.runSentimentForInfluencer(influencerId);

    res.json({ ...result, message: 'Sync complete' });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** GET /api/intelligence/audience/:influencerId — demographics + quality */
router.get('/audience/:influencerId', requireAuth('platform_admin', 'agency', 'brand', 'influencer'), (req, res) => {
  const db = getDb();
  const { influencerId } = req.params;
  const { platform = 'instagram' } = req.query;

  const demographics = db.prepare('SELECT * FROM audience_demographics WHERE influencer_id = ? AND platform = ?').get(influencerId, platform) as Record<string, unknown> | undefined;
  const quality = db.prepare('SELECT * FROM audience_quality WHERE influencer_id = ? AND platform = ?').get(influencerId, platform) as Record<string, unknown> | undefined;
  const interests = db.prepare('SELECT * FROM audience_interests WHERE influencer_id = ? AND platform = ?').get(influencerId, platform) as Record<string, unknown> | undefined;
  const phylloUser = db.prepare('SELECT phyllo_user_id, created_at FROM phyllo_users WHERE influencer_id = ?').get(influencerId) as Record<string, unknown> | undefined;

  // Parse JSON fields
  const parseJSON = (val: unknown) => {
    if (!val) return [];
    try { return JSON.parse(val as string); } catch { return []; }
  };

  // If no real data, return demo data
  if (!demographics && !quality) {
    const demo = phylloService.getDemoIntelligenceData(influencerId);
    return res.json({ is_demo: true, phyllo_connected: !!phylloUser?.phyllo_user_id, ...demo });
  }

  res.json({
    is_demo: false,
    phyllo_connected: !!phylloUser?.phyllo_user_id,
    demographics: demographics ? {
      ...demographics,
      top_countries: parseJSON(demographics.top_countries),
      top_cities: parseJSON(demographics.top_cities),
    } : null,
    quality: quality || null,
    interests: interests ? {
      ...interests,
      interests: parseJSON(interests.interests),
      brand_affinities: parseJSON(interests.brand_affinities),
    } : null,
  });
});

/** GET /api/intelligence/content/:influencerId — content performance */
router.get('/content/:influencerId', requireAuth('platform_admin', 'agency', 'brand', 'influencer'), (req, res) => {
  const db = getDb();
  const { influencerId } = req.params;
  const { platform = 'instagram' } = req.query;

  const content = db.prepare('SELECT * FROM content_performance WHERE influencer_id = ? AND platform = ?').get(influencerId, platform) as Record<string, unknown> | undefined;
  const demo = phylloService.getDemoIntelligenceData(influencerId);

  res.json(content ? {
    is_demo: false,
    ...content,
    top_posts: (() => { try { return JSON.parse((content.top_posts as string) || '[]'); } catch { return []; } })(),
  } : { is_demo: true, ...(demo?.content || {}) });
});

/** GET /api/intelligence/sentiment/:influencerId — sentiment breakdown */
router.get('/sentiment/:influencerId', requireAuth('platform_admin', 'agency', 'brand', 'influencer'), (req, res) => {
  const { influencerId } = req.params;
  const { platform = 'instagram' } = req.query;

  const sentiment = sentimentService.getLatestSentiment(influencerId, platform as string);
  const demo = phylloService.getDemoIntelligenceData(influencerId);

  res.json(sentiment ? { is_demo: false, ...sentiment } : { is_demo: true, ...(demo?.sentiment || {}) });
});

/** GET /api/intelligence/full/:influencerId — all intelligence data in one call */
router.get('/full/:influencerId', requireAuth('platform_admin', 'agency', 'brand', 'influencer'), (req, res) => {
  const db = getDb();
  const { influencerId } = req.params;
  const { platform = 'instagram' } = req.query;

  const parseJSON = (val: unknown) => {
    if (!val) return [];
    try { return JSON.parse(val as string); } catch { return []; }
  };

  const demographics = db.prepare('SELECT * FROM audience_demographics WHERE influencer_id = ? AND platform = ?').get(influencerId, platform) as Record<string, unknown> | undefined;
  const quality = db.prepare('SELECT * FROM audience_quality WHERE influencer_id = ? AND platform = ?').get(influencerId, platform) as Record<string, unknown> | undefined;
  const interests = db.prepare('SELECT * FROM audience_interests WHERE influencer_id = ? AND platform = ?').get(influencerId, platform) as Record<string, unknown> | undefined;
  const content = db.prepare('SELECT * FROM content_performance WHERE influencer_id = ? AND platform = ?').get(influencerId, platform) as Record<string, unknown> | undefined;
  const sentiment = sentimentService.getLatestSentiment(influencerId, platform as string);
  const phylloUser = db.prepare('SELECT phyllo_user_id FROM phyllo_users WHERE influencer_id = ?').get(influencerId) as Record<string, unknown> | undefined;
  const influencer = db.prepare('SELECT name_english, name_arabic, ig_followers, ig_engagement_rate, account_tier FROM influencers WHERE id = ?').get(influencerId) as Record<string, unknown> | undefined;

  const hasRealData = !!(demographics || quality || content);

  if (!hasRealData) {
    const demo = phylloService.getDemoIntelligenceData(influencerId);
    return res.json({
      is_demo: true,
      phyllo_configured: !!(process.env.PHYLLO_CLIENT_ID),
      phyllo_connected: !!phylloUser?.phyllo_user_id,
      influencer,
      ...demo,
    });
  }

  res.json({
    is_demo: false,
    phyllo_configured: !!(process.env.PHYLLO_CLIENT_ID),
    phyllo_connected: !!phylloUser?.phyllo_user_id,
    influencer,
    demographics: demographics ? {
      ...demographics,
      top_countries: parseJSON(demographics.top_countries),
      top_cities: parseJSON(demographics.top_cities),
    } : null,
    quality,
    interests: interests ? {
      ...interests,
      interests: parseJSON(interests.interests),
      brand_affinities: parseJSON(interests.brand_affinities),
    } : null,
    content: content ? { ...content, top_posts: parseJSON(content.top_posts) } : null,
    sentiment,
  });
});

/** POST /api/intelligence/sync-all — admin: sync all influencers */
router.post('/sync-all', requireAuth('platform_admin'), async (_req, res) => {
  const db = getDb();
  const influencers = db.prepare(`SELECT id FROM influencers WHERE is_archived = 0 LIMIT 100`).all() as Array<{ id: string }>;

  const results = { synced: 0, errors: [] as string[] };

  for (const inf of influencers) {
    try {
      const r = await phylloService.fullSync(inf.id);
      results.synced += r.synced;
      results.errors.push(...r.errors);
    } catch (e) {
      results.errors.push(`${inf.id}: ${(e as Error).message}`);
    }
  }

  res.json(results);
});

export default router;
