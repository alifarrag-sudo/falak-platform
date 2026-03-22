/**
 * OAuth 2.0 service for all 5 social platforms.
 * Handles: authorization URL generation, code exchange, token refresh, AES-256 encryption.
 *
 * State parameter is base64url-encoded JSON containing { portalUserId, platform, nonce }.
 * For Twitter (PKCE), the codeVerifier is stored in memory with 10-minute TTL.
 *
 * Tokens are AES-256-CBC encrypted before storage in the social_accounts table.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import fetch from 'node-fetch';

// ── Encryption ────────────────────────────────────────────────────────────────

if (!process.env.TOKEN_ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
  console.error('[FATAL] TOKEN_ENCRYPTION_KEY is not set in production. All stored tokens are insecure. Set a 32-character random string immediately.');
  process.exit(1);
}
if (!process.env.TOKEN_ENCRYPTION_KEY) {
  console.warn('[WARN] TOKEN_ENCRYPTION_KEY not set — using insecure default. Set this in your .env file.');
}

const ENC_KEY_RAW = process.env.TOKEN_ENCRYPTION_KEY || 'cp-nsm-32-char-key-change-prod!!';
const ENC_KEY = Buffer.from(ENC_KEY_RAW, 'utf8').slice(0, 32); // ensure 32 bytes for AES-256

export function encryptToken(plain: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', ENC_KEY, iv);
  let enc = cipher.update(plain, 'utf8', 'hex');
  enc += cipher.final('hex');
  return iv.toString('hex') + ':' + enc;
}

export function decryptToken(encrypted: string): string {
  const [ivHex, enc] = encrypted.split(':');
  if (!ivHex || !enc) return encrypted; // not encrypted, return as-is
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', ENC_KEY, iv);
  let dec = decipher.update(enc, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

// ── PKCE (Twitter) ────────────────────────────────────────────────────────────

// In-memory PKCE store: state → { verifier, portalUserId, expiresAt }
const pkceStore = new Map<string, { verifier: string; portalUserId: string; expiresAt: number }>();

function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function cleanExpiredPKCE() {
  const now = Date.now();
  for (const [k, v] of pkceStore) {
    if (v.expiresAt < now) pkceStore.delete(k);
  }
}

// ── State ─────────────────────────────────────────────────────────────────────

export function encodeState(data: object): string {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

export function decodeState(state: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
  } catch {
    return {};
  }
}

// ── Platform config ───────────────────────────────────────────────────────────
// Built lazily so dotenv has loaded by the time this is first called.

export type PlatformKey = 'instagram' | 'tiktok' | 'youtube' | 'snapchat' | 'twitter' | 'facebook';

function buildPlatformConfig() {
  const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
  return {
    instagram: {
      // Instagram via Facebook Business Login (Business app type, 2024+)
      authUrl:     'https://www.facebook.com/v21.0/dialog/oauth',
      tokenUrl:    'https://graph.facebook.com/v21.0/oauth/access_token',
      longLiveUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
      meUrl:       'https://graph.facebook.com/v21.0/me',
      clientId:     process.env.INSTAGRAM_APP_ID,
      clientSecret: process.env.INSTAGRAM_APP_SECRET,
      scopes: 'instagram_basic,instagram_manage_insights,pages_show_list,pages_read_engagement',
      callbackUrl: `${BACKEND_URL}/api/oauth/callback/instagram`,
    },
    tiktok: {
      authUrl:    'https://www.tiktok.com/v2/auth/authorize/',
      tokenUrl:   'https://open.tiktokapis.com/v2/oauth/token/',
      meUrl:      'https://open.tiktokapis.com/v2/user/info/',
      clientId:     process.env.TIKTOK_CLIENT_KEY,
      clientSecret: process.env.TIKTOK_CLIENT_SECRET,
      scopes: 'user.info.basic,video.list',
      callbackUrl: `${BACKEND_URL}/api/oauth/callback/tiktok`,
    },
    youtube: {
      authUrl:    'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl:   'https://oauth2.googleapis.com/token',
      meUrl:      'https://www.googleapis.com/youtube/v3/channels',
      clientId:     process.env.YOUTUBE_CLIENT_ID,
      clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
      scopes: 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly',
      callbackUrl: `${BACKEND_URL}/api/oauth/callback/youtube`,
    },
    snapchat: {
      authUrl:    'https://accounts.snapchat.com/login/oauth2/authorize',
      tokenUrl:   'https://accounts.snapchat.com/login/oauth2/access_token',
      meUrl:      'https://adsapi.snapchat.com/v1/me',
      clientId:     process.env.SNAPCHAT_CLIENT_ID,
      clientSecret: process.env.SNAPCHAT_CLIENT_SECRET,
      scopes: 'https://auth.snapchat.com/oauth2/api/user.profile',
      callbackUrl: `${BACKEND_URL}/api/oauth/callback/snapchat`,
    },
    twitter: {
      authUrl:    'https://twitter.com/i/oauth2/authorize',
      tokenUrl:   'https://api.twitter.com/2/oauth2/token',
      meUrl:      'https://api.twitter.com/2/users/me',
      clientId:     process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_CLIENT_SECRET,
      scopes: 'tweet.read users.read offline.access',
      callbackUrl: `${BACKEND_URL}/api/oauth/callback/twitter`,
    },
    facebook: {
      authUrl:    'https://www.facebook.com/v18.0/dialog/oauth',
      tokenUrl:   'https://graph.facebook.com/v18.0/oauth/access_token',
      meUrl:      'https://graph.facebook.com/v18.0/me',
      clientId:     process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      scopes: 'public_profile,email',
      callbackUrl: `${BACKEND_URL}/api/oauth/callback/facebook`,
    },
  };
}

export function getPlatformConfig() {
  return buildPlatformConfig();
}

// ── Authorization URL generation ──────────────────────────────────────────────

export function getAuthorizationUrl(platform: PlatformKey, portalUserId: string): {
  url: string | null;
  configured: boolean;
} {
  const cfg = getPlatformConfig()[platform];
  if (!cfg.clientId) return { url: null, configured: false };

  const state = encodeState({ portalUserId, platform, nonce: randomBytes(8).toString('hex') });

  const params = new URLSearchParams({
    client_id:     cfg.clientId,
    redirect_uri:  cfg.callbackUrl,
    response_type: 'code',
    state,
  });

  if (platform === 'instagram') params.set('scope', cfg.scopes);
  if (platform === 'tiktok')    params.set('scope', cfg.scopes);
  if (platform === 'snapchat')  params.set('scope', cfg.scopes);

  if (platform === 'youtube') {
    params.set('scope', cfg.scopes);
    params.set('access_type', 'offline');
    params.set('prompt', 'consent');
  }

  if (platform === 'twitter') {
    cleanExpiredPKCE();
    const { verifier, challenge } = generatePKCE();
    pkceStore.set(state, { verifier, portalUserId, expiresAt: Date.now() + 10 * 60 * 1000 });
    params.set('scope', cfg.scopes);
    params.set('code_challenge', challenge);
    params.set('code_challenge_method', 'S256');
  }

  return { url: `${cfg.authUrl}?${params.toString()}`, configured: true };
}

// ── Token exchange ────────────────────────────────────────────────────────────

export interface TokenResult {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  platform_user_id?: string;
  platform_username?: string;
}

export async function exchangeCodeForToken(
  platform: PlatformKey,
  code: string,
  state: string,
): Promise<TokenResult> {
  const cfg = getPlatformConfig()[platform];
  if (!cfg.clientId || !cfg.clientSecret) throw new Error('Platform not configured');

  const body = new URLSearchParams({
    redirect_uri: cfg.callbackUrl,
    grant_type:   'authorization_code',
    code,
  });

  // Twitter OAuth 2.0 (PKCE) requires:
  // 1. client_id in the body
  // 2. Basic Auth header with base64(client_id:client_secret)
  // 3. code_verifier from PKCE flow
  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };

  if (platform === 'twitter') {
    const pkce = pkceStore.get(state);
    if (pkce) {
      body.set('code_verifier', pkce.verifier);
      pkceStore.delete(state);
    }
    body.set('client_id', cfg.clientId);
    const basicAuth = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
    headers['Authorization'] = `Basic ${basicAuth}`;
  } else {
    // All other platforms: send credentials in body
    body.set('client_id', cfg.clientId);
    body.set('client_secret', cfg.clientSecret);
  }

  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers,
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  const data = await res.json() as Record<string, unknown>;

  // Normalize response across platforms
  const token: TokenResult = {
    access_token:  String(data.access_token || ''),
    refresh_token: data.refresh_token ? String(data.refresh_token) : undefined,
    expires_in:    data.expires_in ? Number(data.expires_in) : undefined,
  };

  // For Instagram: exchange short-lived for long-lived token
  if (platform === 'instagram' && cfg.clientSecret) {
    try {
      const llRes = await fetch(
        `${getPlatformConfig().instagram.longLiveUrl}?grant_type=ig_exchange_token&client_secret=${cfg.clientSecret}&access_token=${token.access_token}`
      );
      if (llRes.ok) {
        const llData = await llRes.json() as Record<string, unknown>;
        token.access_token = String(llData.access_token || token.access_token);
        token.expires_in   = Number(llData.expires_in || token.expires_in);
      }
    } catch { /* keep short-lived token */ }
  }

  return token;
}

// ── Token refresh ─────────────────────────────────────────────────────────────

export async function refreshAccessToken(
  platform: PlatformKey,
  refreshToken: string,
): Promise<TokenResult | null> {
  const cfg = getPlatformConfig()[platform];
  if (!cfg.clientId || !cfg.clientSecret) return null;

  try {
    // Instagram: uses a different refresh endpoint
    if (platform === 'instagram') {
      const res = await fetch(
        `${getPlatformConfig().instagram.longLiveUrl}?grant_type=ig_refresh_token&access_token=${refreshToken}`
      );
      if (!res.ok) return null;
      const data = await res.json() as Record<string, unknown>;
      return { access_token: String(data.access_token), expires_in: Number(data.expires_in) };
    }

    const body = new URLSearchParams({
      client_id:     cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
    });

    const res = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    return {
      access_token:  String(data.access_token),
      refresh_token: data.refresh_token ? String(data.refresh_token) : refreshToken,
      expires_in:    data.expires_in ? Number(data.expires_in) : undefined,
    };
  } catch {
    return null;
  }
}
