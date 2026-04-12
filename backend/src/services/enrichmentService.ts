import { db } from '../db/connection';

interface EnrichmentResult {
  id: string;
  updated: Record<string, unknown>;
  source: string;
  error?: string;
}

/**
 * Try to enrich a single influencer by scraping public social profiles.
 * Uses RapidAPI if key is configured, falls back to public page scraping.
 */
export async function enrichInfluencer(influencer: Record<string, unknown>): Promise<EnrichmentResult> {
  const settings = await db.all('SELECT key, value FROM settings', []) as { key: string; value: string }[];
  const settingsMap: Record<string, string> = {};
  settings.forEach(s => { settingsMap[s.key] = s.value; });

  const rapidApiKey = settingsMap.rapidapi_key;
  const updates: Record<string, unknown> = {};
  let source = 'none';

  try {
    // Try Instagram enrichment
    if (influencer.ig_handle && !influencer.ig_followers) {
      const igData = rapidApiKey
        ? await enrichViaRapidApi(String(influencer.ig_handle), 'instagram', rapidApiKey)
        : await enrichViaPublicPage(String(influencer.ig_handle), 'instagram');

      if (igData) {
        if (igData.followers) updates.ig_followers = igData.followers;
        if (igData.profilePic) updates.profile_photo_url = igData.profilePic;
        if (igData.bio) updates.internal_notes = (influencer.internal_notes ? influencer.internal_notes + '\n' : '') + `[IG Bio] ${igData.bio}`;
        source = 'instagram';
      }
    }

    // Try TikTok enrichment
    if (influencer.tiktok_handle && !influencer.tiktok_followers) {
      const ttData = rapidApiKey
        ? await enrichViaRapidApi(String(influencer.tiktok_handle), 'tiktok', rapidApiKey)
        : await enrichViaPublicPage(String(influencer.tiktok_handle), 'tiktok');

      if (ttData) {
        if (ttData.followers) updates.tiktok_followers = ttData.followers;
        if (ttData.profilePic && !updates.profile_photo_url) updates.profile_photo_url = ttData.profilePic;
        source = source === 'none' ? 'tiktok' : source + ',tiktok';
      }
    }

    if (Object.keys(updates).length > 0) {
      updates.last_enriched_at = new Date().toISOString();
      updates.enrichment_status = 'enriched';

      const fields = Object.keys(updates);
      const set = fields.map(f => `${f} = ?`).join(', ');
      const vals = fields.map(f => updates[f]);

      await db.run(`UPDATE influencers SET ${set}, updated_at = NOW() WHERE id = ?`, [...vals, influencer.id as string]);
    } else {
      await db.run(`UPDATE influencers SET enrichment_status = 'lookup_failed', last_enriched_at = NOW() WHERE id = ?`, [influencer.id as string]);
    }

    return { id: influencer.id as string, updated: updates, source };

  } catch (err) {
    await db.run(`UPDATE influencers SET enrichment_status = 'error', last_enriched_at = NOW() WHERE id = ?`, [influencer.id as string]);
    return { id: influencer.id as string, updated: {}, source: 'error', error: (err as Error).message };
  }
}

