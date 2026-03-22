/**
 * Platform stats sync service — three-tier data strategy:
 *   Tier 1: OAuth-connected accounts (richest data, official API)
 *   Tier 2: RapidAPI scraper fallback (public metrics only)
 *   Tier 3: Manual entry (flagged for refresh if >30 days old)
 *
 * Also calculates trust scores based on available data.
 */
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/schema';
import { decryptToken, getPlatformConfig, PlatformKey, refreshAccessToken, encryptToken } from './oauthService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P = any;

// ── Helpers ───────────────────────────────────────────────────────────────────

function storePosts(influencerId: string, platform: string, posts: Array<{
  post_id?: string; post_url?: string; thumbnail_url?: string; caption?: string;
  media_type?: string; likes?: number; comments?: number; views?: number;
  shares?: number; posted_at?: string;
}>) {
  if (!posts.length) return;
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO influencer_posts
      (id, influencer_id, platform, post_id, post_url, thumbnail_url, caption,
       media_type, likes, comments, views, shares, posted_at, source, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'oauth', datetime('now'))
  `);
  for (const p of posts.slice(0, 12)) { // store up to 12 recent posts
    stmt.run(
      uuidv4() as P, influencerId as P, platform as P,
      (p.post_id ?? null) as P, (p.post_url ?? null) as P,
      (p.thumbnail_url ?? null) as P, (p.caption ?? null) as P,
      (p.media_type ?? 'IMAGE') as P,
      (p.likes ?? 0) as P, (p.comments ?? 0) as P,
      (p.views ?? 0) as P, (p.shares ?? 0) as P,
      (p.posted_at ?? null) as P,
    );
  }
}

function storePlatformStats(influencerId: string, platform: string, stats: Partial<PlatformStats>, source: string) {
  const db = getDb();
  const id = uuidv4();
  db.prepare(`
    INSERT INTO platform_stats (
      id, influencer_id, platform, follower_count, following_count, post_count,
      avg_engagement_rate, avg_views, avg_likes, avg_comments,
      audience_gender_male_pct, audience_gender_female_pct,
      audience_top_country_1, audience_top_city_1,
      data_source, captured_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    id as P, influencerId as P, platform as P,
    (stats.follower_count ?? null) as P,
    (stats.following_count ?? null) as P,
    (stats.post_count ?? null) as P,
    (stats.avg_engagement_rate ?? null) as P,
    (stats.avg_views ?? null) as P,
    (stats.avg_likes ?? null) as P,
    (stats.avg_comments ?? null) as P,
    (stats.audience_gender_male_pct ?? null) as P,
    (stats.audience_gender_female_pct ?? null) as P,
    (stats.audience_top_country_1 ?? null) as P,
    (stats.audience_top_city_1 ?? null) as P,
    source as P,
  );
}

