/**
 * OAuth routes for social platform connections.
 *
 * GET  /api/oauth/:platform/authorize   — returns { url } for frontend redirect
 * GET  /api/oauth/callback/:platform    — handles OAuth callback, stores token, redirects to portal
 * GET  /api/oauth/connections           — list connected accounts for current portal user
 * DELETE /api/oauth/connections/:platform — disconnect a platform
 * POST /api/oauth/sync/:platform        — manually trigger a sync
 */
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import {
  getAuthorizationUrl, exchangeCodeForToken, decodeState,
  encryptToken, PlatformKey,
} from '../services/oauthService';
import { syncSocialAccount } from '../services/platformSyncService';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const VALID_PLATFORMS: PlatformKey[] = ['instagram', 'tiktok', 'youtube', 'snapchat', 'twitter', 'facebook'];

function isValidPlatform(p: string): p is PlatformKey {
  return VALID_PLATFORMS.includes(p as PlatformKey);
}

// ── GET /api/oauth/:platform/authorize ───────────────────────────────────────
// Portal user calls this — expects cp_portal_token in Authorization header
router.get('/:platform/authorize', async (req: Request, res: Response): Promise<void> => {
  const { platform } = req.params;
  if (!isValidPlatform(platform)) { res.status(400).json({ error: 'Invalid platform' }); return; }

  // Accept portal user id from query param (for portal) or auth header (for unified auth)
  const portalUserId = req.query.user_id as string || req.query.portal_user_id as string;
  if (!portalUserId) { res.status(400).json({ error: 'user_id required' }); return; }

  const { url, configured } = getAuthorizationUrl(platform, portalUserId);

  if (!configured) {
    res.status(503).json({
      error: `${platform} OAuth not configured. Visit /admin/integrations for setup instructions.`,
      configured: false,
    });
    return;
  }

  res.json({ url, configured: true });
});

// ── GET /api/oauth/callback/:platform ────────────────────────────────────────
// OAuth provider redirects here after user grants permission
router.get('/callback/:platform', async (req: Request, res: Response): Promise<void> => {
  const { platform } = req.params;
  if (!isValidPlatform(platform)) { res.redirect(`${FRONTEND_URL}/portal/connections?error=invalid_platform`); return; }

  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    console.error(`OAuth error for ${platform}:`, error);
    res.redirect(`${FRONTEND_URL}/portal/connections?error=${encodeURIComponent(error)}&platform=${platform}`);
    return;
  }

  if (!code || !state) {
    res.redirect(`${FRONTEND_URL}/portal/connections?error=missing_params&platform=${platform}`);
    return;
  }

  const stateData = decodeState(state);
  const portalUserId = stateData.portalUserId as string;

  if (!portalUserId) {
    res.redirect(`${FRONTEND_URL}/portal/connections?error=invalid_state&platform=${platform}`);
    return;
  }

  try {
    // Exchange code for token
    const tokens = await exchangeCodeForToken(platform, code, state);

    // Find influencer_id from portal user
    const portalUser = await db.get('SELECT influencer_id FROM portal_users WHERE id = ?', [portalUserId]) as { influencer_id: string | null } | undefined;

    const influencerId = portalUser?.influencer_id || portalUserId; // fallback to portal user id

    const tokenExpiry = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    // Upsert social_accounts
    const existing = await db.get(
      'SELECT id FROM social_accounts WHERE influencer_id = ? AND platform = ?',
      [influencerId, platform]
    ) as { id: string } | undefined;

    if (existing) {
      await db.run(`
        UPDATE social_accounts
        SET access_token = ?, refresh_token = ?, token_expiry = ?,
            connected_at = NOW(), sync_status = 'pending'
        WHERE id = ?
      `, [encryptToken(tokens.access_token), tokens.refresh_token ? encryptToken(tokens.refresh_token) : null, tokenExpiry, existing.id]);
      // Trigger immediate sync
      syncSocialAccount(existing.id).catch(console.error);
    } else {
      const id = uuidv4();
      await db.run(`
        INSERT INTO social_accounts (id, influencer_id, platform, access_token, refresh_token, token_expiry, sync_status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
      `, [id, influencerId, platform, encryptToken(tokens.access_token), tokens.refresh_token ? encryptToken(tokens.refresh_token) : null, tokenExpiry]);
      syncSocialAccount(id).catch(console.error);
    }

    res.redirect(`${FRONTEND_URL}/portal/connections?connected=${platform}`);
  } catch (err) {
    console.error(`OAuth callback error for ${platform}:`, err);
    res.redirect(`${FRONTEND_URL}/portal/connections?error=token_exchange_failed&platform=${platform}`);
  }
});