async function enrichViaRapidApi(
  handle: string,
  platform: 'instagram' | 'tiktok',
  apiKey: string
): Promise<{ followers?: number; profilePic?: string; bio?: string } | null> {
  try {
    const { default: fetch } = await import('node-fetch');

    if (platform === 'instagram') {
      const url = `https://instagram-scraper-api2.p.rapidapi.com/v1/info?username_or_id_or_url=${handle}`;
      const resp = await fetch(url, {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'instagram-scraper-api2.p.rapidapi.com'
        }
      });
      if (!resp.ok) return null;
      const data = await resp.json() as Record<string, unknown>;
      const user = (data.data as Record<string, unknown>) || data;
      return {
        followers: Number((user.follower_count as number) || (user.edge_followed_by as Record<string, number>)?.count || 0) || undefined,
        profilePic: String(user.profile_pic_url || user.hd_profile_pic_url || ''),
        bio: String(user.biography || '')
      };
    }

    if (platform === 'tiktok') {
      const url = `https://tiktok-api23.p.rapidapi.com/api/user/info?uniqueId=${handle}`;
      const resp = await fetch(url, {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'tiktok-api23.p.rapidapi.com'
        }
      });
      if (!resp.ok) return null;
      const data = await resp.json() as Record<string, unknown>;
      const user = (data.userInfo as Record<string, unknown>)?.user as Record<string, unknown> || {};
      const stats = (data.userInfo as Record<string, unknown>)?.stats as Record<string, unknown> || {};
      return {
        followers: Number(stats.followerCount || 0) || undefined,
        profilePic: String(user.avatarLarger || user.avatarMedium || ''),
        bio: String(user.signature || '')
      };
    }

    return null;
  } catch {
    return null;
  }
}

async function enrichViaPublicPage(
  handle: string,
  platform: 'instagram' | 'tiktok'
): Promise<{ followers?: number; profilePic?: string; bio?: string } | null> {
  try {
    const { default: fetch } = await import('node-fetch');
    const { load } = await import('cheerio');

    if (platform === 'instagram') {
      const url = `https://www.instagram.com/${handle}/?__a=1&__d=dis`;
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      });
      if (!resp.ok) return null;
      const text = await resp.text();
      try {
        const data = JSON.parse(text) as Record<string, unknown>;
        const user = (data.graphql as Record<string, unknown>)?.user as Record<string, unknown> || {};
        return {
          followers: Number((user.edge_followed_by as Record<string, number>)?.count || 0) || undefined,
          profilePic: String(user.profile_pic_url || ''),
          bio: String(user.biography || '')
        };
      } catch {
        // Try scraping HTML for meta tags
        const htmlResp = await fetch(`https://www.instagram.com/${handle}/`, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await htmlResp.text();
        const $ = load(html);
        const desc = $('meta[name="description"]').attr('content') || '';
        const followersMatch = desc.match(/([\d,]+)\s*Followers/i);
        return {
          followers: followersMatch ? parseInt(followersMatch[1].replace(/,/g, '')) : undefined
        };
      }
    }

    if (platform === 'tiktok') {
      const resp = await fetch(`https://www.tiktok.com/@${handle}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      if (!resp.ok) return null;
      const html = await resp.text();
      const $ = load(html);
      const desc = $('meta[name="description"]').attr('content') || '';
      const followersMatch = desc.match(/([\d,.]+[KMB]?)\s*Followers/i);
      if (followersMatch) {
        const str = followersMatch[1].toUpperCase().replace(/,/g, '');
        let followers: number | undefined;
        if (str.endsWith('M')) followers = parseFloat(str) * 1000000;
        else if (str.endsWith('K')) followers = parseFloat(str) * 1000;
        else if (str.endsWith('B')) followers = parseFloat(str) * 1000000000;
        else followers = parseInt(str);
        return { followers: isNaN(followers) ? undefined : followers };
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function bulkEnrich(ids?: string[]): Promise<void> {
  let influencers: Record<string, unknown>[];
  if (ids && ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',');
    influencers = await db.all(`SELECT * FROM influencers WHERE id IN (${placeholders}) AND is_archived = 0`, ids) as Record<string, unknown>[];
  } else {
    influencers = await db.all(`
      SELECT * FROM influencers
      WHERE is_archived = 0
        AND (ig_handle IS NOT NULL OR tiktok_handle IS NOT NULL)
        AND (enrichment_status = 'pending' OR enrichment_status IS NULL)
      LIMIT 50
    `, []) as Record<string, unknown>[];
  }

  for (const inf of influencers) {
    await enrichInfluencer(inf);
    // Rate limiting: wait 1s between requests
    await new Promise(r => setTimeout(r, 1000));
  }
}
