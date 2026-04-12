import { db } from '../db/connection';

export interface DiscoveredInfluencer {
  platform: 'instagram' | 'tiktok';
  handle: string;
  display_name?: string;
  bio?: string;
  followers?: number;
  following?: number;
  posts_count?: number;
  engagement_rate?: number;
  profile_pic?: string;
  profile_url: string;
  is_verified?: boolean;
  category?: string;
  country?: string;
  /** true if this handle already exists in our DB */
  already_imported: boolean;
}

async function getRapidApiKey(): Promise<string | null> {
  const row = await db.get(`SELECT value FROM settings WHERE key = 'rapidapi_key'`, []) as { value: string } | undefined;
  return row?.value || null;
}

/** Search Instagram users / hashtag authors via RapidAPI */
async function searchInstagram(
  query: string,
  limit: number,
  apiKey: string
): Promise<DiscoveredInfluencer[]> {
  const { default: fetch } = await import('node-fetch');
  const results: DiscoveredInfluencer[] = [];

  // Instagram Scraper Stable API
  try {
    const url = `https://instagram-scraper-stable-api.p.rapidapi.com/v1/search_users?search_query=${encodeURIComponent(query)}&count=${limit}`;
    const resp = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'instagram-scraper-stable-api.p.rapidapi.com'
      }
    });
    if (resp.ok) {
      const data = await resp.json() as Record<string, unknown>;
      const users = ((data.data as Record<string, unknown>)?.items as Record<string, unknown>[])
        || (data.users as Record<string, unknown>[])
        || [];
      for (const u of users.slice(0, limit)) {
        const handle = String(u.username || '');
        if (!handle) continue;
        results.push({
          platform: 'instagram',
          handle,
          display_name: String(u.full_name || ''),
          followers: Number(u.follower_count || 0) || undefined,
          following: Number(u.following_count || 0) || undefined,
          profile_pic: String(u.profile_pic_url || ''),
          is_verified: Boolean(u.is_verified || u.is_blue_verified),
          profile_url: `https://instagram.com/${handle}`,
          already_imported: false,
        });
      }
    }
  } catch { /* ignore */ }

  return results;
}

/** Search TikTok users via RapidAPI */
async function searchTikTok(
  query: string,
  limit: number,
  apiKey: string
): Promise<DiscoveredInfluencer[]> {
  const { default: fetch } = await import('node-fetch');
  const results: DiscoveredInfluencer[] = [];

  try {
    // tikwm Tiktok Scraper API
    const url = `https://tiktok-scraper7.p.rapidapi.com/user/search?keywords=${encodeURIComponent(query)}&count=${limit}&cursor=0`;
    const resp = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'tiktok-scraper7.p.rapidapi.com'
      }
    });
    if (resp.ok) {
      const data = await resp.json() as Record<string, unknown>;
      const items = ((data.data as Record<string, unknown>)?.user_list as Record<string, unknown>[]) || (data.user_list as Record<string, unknown>[]) || [];
      for (const item of items.slice(0, limit)) {
        const user = (item.user_info as Record<string, unknown>) || (item.user as Record<string, unknown>) || {};
        const stats = (item.stats as Record<string, unknown>) || {};
        const handle = String(user.unique_id || user.uniqueId || '');
        if (!handle) continue;
        results.push({
          platform: 'tiktok',
          handle,
          display_name: String(user.nickname || ''),
          bio: String(user.signature || ''),
          followers: Number(user.follower_count || stats.followerCount || 0) || undefined,
          following: Number(user.following_count || stats.followingCount || 0) || undefined,
          posts_count: Number(user.aweme_count || stats.videoCount || 0) || undefined,
          profile_pic: String(user.avatar_thumb || user.avatarThumb || ''),
          is_verified: Boolean(user.verified),
          profile_url: `https://tiktok.com/@${handle}`,
          already_imported: false,
        });
      }
    }
  } catch { /* ignore */ }

  return results;
}

/** Mark which handles are already in our database */
async function markAlreadyImported(results: DiscoveredInfluencer[]): Promise<void> {
  for (const r of results) {
    const col = r.platform === 'instagram' ? 'ig_handle' : 'tiktok_handle';
    const existing = await db.get(`SELECT id FROM influencers WHERE ${col} = ? AND is_archived = 0`, [r.handle]);
    r.already_imported = !!existing;
  }
}