function updateInfluencerFollowers(influencerId: string, platform: string, followerCount: number) {
  const db = getDb();
  const colMap: Record<string, string> = {
    instagram: 'ig_followers',
    tiktok:    'tiktok_followers',
    youtube:   'youtube_followers',
    snapchat:  'snap_followers',
    twitter:   'twitter_followers',
  };
  const col = colMap[platform];
  if (!col) return;
  db.prepare(`UPDATE influencers SET ${col} = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(followerCount as P, influencerId as P);
}

function markSynced(socialAccountId: string, status = 'synced') {
  const db = getDb();
  db.prepare(`UPDATE social_accounts SET last_synced_at = datetime('now'), sync_status = ? WHERE id = ?`)
    .run(status as P, socialAccountId as P);
}

interface PlatformStats {
  follower_count: number;
  following_count?: number;
  post_count?: number;
  avg_engagement_rate?: number;
  avg_views?: number;
  avg_likes?: number;
  avg_comments?: number;
  audience_gender_male_pct?: number;
  audience_gender_female_pct?: number;
  audience_top_country_1?: string;
  audience_top_city_1?: string;
  platform_user_id?: string;
  platform_username?: string;
}

// ── Tier 1: OAuth syncs ───────────────────────────────────────────────────────

async function syncInstagram(influencerId: string, accessToken: string): Promise<PlatformStats | null> {
  try {
    // Using Facebook Business Login — token is a Facebook User Access Token.
    // Try to get Instagram Business Account linked via Facebook Pages.
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,instagram_business_account{id,username,followers_count,media_count,biography}&access_token=${accessToken}`
    );

    if (pagesRes.ok) {
      const pages = await pagesRes.json() as { data?: Array<Record<string, unknown>> };
      for (const page of pages.data || []) {
        const igAccount = page.instagram_business_account as Record<string, unknown> | undefined;
        if (igAccount?.id) {
          // Fetch recent media via Instagram Graph API using IG User ID
          try {
            const mediaRes = await fetch(
              `https://graph.facebook.com/v21.0/${igAccount.id}/media?fields=id,media_type,media_url,thumbnail_url,permalink,caption,like_count,comments_count,timestamp&limit=12&access_token=${accessToken}`
            );
            if (mediaRes.ok) {
              const media = await mediaRes.json() as { data?: Array<Record<string, unknown>> };
              if (media.data?.length) {
                storePosts(influencerId, 'instagram', media.data.map(p => ({
                  post_id:       String(p.id || ''),
                  post_url:      String(p.permalink || ''),
                  thumbnail_url: String(p.thumbnail_url || p.media_url || ''),
                  caption:       String(p.caption || '').slice(0, 500),
                  media_type:    String(p.media_type || 'IMAGE'),
                  likes:         Number(p.like_count) || 0,
                  comments:      Number(p.comments_count) || 0,
                  posted_at:     String(p.timestamp || ''),
                })));
              }
            }
          } catch { /* posts are best-effort */ }

          return {
            follower_count:    Number(igAccount.followers_count) || 0,
            post_count:        Number(igAccount.media_count) || undefined,
            platform_user_id:  String(igAccount.id),
            platform_username: String(igAccount.username || ''),
          };
        }
      }
    }

    // Fallback: store Facebook user info if no IG business account found
    const meRes = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${accessToken}`
    );
    if (meRes.ok) {
      const me = await meRes.json() as Record<string, unknown>;
      return {
        follower_count:    0,
        platform_user_id:  String(me.id || ''),
        platform_username: String(me.name || ''),
      };
    }

    return null;
  } catch { return null; }
}

async function syncTikTok(influencerId: string, accessToken: string): Promise<PlatformStats | null> {
  try {
    const res = await fetch(`${getPlatformConfig().tiktok.meUrl}?fields=open_id,union_id,avatar_url,display_name,bio_description,profile_deep_link,follower_count,following_count,likes_count,video_count`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: ['display_name', 'follower_count', 'following_count', 'likes_count', 'video_count'] }),
    });
    if (!res.ok) return null;
    const d = await res.json() as { data?: { user?: Record<string, unknown> } };
    const user = d.data?.user || {};

    // Fetch recent videos for top posts
    try {
      const vidRes = await fetch('https://open.tiktokapis.com/v2/video/list/?fields=id,title,cover_image_url,embed_link,video_description,like_count,comment_count,share_count,view_count,create_time', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_count: 12 }),
      });
      if (vidRes.ok) {
        const vd = await vidRes.json() as { data?: { videos?: Array<Record<string, unknown>> } };
        if (vd.data?.videos?.length) {
          storePosts(influencerId, 'tiktok', vd.data.videos.map(v => ({
            post_id:       String(v.id || ''),
            post_url:      String(v.embed_link || ''),
            thumbnail_url: String(v.cover_image_url || ''),
            caption:       String(v.title || v.video_description || '').slice(0, 500),
            media_type:    'VIDEO',
            likes:         Number(v.like_count) || 0,
            comments:      Number(v.comment_count) || 0,
            views:         Number(v.view_count) || 0,
            shares:        Number(v.share_count) || 0,
            posted_at:     v.create_time ? new Date(Number(v.create_time) * 1000).toISOString() : undefined,
          })));
        }
      }
    } catch { /* posts are best-effort */ }

    return {
      follower_count:  Number(user.follower_count)  || 0,
      following_count: Number(user.following_count) || undefined,
      post_count:      Number(user.video_count)     || undefined,
      platform_username: String(user.display_name  || ''),
    };
  } catch { return null; }
}

async function syncYouTube(influencerId: string, accessToken: string): Promise<PlatformStats | null> {
  try {
    const res = await fetch(
      `${getPlatformConfig().youtube.meUrl}?part=statistics,snippet,contentDetails&mine=true`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    if (!res.ok) return null;
    const d = await res.json() as { items?: Array<{ id?: string; statistics?: Record<string, unknown>; snippet?: Record<string, unknown>; contentDetails?: Record<string, unknown> }> };
    const item = d.items?.[0];
    if (!item) return null;
    const stats   = item.statistics || {};
    const snippet = item.snippet    || {};
    const channelId = item.id;

    // Fetch recent videos (uploads playlist → playlistItems)
    if (channelId) {
      try {
        // Get uploads playlist ID first
        const plRes = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        if (plRes.ok) {
          const plData = await plRes.json() as { items?: Array<{ contentDetails?: { relatedPlaylists?: Record<string, unknown> } }> };
          const uploadsId = plData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads as string | undefined;
          if (uploadsId) {
            const vidRes = await fetch(
              `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsId}&maxResults=12`,
              { headers: { 'Authorization': `Bearer ${accessToken}` } }
            );
            if (vidRes.ok) {
              const vd = await vidRes.json() as { items?: Array<Record<string, unknown>> };
              if (vd.items?.length) {
                // Fetch video stats in bulk
                const videoIds = vd.items.map(v => ((v.contentDetails as Record<string,unknown>)?.videoId as string) || '').filter(Boolean);
                const statsRes = await fetch(
                  `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds.join(',')}`,
                  { headers: { 'Authorization': `Bearer ${accessToken}` } }
                );
                if (statsRes.ok) {
                  const sd = await statsRes.json() as { items?: Array<Record<string, unknown>> };
                  if (sd.items?.length) {
                    storePosts(influencerId, 'youtube', sd.items.map(v => {
                      const vs = (v.statistics as Record<string,unknown>) || {};
                      const vsn = (v.snippet as Record<string,unknown>) || {};
                      const thumbs = (vsn.thumbnails as Record<string,Record<string,unknown>>) || {};
                      return {
                        post_id:       String(v.id || ''),
                        post_url:      `https://www.youtube.com/watch?v=${v.id}`,
                        thumbnail_url: String(thumbs.high?.url || thumbs.medium?.url || thumbs.default?.url || ''),
                        caption:       String(vsn.title || '').slice(0, 500),
                        media_type:    'VIDEO',
                        likes:         Number(vs.likeCount) || 0,
                        comments:      Number(vs.commentCount) || 0,
                        views:         Number(vs.viewCount) || 0,
                        posted_at:     String(vsn.publishedAt || ''),
                      };
                    }));
                  }
                }
              }
            }
          }
        }
      } catch { /* posts are best-effort */ }
    }

    return {
      follower_count: Number(stats.subscriberCount) || 0,
      post_count:     Number(stats.videoCount)      || undefined,
      platform_username: String(snippet.title || ''),
    };
  } catch { return null; }
}

