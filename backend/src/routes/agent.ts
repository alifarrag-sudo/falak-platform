/**
 * AI Agent routes.
 * Provides GPT-powered campaign assistance: outreach message generation,
 * influencer-campaign matching, and weekly briefings.
 * Stubs gracefully when OPENAI_API_KEY is not set.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { db } from '../db/connection';

const router = Router();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

function isConfigured() { return !!OPENAI_API_KEY; }

async function gptJson(systemPrompt: string, userPrompt: string): Promise<unknown> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  return JSON.parse(data.choices[0].message.content);
}

/** GET /api/agent/status — is OpenAI configured? */
router.get('/status', requireAuth(), (_req, res) => {
  res.json({ configured: isConfigured() });
});

/** POST /api/agent/outreach-message — generate a personalised outreach DM/email */
router.post('/outreach-message', requireAuth('platform_admin', 'agency'), async (req, res) => {
  const { influencer_id, campaign_id, channel = 'email', tone = 'professional' } = req.body;

  if (!influencer_id) return res.status(400).json({ error: 'influencer_id required' });

  const inf = await db.get(`
    SELECT name_english, name_arabic, ig_handle, tiktok_handle, ig_followers, ig_engagement_rate,
           categories, bio, account_tier
    FROM influencers WHERE id = ?
  `, [influencer_id]) as Record<string, unknown> | undefined;

  if (!inf) return res.status(404).json({ error: 'Influencer not found' });

  let campaignContext = '';
  if (campaign_id) {
    const camp = await db.get('SELECT title, brief FROM campaigns WHERE id = ?', [campaign_id]) as Record<string, unknown> | undefined;
    if (camp) campaignContext = `Campaign: "${camp.title}". Brief: ${(camp.brief as string || '').slice(0, 300)}`;
  }

  const name = inf.name_english || inf.name_arabic || inf.ig_handle || 'there';
  const handle = inf.ig_handle ? `@${inf.ig_handle}` : inf.tiktok_handle ? `@${inf.tiktok_handle}` : '';

  if (!isConfigured()) {
    // Demo fallback
    return res.json({
      is_demo: true,
      message: `Hi ${name}${handle ? ` (${handle})` : ''},\n\nI'm reaching out from FALAK regarding an exciting brand collaboration that I think would be a great fit for your audience.\n\nYou've built an incredible community of ${(inf.ig_followers as number)?.toLocaleString() || ''} followers, and your content style aligns perfectly with what our brand partner is looking for.\n\nWould you be open to a quick chat about the details? I'd love to share more about the campaign and see if it's a match.\n\nLooking forward to hearing from you!`,
    });
  }

  try {
    const result = await gptJson(
      `You are an influencer marketing specialist. Generate a ${tone} outreach message for a ${channel} to an influencer. Return JSON: { "message": "the message text", "subject": "email subject if applicable" }`,
      `Influencer: ${name} ${handle}. Followers: ${inf.ig_followers || 'unknown'}. Engagement: ${inf.ig_engagement_rate || '?'}%. Categories: ${inf.categories || 'lifestyle'}. Tier: ${inf.account_tier || 'micro'}.\n${campaignContext}\nChannel: ${channel}. Tone: ${tone}.`
    ) as { message: string; subject?: string };
    res.json({ is_demo: false, ...result });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** POST /api/agent/match-influencers — rank influencers for a campaign */
router.post('/match-influencers', requireAuth('platform_admin', 'agency', 'brand'), async (req, res) => {
  const { campaign_id, limit: topN = 10 } = req.body;

  if (!campaign_id) return res.status(400).json({ error: 'campaign_id required' });

  const camp = await db.get(`
    SELECT title, brief, budget, target_gender, target_age_min, target_age_max,
           target_countries, target_interests, campaign_objective
    FROM campaigns WHERE id = ?
  `, [campaign_id]) as Record<string, unknown> | undefined;

  if (!camp) return res.status(404).json({ error: 'Campaign not found' });

  // Get top 100 influencers by engagement for scoring
  const influencers = await db.all(`
    SELECT id, name_english, name_arabic, ig_handle, tiktok_handle,
           ig_followers, ig_engagement_rate, categories, account_tier, country
    FROM influencers WHERE is_archived = 0
    ORDER BY ig_engagement_rate DESC LIMIT 100
  `, []) as Record<string, unknown>[];

  if (!isConfigured() || influencers.length === 0) {
    // Simple heuristic scoring without AI
    const scored = influencers.slice(0, topN).map((inf, i) => ({
      rank: i + 1,
      influencer_id: inf.id,
      name: inf.name_english || inf.name_arabic || inf.ig_handle,
      handle: inf.ig_handle || inf.tiktok_handle,
      followers: inf.ig_followers,
      engagement_rate: inf.ig_engagement_rate,
      match_score: Math.max(50, 95 - i * 4),
      match_reason: 'Ranked by engagement rate (AI matching unavailable)',
    }));
    return res.json({ is_demo: true, matches: scored });
  }

  try {
    const infList = influencers.slice(0, 50).map(inf =>
      `ID:${inf.id} name:${inf.name_english || inf.name_arabic || inf.ig_handle} followers:${inf.ig_followers} engagement:${inf.ig_engagement_rate}% cats:${inf.categories || ''} tier:${inf.account_tier} country:${inf.country}`
    ).join('\n');

    const result = await gptJson(
      `You are an influencer-campaign matching expert. Given a campaign brief and a list of influencers, return the top ${topN} matches as JSON: { "matches": [{ "influencer_id": "...", "match_score": 0-100, "match_reason": "1-sentence reason" }] }`,
      `Campaign: "${camp.title}"\nBrief: ${(camp.brief as string || '').slice(0, 400)}\nObjective: ${camp.campaign_objective || ''}\nTarget: ${camp.target_interests || ''}\n\nInfluencers:\n${infList}`
    ) as { matches: Array<{ influencer_id: string; match_score: number; match_reason: string }> };

    // Enrich with influencer data
    const enriched = (result.matches || []).slice(0, topN).map((m, i) => {
      const inf = influencers.find(x => x.id === m.influencer_id);
      return {
        rank: i + 1,
        ...m,
        name: inf ? (inf.name_english || inf.name_arabic || inf.ig_handle) : 'Unknown',
        handle: inf ? (inf.ig_handle || inf.tiktok_handle) : null,
        followers: inf?.ig_followers,
        engagement_rate: inf?.ig_engagement_rate,
      };
    });

    // Cache result on campaign
    await db.run(`UPDATE campaigns SET ai_match_cache = ?, ai_match_generated_at = NOW() WHERE id = ?`,
      [JSON.stringify(enriched), campaign_id]);

    res.json({ is_demo: false, matches: enriched });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** GET /api/agent/match-influencers/:campaignId — get cached matches */
router.get('/match-influencers/:campaignId', requireAuth('platform_admin', 'agency', 'brand'), async (req, res) => {
  const camp = await db.get('SELECT ai_match_cache, ai_match_generated_at FROM campaigns WHERE id = ?', [req.params.campaignId]) as { ai_match_cache: string | null; ai_match_generated_at: string | null } | undefined;
  if (!camp || !camp.ai_match_cache) return res.json({ matches: null });
  try {
    res.json({ matches: JSON.parse(camp.ai_match_cache), generated_at: camp.ai_match_generated_at });
  } catch {
    res.json({ matches: null });
  }
});

/** POST /api/agent/briefing/:influencerId — generate a weekly performance briefing */
router.post('/briefing/:influencerId', requireAuth('platform_admin', 'agency'), async (req, res) => {
  const { influencerId } = req.params;

  const inf = await db.get(`
    SELECT name_english, name_arabic, ig_handle, ig_followers, ig_engagement_rate,
           tiktok_followers, categories, account_tier, currency
    FROM influencers WHERE id = ?
  `, [influencerId]) as Record<string, unknown> | undefined;
  if (!inf) return res.status(404).json({ error: 'Influencer not found' });

  // Gather data
  const offers = await db.get(`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN status='accepted' THEN 1 ELSE 0 END) as accepted,
      SUM(CASE WHEN status='completed' THEN rate ELSE 0 END) as earned
    FROM portal_offers WHERE influencer_id = ?
  `, [influencerId]) as { total: number; accepted: number; earned: number };

  const demographics = await db.get(
    'SELECT age_18_24, age_25_34, gender_female, gender_male, top_countries FROM audience_demographics WHERE influencer_id = ? ORDER BY updated_at DESC LIMIT 1',
    [influencerId]
  ) as Record<string, unknown> | undefined;

  const name = inf.name_english || inf.name_arabic || inf.ig_handle || 'this influencer';

  let content: string;

  if (!isConfigured()) {
    content = `Weekly briefing for ${name}:\n\n• ${(inf.ig_followers as number)?.toLocaleString()} Instagram followers (${inf.ig_engagement_rate}% engagement)\n• ${offers.accepted || 0} active offers | ${(inf.currency as string) || 'SAR'} ${(offers.earned || 0).toLocaleString()} total earned\n• Account tier: ${inf.account_tier || 'micro'}\n• Categories: ${inf.categories || 'lifestyle'}\n\nRecommendation: ${(inf.ig_engagement_rate as number) > 4 ? 'High-value creator — prioritise for premium campaigns.' : 'Strong roster member — suitable for mid-tier campaigns.'}`;
  } else {
    try {
      const result = await gptJson(
        'You are an influencer talent manager. Generate a concise weekly performance briefing as JSON: { "summary": "2-3 sentence overview", "highlights": ["bullet 1", "bullet 2", "bullet 3"], "recommendation": "1 sentence action item" }',
        `Creator: ${name}. Followers: ${inf.ig_followers} (IG). Engagement: ${inf.ig_engagement_rate}%. Active offers: ${offers.accepted}. Total earned: ${(inf.currency as string) || 'SAR'} ${offers.earned}. Audience age 18-24: ${demographics?.age_18_24 || 'N/A'}%, female: ${demographics?.gender_female || 'N/A'}%.`
      ) as { summary: string; highlights: string[]; recommendation: string };
      content = `${result.summary}\n\nHighlights:\n${result.highlights?.map((h: string) => `• ${h}`).join('\n')}\n\nRecommendation: ${result.recommendation}`;
    } catch {
      content = `Weekly briefing for ${name} — data snapshot recorded.`;
    }
  }

  const id = crypto.randomUUID();
  await db.run('INSERT INTO agent_briefings (id, influencer_id, briefing_type, content, data_snapshot) VALUES (?, ?, ?, ?, ?)',
    [id, influencerId, 'weekly', content, JSON.stringify({ inf, offers, demographics })]);

  res.json({ id, influencer_id: influencerId, content, generated_at: new Date().toISOString() });
});

/** GET /api/agent/briefings/:influencerId — list briefing history */
router.get('/briefings/:influencerId', requireAuth('platform_admin', 'agency'), async (req, res) => {
  const rows = await db.all('SELECT id, influencer_id, briefing_type, content, generated_at, read_at FROM agent_briefings WHERE influencer_id = ? ORDER BY generated_at DESC LIMIT 10',
    [req.params.influencerId]);
  res.json(rows);
});

/** PUT /api/agent/briefings/:id/read — mark briefing as read */
router.put('/briefings/:id/read', requireAuth(), async (req, res) => {
  await db.run(`UPDATE agent_briefings SET read_at = NOW() WHERE id = ?`, [req.params.id]);
  res.json({ ok: true });
});

export default router;