export async function discoverInfluencers(
  query: string,
  platform: string,
  limit = 20
): Promise<{ results: DiscoveredInfluencer[]; error?: string }> {
  const apiKey = await getRapidApiKey();
  if (!apiKey) {
    return { results: [], error: 'No RapidAPI key configured. Add it in Settings.' };
  }

  const results: DiscoveredInfluencer[] = [];
  const isBothOrAll = platform === 'both' || platform === 'all';

  if (platform === 'instagram' || isBothOrAll) {
    const ig = await searchInstagram(query, isBothOrAll ? Math.floor(limit / 2) : limit, apiKey);
    results.push(...ig);
  }

  if (platform === 'tiktok' || isBothOrAll) {
    const tt = await searchTikTok(query, isBothOrAll ? Math.floor(limit / 2) : limit, apiKey);
    results.push(...tt);
  }

  await markAlreadyImported(results);
  return { results };
}

/** Fetch a single profile's full data and upsert into DB */
export async function importDiscoveredInfluencer(
  platform: 'instagram' | 'tiktok',
  handle: string
): Promise<{ id: string; created: boolean }> {
  const { default: fetch } = await import('node-fetch');
  const { v4: uuidv4 } = await import('uuid');
  const apiKey = await getRapidApiKey();

  const col = platform === 'instagram' ? 'ig_handle' : 'tiktok_handle';
  const existing = await db.get(`SELECT id FROM influencers WHERE ${col} = ? AND is_archived = 0`, [handle]) as { id: string } | undefined;

  const profileData: Record<string, unknown> = {
    [col]: handle,
  };

  if (apiKey) {
    try {
      if (platform === 'instagram') {
        const url = `https://instagram-scraper-stable-api.p.rapidapi.com/v1/info?username_or_id_or_url=${handle}`;
        const resp = await fetch(url, {
          headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': 'instagram-scraper-stable-api.p.rapidapi.com' }
        });
        if (resp.ok) {
          const data = await resp.json() as Record<string, unknown>;
          const u = (data.data as Record<string, unknown>) || data;
          if (u.follower_count) profileData.ig_followers = Number(u.follower_count);
          if (u.profile_pic_url) profileData.profile_photo_url = String(u.profile_pic_url);
          if (u.full_name) profileData.name_english = String(u.full_name);
          if (u.biography) profileData.internal_notes = `[IG Bio] ${u.biography}`;
          profileData.ig_url = `https://instagram.com/${handle}`;
        }
      } else {
        const url = `https://tiktok-scraper7.p.rapidapi.com/user/info?unique_id=${handle}`;
        const resp = await fetch(url, {
          headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': 'tiktok-scraper7.p.rapidapi.com' }
        });
        if (resp.ok) {
          const data = await resp.json() as Record<string, unknown>;
          const u = ((data.data as Record<string, unknown>)?.user as Record<string, unknown>) || {};
          const stats = ((data.data as Record<string, unknown>)?.stats as Record<string, unknown>) || {};
          if (stats.followerCount) profileData.tiktok_followers = Number(stats.followerCount);
          if (u.avatarThumb || u.avatar_thumb) profileData.profile_photo_url = String(u.avatarThumb || u.avatar_thumb);
          if (u.nickname) profileData.name_english = String(u.nickname);
          if (u.signature) profileData.internal_notes = `[TikTok Bio] ${u.signature}`;
          profileData.tiktok_url = `https://tiktok.com/@${handle}`;
        }
      }
    } catch { /* proceed with minimal data */ }
  }

  if (existing) {
    // Update existing record
    const fields = Object.keys(profileData).filter(k => k !== col);
    if (fields.length > 0) {
      const set = fields.map(f => `${f} = ?`).join(', ');
      const vals = fields.map(f => profileData[f]);
      await db.run(`UPDATE influencers SET ${set}, updated_at = NOW() WHERE id = ?`, [...vals, existing.id]);
    }
    return { id: existing.id, created: false };
  }

  // Insert new record
  const id = uuidv4();
  profileData.id = id;
  profileData.enrichment_status = 'enriched';
  profileData.supplier_source = 'Discovery';
  profileData.last_enriched_at = new Date().toISOString();

  const fields = Object.keys(profileData);
  const placeholders = fields.map(() => '?').join(', ');
  const vals = fields.map(f => profileData[f]);
  await db.run(`INSERT INTO influencers (${fields.join(', ')}) VALUES (${placeholders})`, vals);

  return { id, created: true };
}