async function syncSnapchat(influencerId: string, accessToken: string): Promise<PlatformStats | null> {
  try {
    const res = await fetch(getPlatformConfig().snapchat.meUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const d = await res.json() as { me?: Record<string, unknown> };
    const me = d.me || {};
    return {
      follower_count:  0, // Snapchat API doesn't expose follower count directly
      platform_user_id:  String(me.id || ''),
      platform_username: String(me.display_name || ''),
    };
  } catch { return null; }
}

async function syncTwitter(influencerId: string, accessToken: string): Promise<PlatformStats | null> {
  try {
    const res = await fetch(
      `${getPlatformConfig().twitter.meUrl}?user.fields=public_metrics,username`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    if (!res.ok) return null;
    const d = await res.json() as { data?: Record<string, unknown> };
    const user    = d.data || {};
    const metrics = (user.public_metrics as Record<string, unknown>) || {};
    const userId  = String(user.id || '');

    // Fetch recent tweets for top posts
    if (userId) {
      try {
        const tweetsRes = await fetch(
          `https://api.twitter.com/2/users/${userId}/tweets?max_results=12&tweet.fields=public_metrics,created_at,attachments&expansions=attachments.media_keys&media.fields=preview_image_url,url,type`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        if (tweetsRes.ok) {
          const td = await tweetsRes.json() as {
            data?: Array<Record<string, unknown>>;
            includes?: { media?: Array<Record<string, unknown>> };
          };
          if (td.data?.length) {
            const mediaMap: Record<string, Record<string, unknown>> = {};
            for (const m of td.includes?.media || []) {
              mediaMap[String(m.media_key || '')] = m;
            }
            storePosts(influencerId, 'twitter', td.data.map(t => {
              const pm = (t.public_metrics as Record<string, unknown>) || {};
              const attachments = (t.attachments as Record<string, unknown>) || {};
              const mediaKeys = (attachments.media_keys as string[]) || [];
              const firstMedia = mediaKeys.length ? mediaMap[mediaKeys[0]] : null;
              return {
                post_id:       String(t.id || ''),
                post_url:      `https://twitter.com/i/web/status/${t.id}`,
                thumbnail_url: String(firstMedia?.preview_image_url || firstMedia?.url || ''),
                caption:       String(t.text || '').slice(0, 500),
                media_type:    firstMedia?.type === 'video' ? 'VIDEO' : 'IMAGE',
                likes:         Number(pm.like_count) || 0,
                comments:      Number(pm.reply_count) || 0,
                views:         Number(pm.impression_count) || 0,
                shares:        Number(pm.retweet_count) || 0,
                posted_at:     String(t.created_at || ''),
              };
            }));
          }
        }
      } catch { /* tweets are best-effort */ }
    }

    return {
      follower_count:  Number(metrics.followers_count) || 0,
      following_count: Number(metrics.following_count) || undefined,
      post_count:      Number(metrics.tweet_count)     || undefined,
      platform_user_id:  userId,
      platform_username: String(user.username || ''),
    };
  } catch { return null; }
}

async function syncFacebook(influencerId: string, accessToken: string): Promise<PlatformStats | null> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/me?fields=id,name,followers_count,fan_count,picture&access_token=${accessToken}`
    );
    if (!res.ok) return null;
    const d = await res.json() as Record<string, unknown>;

    // Fetch recent posts
    try {
      const postsRes = await fetch(
        `https://graph.facebook.com/v18.0/me/posts?fields=id,message,full_picture,permalink_url,likes.summary(true),comments.summary(true),shares&limit=12&access_token=${accessToken}`
      );
      if (postsRes.ok) {
        const pd = await postsRes.json() as { data?: Array<Record<string, unknown>> };
        if (pd.data?.length) {
          storePosts(influencerId, 'facebook', pd.data.map(p => ({
            post_id:       String(p.id || ''),
            post_url:      String(p.permalink_url || ''),
            thumbnail_url: String(p.full_picture || ''),
            caption:       String(p.message || '').slice(0, 500),
            media_type:    'IMAGE',
            likes:         Number((p.likes as Record<string,unknown>)?.summary && ((p.likes as Record<string,unknown>).summary as Record<string,unknown>)?.total_count) || 0,
            comments:      Number((p.comments as Record<string,unknown>)?.summary && ((p.comments as Record<string,unknown>).summary as Record<string,unknown>)?.total_count) || 0,
            shares:        Number((p.shares as Record<string,unknown>)?.count) || 0,
          })));
        }
      }
    } catch { /* best-effort */ }

    return {
      follower_count:  Number(d.followers_count || d.fan_count) || 0,
      platform_user_id:  String(d.id || ''),
      platform_username: String(d.name || ''),
    };
  } catch { return null; }
}