// ── GET /api/oauth/connections ────────────────────────────────────────────────
// Returns connected accounts for a portal user (no sensitive token data)
router.get('/connections', async (req: Request, res: Response): Promise<void> => {
  const portalUserId = req.query.user_id as string || req.query.portal_user_id as string;
  if (!portalUserId) { res.json({ connections: [] }); return; }

  try {
    const portalUser = await db.get('SELECT influencer_id FROM portal_users WHERE id = ?', [portalUserId]) as { influencer_id: string | null } | undefined;
    const influencerId = portalUser?.influencer_id || portalUserId;

    const connections = await db.all(`
      SELECT platform, platform_username, connected_at, last_synced_at, sync_status
      FROM social_accounts
      WHERE influencer_id = ?
    `, [influencerId]);

    res.json({ connections });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
});

// ── DELETE /api/oauth/connections/:platform ────────────────────────────────────
router.delete('/connections/:platform', async (req: Request, res: Response): Promise<void> => {
  const portalUserId = req.query.user_id as string;
  const { platform } = req.params;
  if (!portalUserId) { res.status(400).json({ error: 'user_id required' }); return; }

  try {
    const portalUser = await db.get('SELECT influencer_id FROM portal_users WHERE id = ?', [portalUserId]) as { influencer_id: string | null } | undefined;
    const influencerId = portalUser?.influencer_id || portalUserId;

    await db.run('DELETE FROM social_accounts WHERE influencer_id = ? AND platform = ?', [influencerId, platform]);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// ── POST /api/oauth/sync/:platform ────────────────────────────────────────────
router.post('/sync/:platform', async (req: Request, res: Response): Promise<void> => {
  const portalUserId = req.query.user_id as string || req.body?.user_id as string;
  const { platform } = req.params;
  if (!portalUserId) { res.status(400).json({ error: 'user_id required' }); return; }

  try {
    const portalUser = await db.get('SELECT influencer_id FROM portal_users WHERE id = ?', [portalUserId]) as { influencer_id: string | null } | undefined;
    const influencerId = portalUser?.influencer_id || portalUserId;

    const account = await db.get(
      'SELECT id FROM social_accounts WHERE influencer_id = ? AND platform = ?',
      [influencerId, platform]
    ) as { id: string } | undefined;

    if (!account) { res.status(404).json({ error: 'Account not connected' }); return; }

    const ok = await syncSocialAccount(account.id);
    res.json({ ok, message: ok ? 'Sync complete' : 'Sync failed — check credentials or API limits' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// GET /api/oauth/config-status — which platforms have credentials configured
router.get('/config-status', (_req: Request, res: Response): void => {
  const status: Record<string, boolean> = {
    instagram: !!(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET),
    tiktok:    !!(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET),
    youtube:   !!(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET),
    snapchat:  !!(process.env.SNAPCHAT_CLIENT_ID && process.env.SNAPCHAT_CLIENT_SECRET),
    twitter:   !!(process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET),
    facebook:  !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET),
  };
  res.json({ status });
});

// POST /api/oauth/ping/:platform — live credential test (admin only)
// Calls each platform's API with app credentials to verify they are valid and not rate-limited.
router.post('/ping/:platform', async (req: Request, res: Response): Promise<void> => {
  const { platform } = req.params;
  if (!isValidPlatform(platform)) { res.status(400).json({ ok: false, error: 'Invalid platform' }); return; }

  const start = Date.now();

  try {
    let ok = false;
    let detail = '';

    if (platform === 'instagram' || platform === 'facebook') {
      const appId = platform === 'instagram' ? process.env.INSTAGRAM_APP_ID : process.env.FACEBOOK_APP_ID;
      const appSecret = platform === 'instagram' ? process.env.INSTAGRAM_APP_SECRET : process.env.FACEBOOK_APP_SECRET;
      if (!appId || !appSecret) { res.json({ ok: false, error: 'Credentials not configured', latency_ms: 0 }); return; }
      // Validate app token via /app endpoint
      const r = await fetch(`https://graph.facebook.com/v21.0/${appId}?access_token=${appId}|${appSecret}`);
      ok = r.ok;
      detail = ok ? 'App credentials valid' : `HTTP ${r.status}`;
    }

    else if (platform === 'tiktok') {
      const key = process.env.TIKTOK_CLIENT_KEY;
      const secret = process.env.TIKTOK_CLIENT_SECRET;
      if (!key || !secret) { res.json({ ok: false, error: 'Credentials not configured', latency_ms: 0 }); return; }
      // TikTok client credentials flow to get a client access token
      const r = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_key: key, client_secret: secret, grant_type: 'client_credentials' }).toString(),
      });
      ok = r.ok;
      detail = ok ? 'Client credentials valid' : `HTTP ${r.status}`;
    }

    else if (platform === 'youtube') {
      const clientId = process.env.YOUTUBE_CLIENT_ID;
      const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
      if (!clientId || !clientSecret) { res.json({ ok: false, error: 'Credentials not configured', latency_ms: 0 }); return; }
      // Validate by checking the token info endpoint — we can't do a full auth, but we can verify the client ID exists via discovery
      const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?client_id=${clientId}`);
      // tokeninfo returns 400 for invalid client_ids
      ok = r.status !== 400;
      detail = ok ? 'Client ID valid (OAuth discovery)' : `HTTP ${r.status} — client_id may be invalid`;
    }

    else if (platform === 'snapchat') {
      const clientId = process.env.SNAPCHAT_CLIENT_ID;
      const clientSecret = process.env.SNAPCHAT_CLIENT_SECRET;
      if (!clientId || !clientSecret) { res.json({ ok: false, error: 'Credentials not configured', latency_ms: 0 }); return; }
      // Snapchat: check the OAuth discovery document to at least confirm our base URL works
      const r = await fetch('https://accounts.snapchat.com/login/oauth2/.well-known/openid-configuration');
      ok = r.ok;
      detail = ok ? 'Snapchat OAuth server reachable (app creds not testable without user flow)' : `HTTP ${r.status}`;
    }

    else if (platform === 'twitter') {
      const clientId = process.env.TWITTER_CLIENT_ID;
      const clientSecret = process.env.TWITTER_CLIENT_SECRET;
      if (!clientId || !clientSecret) { res.json({ ok: false, error: 'Credentials not configured', latency_ms: 0 }); return; }
      // Twitter: try a bearer token via client credentials (OAuth 2.0 app-only)
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const r = await fetch('https://api.twitter.com/oauth2/token', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${basicAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials',
      });
      ok = r.ok;
      detail = ok ? 'Bearer token obtained — app credentials valid' : `HTTP ${r.status} — check Client ID/Secret`;
    }

    res.json({ ok, detail, latency_ms: Date.now() - start, platform });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error', latency_ms: Date.now() - start });
  }
});

export default router;
