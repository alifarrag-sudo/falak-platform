/**
 * Phyllo API integration service.
 * Connects creator social accounts and fetches audience/content intelligence.
 * Stubs gracefully when PHYLLO_CLIENT_ID is not configured.
 * https://docs.getphyllo.com
 */
import { getDb } from '../db/schema';

const PHYLLO_BASE = 'https://api.getphyllo.com/v1';
const CLIENT_ID = process.env.PHYLLO_CLIENT_ID || '';
const CLIENT_SECRET = process.env.PHYLLO_CLIENT_SECRET || '';

function isConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET);
}

function authHeaders() {
  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  return {
    'Authorization': `Basic ${creds}`,
    'Content-Type': 'application/json',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function phylloFetch(path: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(`${PHYLLO_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers as Record<string, string> || {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Phyllo API error ${res.status}: ${text}`);
  }
  return res.json();
}

/** Register an influencer in Phyllo and store the phyllo_user_id */
export async function createPhylloUser(influencerId: string): Promise<string> {
  if (!isConfigured()) throw new Error('Phyllo not configured');
  const db = getDb();

  // Check if already registered
  const existing = db.prepare('SELECT phyllo_user_id FROM phyllo_users WHERE influencer_id = ?').get(influencerId) as { phyllo_user_id: string } | undefined;
  if (existing?.phyllo_user_id) return existing.phyllo_user_id;

  // Fetch influencer name for Phyllo user creation
  const inf = db.prepare('SELECT name_english, name_arabic, email FROM influencers WHERE id = ?').get(influencerId) as { name_english: string; name_arabic: string; email: string } | undefined;
  if (!inf) throw new Error('Influencer not found');

  const body = {
    name: inf.name_english || inf.name_arabic || 'Unnamed',
    external_id: influencerId,
  };

  const data = await phylloFetch('/users', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  const phylloUserId = data.id as string;

  // Upsert into phyllo_users
  db.prepare(`
    INSERT INTO phyllo_users (id, influencer_id, phyllo_user_id, created_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(influencer_id) DO UPDATE SET phyllo_user_id = excluded.phyllo_user_id
  `).run(crypto.randomUUID(), influencerId, phylloUserId);

  return phylloUserId;
}

/** Get SDK token for frontend Phyllo Connect widget */
export async function getSDKToken(influencerId: string): Promise<{ sdk_token: string; phyllo_user_id: string }> {
  if (!isConfigured()) throw new Error('Phyllo not configured');

  const phylloUserId = await createPhylloUser(influencerId);

  const data = await phylloFetch('/sdk-tokens', {
    method: 'POST',
    body: JSON.stringify({ user_id: phylloUserId, products: ['IDENTITY', 'IDENTITY.AUDIENCE', 'ENGAGEMENT', 'INCOME'] }),
  });

  return { sdk_token: data.sdk_token as string, phyllo_user_id: phylloUserId };
}

/** Fetch and store audience demographics from Phyllo */
export async function fetchAudienceData(influencerId: string, accountId: string): Promise<void> {
  if (!isConfigured()) throw new Error('Phyllo not configured');
  const db = getDb();

  const inf = db.prepare('SELECT phyllo_user_id FROM phyllo_users WHERE influencer_id = ?').get(influencerId) as { phyllo_user_id: string } | undefined;
  if (!inf?.phyllo_user_id) throw new Error('Phyllo user not registered');

  const data = await phylloFetch(`/audience-demographics?account_id=${accountId}`);

  if (!data.data?.length) return;

  const audience = data.data[0];
  const platform = (audience.work_platform?.name || 'instagram').toLowerCase();

  // Age breakdown
  const ageGroups: Record<string, number> = {};
  for (const age of (audience.age_distribution || [])) {
    ageGroups[age.code] = age.percentage || 0;
  }

  // Gender
  const genders: Record<string, number> = {};
  for (const g of (audience.gender_distribution || [])) {
    genders[g.code] = g.percentage || 0;
  }

  // Countries
  const topCountries = (audience.country_distribution || []).slice(0, 10).map((c: Record<string, unknown>) => ({
    country: c.code,
    percentage: c.percentage,
  }));

  // Cities
  const topCities = (audience.city_distribution || []).slice(0, 10).map((c: Record<string, unknown>) => ({
    city: c.name,
    percentage: c.percentage,
  }));

  db.prepare(`
    INSERT INTO audience_demographics (id, influencer_id, platform, age_13_17, age_18_24, age_25_34, age_35_44, age_45_plus, gender_male, gender_female, top_countries, top_cities, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(influencer_id, platform) DO UPDATE SET
      age_13_17 = excluded.age_13_17, age_18_24 = excluded.age_18_24,
      age_25_34 = excluded.age_25_34, age_35_44 = excluded.age_35_44,
      age_45_plus = excluded.age_45_plus, gender_male = excluded.gender_male,
      gender_female = excluded.gender_female, top_countries = excluded.top_countries,
      top_cities = excluded.top_cities, updated_at = excluded.updated_at
  `).run(
    crypto.randomUUID(), influencerId, platform,
    ageGroups['13-17'] || 0, ageGroups['18-24'] || 0,
    ageGroups['25-34'] || 0, ageGroups['35-44'] || 0,
    ageGroups['45+'] || 0,
    genders['MALE'] || genders['M'] || 0,
    genders['FEMALE'] || genders['F'] || 0,
    JSON.stringify(topCountries), JSON.stringify(topCities),
  );

  // Interests & brand affinities
  const interests = (audience.interest_distribution || []).map((i: Record<string, unknown>) => i.name);
  const brandAffinities = (audience.brand_affinity_distribution || []).map((b: Record<string, unknown>) => b.name);

  db.prepare(`
    INSERT INTO audience_interests (id, influencer_id, platform, interests, brand_affinities, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(influencer_id, platform) DO UPDATE SET
      interests = excluded.interests, brand_affinities = excluded.brand_affinities, updated_at = excluded.updated_at
  `).run(crypto.randomUUID(), influencerId, platform, JSON.stringify(interests), JSON.stringify(brandAffinities));
}

/** Fetch and store content performance and audience quality from Phyllo */
export async function fetchContentData(influencerId: string, accountId: string): Promise<void> {
  if (!isConfigured()) throw new Error('Phyllo not configured');
  const db = getDb();

  const data = await phylloFetch(`/profiles?account_id=${accountId}`);
  if (!data.data?.length) return;

  const profile = data.data[0];
  const platform = (profile.work_platform?.name || 'instagram').toLowerCase();

  db.prepare(`
    INSERT INTO content_performance (id, influencer_id, platform, avg_likes, avg_comments, avg_views, avg_shares, avg_saves, avg_reach, avg_impressions, engagement_rate, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(influencer_id, platform) DO UPDATE SET
      avg_likes = excluded.avg_likes, avg_comments = excluded.avg_comments,
      avg_views = excluded.avg_views, avg_shares = excluded.avg_shares,
      avg_saves = excluded.avg_saves, avg_reach = excluded.avg_reach,
      avg_impressions = excluded.avg_impressions, engagement_rate = excluded.engagement_rate,
      updated_at = excluded.updated_at
  `).run(
    crypto.randomUUID(), influencerId, platform,
    profile.avg_likes || 0, profile.avg_comments || 0,
    profile.avg_views || 0, profile.avg_shares || 0,
    profile.avg_saves || 0, profile.avg_reach || 0,
    profile.avg_impressions || 0, profile.engagement_rate || 0,
  );
}

/** Fetch and store audience quality / credibility score from Phyllo */
export async function fetchCredibilityData(influencerId: string, accountId: string): Promise<void> {
  if (!isConfigured()) throw new Error('Phyllo not configured');
  const db = getDb();

  const data = await phylloFetch(`/credibility?account_id=${accountId}`);
  if (!data.data) return;

  const cred = data.data;
  const platform = (cred.work_platform?.name || 'instagram').toLowerCase();

  db.prepare(`
    INSERT INTO audience_quality (id, influencer_id, platform, real_followers_pct, suspicious_followers_pct, mass_followers_pct, bot_score, credibility_score, audience_type, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(influencer_id, platform) DO UPDATE SET
      real_followers_pct = excluded.real_followers_pct,
      suspicious_followers_pct = excluded.suspicious_followers_pct,
      mass_followers_pct = excluded.mass_followers_pct,
      bot_score = excluded.bot_score,
      credibility_score = excluded.credibility_score,
      audience_type = excluded.audience_type,
      updated_at = excluded.updated_at
  `).run(
    crypto.randomUUID(), influencerId, platform,
    cred.real_followers_percentage || 0,
    cred.suspicious_followers_percentage || 0,
    cred.mass_followers_percentage || 0,
    100 - (cred.credibility_score || 100),
    cred.credibility_score || 100,
    cred.audience_type || 'MIXED',
  );
}

/** Full sync: audience + content + credibility for all connected accounts */
export async function fullSync(influencerId: string): Promise<{ synced: number; errors: string[] }> {
  if (!isConfigured()) return { synced: 0, errors: ['Phyllo not configured'] };

  let phylloUserId: string;
  try {
    phylloUserId = await createPhylloUser(influencerId);
  } catch (e) {
    return { synced: 0, errors: [`Failed to create Phyllo user: ${(e as Error).message}`] };
  }

  // Get connected accounts
  const accountsData = await phylloFetch(`/accounts?user_id=${phylloUserId}&limit=10`);
  const accounts = accountsData.data || [];

  let synced = 0;
  const errors: string[] = [];

  for (const account of accounts) {
    const accountId = account.id as string;
    try {
      await fetchAudienceData(influencerId, accountId);
      await fetchContentData(influencerId, accountId);
      await fetchCredibilityData(influencerId, accountId);
      synced++;
    } catch (e) {
      errors.push(`${account.work_platform?.name}: ${(e as Error).message}`);
    }
  }

  return { synced, errors };
}

/** Get stub/demo intelligence data when Phyllo is not configured */
export function getDemoIntelligenceData(influencerId: string) {
  const db = getDb();
  const inf = db.prepare('SELECT ig_followers, ig_engagement_rate, tiktok_followers, account_tier FROM influencers WHERE id = ?').get(influencerId) as Record<string, unknown> | undefined;
  if (!inf) return null;

  const followers = (inf.ig_followers as number) || 50000;
  const engRate = (inf.ig_engagement_rate as number) || 3.5;

  return {
    is_demo: true,
    demographics: {
      platform: 'instagram',
      age_13_17: 5, age_18_24: 38, age_25_34: 35, age_35_44: 15, age_45_plus: 7,
      gender_male: 35, gender_female: 65,
      top_countries: [
        { country: 'SA', percentage: 42 }, { country: 'AE', percentage: 18 },
        { country: 'KW', percentage: 12 }, { country: 'EG', percentage: 10 },
        { country: 'QA', percentage: 8 },
      ],
      top_cities: [
        { city: 'Riyadh', percentage: 22 }, { city: 'Dubai', percentage: 16 },
        { city: 'Jeddah', percentage: 14 }, { city: 'Kuwait City', percentage: 10 },
      ],
    },
    quality: {
      platform: 'instagram',
      real_followers_pct: 78,
      suspicious_followers_pct: 12,
      mass_followers_pct: 10,
      bot_score: 12,
      credibility_score: 78,
      audience_type: 'MIXED',
    },
    content: {
      platform: 'instagram',
      avg_likes: Math.round(followers * engRate / 100 * 0.7),
      avg_comments: Math.round(followers * engRate / 100 * 0.3),
      avg_views: Math.round(followers * 2.1),
      avg_shares: Math.round(followers * 0.02),
      avg_saves: Math.round(followers * 0.05),
      avg_reach: Math.round(followers * 1.3),
      avg_impressions: Math.round(followers * 1.8),
      engagement_rate: engRate,
    },
    interests: {
      platform: 'instagram',
      interests: ['Fashion', 'Beauty', 'Travel', 'Lifestyle', 'Food'],
      brand_affinities: ['Nike', 'H&M', 'Sephora', 'Zara', 'Starbucks'],
    },
    sentiment: {
      platform: 'instagram',
      positive_pct: 71, neutral_pct: 22, negative_pct: 7,
      troll_count: 12, spam_count: 8, genuine_fan_count: 180,
      top_positive_keywords: ['amazing', 'love', 'beautiful', 'inspiring', 'goals'],
      top_negative_keywords: ['fake', 'boring'],
    },
  };
}