const OAUTH_SYNCS: Record<PlatformKey, (id: string, token: string) => Promise<PlatformStats | null>> = {
  instagram: syncInstagram,
  tiktok:    syncTikTok,
  youtube:   syncYouTube,
  snapchat:  syncSnapchat,
  twitter:   syncTwitter,
  facebook:  syncFacebook,
};

// ── Public: sync a single social account ─────────────────────────────────────

export async function syncSocialAccount(socialAccountId: string): Promise<boolean> {
  const db = getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type P = any;
  const account = db.prepare('SELECT * FROM social_accounts WHERE id = ?')
    .get(socialAccountId as P) as Record<string, unknown> | undefined;
  if (!account) return false;

  const platform  = account.platform as PlatformKey;
  const influencerId = account.influencer_id as string;

  let accessToken = decryptToken(account.access_token as string);

  // Refresh if expired
  if (account.token_expiry) {
    const expiry = new Date(account.token_expiry as string).getTime();
    if (Date.now() > expiry - 5 * 60 * 1000 && account.refresh_token) {
      const refreshed = await refreshAccessToken(platform, decryptToken(account.refresh_token as string));
      if (refreshed) {
        accessToken = refreshed.access_token;
        const newExpiry = refreshed.expires_in
          ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
          : null;
        db.prepare(
          'UPDATE social_accounts SET access_token = ?, refresh_token = ?, token_expiry = ? WHERE id = ?'
        ).run(
          encryptToken(refreshed.access_token) as P,
          (refreshed.refresh_token ? encryptToken(refreshed.refresh_token) : account.refresh_token) as P,
          newExpiry as P,
          socialAccountId as P,
        );
      }
    }
  }

  const syncFn = OAUTH_SYNCS[platform];
  if (!syncFn) { markSynced(socialAccountId, 'unsupported'); return false; }

  const stats = await syncFn(influencerId, accessToken);
  if (!stats) { markSynced(socialAccountId, 'error'); return false; }

  storePlatformStats(influencerId, platform, stats, 'oauth');
  if (stats.follower_count) updateInfluencerFollowers(influencerId, platform, stats.follower_count);
  if (stats.platform_username) {
    db.prepare('UPDATE social_accounts SET platform_username = ? WHERE id = ?')
      .run(stats.platform_username as P, socialAccountId as P);
  }
  markSynced(socialAccountId, 'synced');
  calculateTrustScore(influencerId);
  return true;
}

// ── Public: sync all connected accounts (called by cron) ─────────────────────

export async function syncAllOAuthAccounts(): Promise<{ synced: number; errors: number }> {
  const db = getDb();
  const accounts = db.prepare(
    'SELECT id FROM social_accounts WHERE access_token IS NOT NULL AND sync_status != ?'
  ).all('unsupported' as P) as Array<{ id: string }>;

  let synced = 0, errors = 0;
  for (const { id } of accounts) {
    const ok = await syncSocialAccount(id);
    ok ? synced++ : errors++;
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }
  return { synced, errors };
}

// ── Tier 2: RapidAPI scraper sync ─────────────────────────────────────────────

export async function syncViaScraperByHandle(
  influencerId: string,
  platform: 'instagram' | 'tiktok',
  handle: string,
): Promise<boolean> {
  const db = getDb();
  const settings = db.prepare('SELECT value FROM settings WHERE key = ?')
    .get('rapidapi_key' as P) as { value: string } | undefined;
  const apiKey = settings?.value;
  if (!apiKey) return false;

  try {
    let followerCount: number | null = null;

    if (platform === 'instagram') {
      const res = await fetch(
        `https://instagram-scraper-api2.p.rapidapi.com/v1/info?username_or_id_or_url=${handle}`,
        { headers: { 'x-rapidapi-host': 'instagram-scraper-api2.p.rapidapi.com', 'x-rapidapi-key': apiKey } }
      );
      if (res.ok) {
        const d = await res.json() as { data?: Record<string, unknown> };
        followerCount = Number(d.data?.follower_count) || null;
      }
    }

    if (platform === 'tiktok') {
      const res = await fetch(
        `https://tiktok-api23.p.rapidapi.com/api/user/info?uniqueId=${handle}`,
        { headers: { 'x-rapidapi-host': 'tiktok-api23.p.rapidapi.com', 'x-rapidapi-key': apiKey } }
      );
      if (res.ok) {
        const d = await res.json() as { userInfo?: { stats?: Record<string, unknown> } };
        followerCount = Number(d.userInfo?.stats?.followerCount) || null;
      }
    }

    if (followerCount !== null) {
      storePlatformStats(influencerId, platform, { follower_count: followerCount }, 'scraper');
      updateInfluencerFollowers(influencerId, platform, followerCount);
      return true;
    }
  } catch { /* silent */ }
  return false;
}

// ── Trust Score calculation ───────────────────────────────────────────────────

export function calculateTrustScore(influencerId: string): void {
  const db = getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type P = any;

  const inf = db.prepare('SELECT * FROM influencers WHERE id = ?')
    .get(influencerId as P) as Record<string, unknown> | undefined;
  if (!inf) return;

  // Get latest stats
  const stats = db.prepare(
    'SELECT * FROM platform_stats WHERE influencer_id = ? ORDER BY captured_at DESC LIMIT 1'
  ).get(influencerId as P) as Record<string, unknown> | undefined;

  let score = 0;

  // 1. Engagement ratio (30%) — compare to tier benchmarks
  const followers = Number(inf.ig_followers || inf.tiktok_followers || 0);
  const engRate   = Number(stats?.avg_engagement_rate || inf.ig_engagement_rate || 0);
  const benchmarks: Record<string, number> = { nano: 5, micro: 3, macro: 1.5, mega: 0.8 };
  const tier = followers < 10_000 ? 'nano' : followers < 100_000 ? 'micro' : followers < 1_000_000 ? 'macro' : 'mega';
  const benchmark = benchmarks[tier];
  const engScore = benchmark > 0 ? Math.min(30, (engRate / benchmark) * 30) : 0;
  score += engScore;

  // 2. Account age vs follower count (15%) — penalize new accounts with huge following
  const createdAt  = inf.created_at ? new Date(inf.created_at as string) : new Date();
  const ageMonths  = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30);
  const expectedGrowthPerMonth = tier === 'mega' ? 50_000 : tier === 'macro' ? 5_000 : 500;
  const expectedFollowers = ageMonths * expectedGrowthPerMonth;
  const ageScore = expectedFollowers > 0
    ? Math.min(15, (Math.min(followers, expectedFollowers) / expectedFollowers) * 15)
    : 7.5; // neutral if no data
  score += ageScore;

  // 3. Data freshness / consistency (10%) — has recent platform_stats entry
  const hasRecentStats = stats
    ? (Date.now() - new Date(stats.captured_at as string).getTime()) < 30 * 24 * 60 * 60 * 1000
    : false;
  score += hasRecentStats ? 10 : 0;

  // 4. Platform verified badge (10%) — from OAuth data
  const isVerified = Number(inf.mawthouq_certificate) === 1;
  score += isVerified ? 5 : 0; // partial (full 10 only if officially verified via OAuth)

  // 5. Mawthouq badge (10%)
  score += isVerified ? 10 : 0;

  // 6. Profile completeness (25%) — more complete = more trustworthy
  const fields = ['name_english', 'profile_photo_url', 'ig_handle', 'main_category', 'ig_rate', 'email'];
  const filled  = fields.filter(f => inf[f]).length;
  score += (filled / fields.length) * 25;

  score = Math.round(Math.min(100, Math.max(0, score)));
  const tier_label = score >= 80 ? 'TRUSTED' : score >= 60 ? 'VERIFIED' : score >= 40 ? 'CAUTION' : 'FLAGGED';

  // Upsert trust score
  const existing = db.prepare('SELECT id FROM trust_scores WHERE influencer_id = ?')
    .get(influencerId as P) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      'UPDATE trust_scores SET score = ?, tier = ?, engagement_ratio_score = ?, account_age_score = ?, mawthouq_score = ?, calculated_at = datetime(\'now\') WHERE influencer_id = ?'
    ).run(score as P, tier_label as P, engScore as P, ageScore as P, isVerified ? 10 : 0 as P, influencerId as P);
  } else {
    const id = uuidv4();
    db.prepare(
      'INSERT INTO trust_scores (id, influencer_id, score, tier, engagement_ratio_score, account_age_score, mawthouq_score) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id as P, influencerId as P, score as P, tier_label as P, engScore as P, ageScore as P, isVerified ? 10 : 0 as P);
  }

  // Also update shorthand on influencers table
  db.prepare('UPDATE influencers SET trust_score = ?, trust_tier = ? WHERE id = ?')
    .run(score as P, tier_label as P, influencerId as P);
}

// ── Bulk trust score recalculation (for cron) ─────────────────────────────────

export async function recalculateAllTrustScores(): Promise<number> {
  const db = getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type P = any;
  const ids = db.prepare('SELECT id FROM influencers WHERE is_archived = 0')
    .all() as Array<{ id: string }>;
  for (const { id } of ids) {
    calculateTrustScore(id);
  }
  return ids.length;
}
