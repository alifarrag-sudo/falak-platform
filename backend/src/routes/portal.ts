/**
 * Influencer Portal API
 * - Auth (register, login)
 * - Offer management (list, respond)
 * - Deliverable submission
 */
import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { db } from '../db/connection';
import { createNotification } from './notifications';
import { sendFanRequestFulfilledEmail, sendDeliverableSubmittedEmail } from '../services/emailService';
import fetch from 'node-fetch';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'cp-portal-secret-change-in-prod';

/* ── Auth middleware ──────────────────────────────────────── */
interface AuthRequest extends Request { portalUser?: Record<string, unknown>; }

async function requirePortalAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
    const user = await db.get('SELECT * FROM portal_users WHERE id = ? AND status = ?', [payload.id, 'active']) as Record<string, unknown> | undefined;
    if (!user) { res.status(401).json({ error: 'User not found or suspended' }); return; }
    req.portalUser = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/* ── Register ─────────────────────────────────────────────── */
router.post('/auth/register', async (req, res) => {
  const { email, password, name, handle, phone, platforms, invite_token } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const existing = await db.get('SELECT id FROM portal_users WHERE email = ?', [email]);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const hash = await bcrypt.hash(String(password), 10);
  const id = uuidv4();

  // Resolve influencer_id via invite_token first, then handle lookup
  let influencer_id: string | null = null;

  if (invite_token) {
    const invited = await db.get('SELECT id FROM influencers WHERE invite_token = ? AND is_archived = 0', [invite_token]) as { id: string } | undefined;
    if (invited) {
      influencer_id = invited.id;
      await db.run(`UPDATE influencers SET invite_token = NULL WHERE id = ?`, [invited.id]);
    }
  }

  if (!influencer_id && handle) {
    const inf = await db.get(`SELECT id FROM influencers WHERE ig_handle = ? OR tiktok_handle = ? AND is_archived = 0`, [handle, handle]) as { id: string } | undefined;
    influencer_id = inf?.id || null;
  }

  // If no existing influencer found, create a new one
  if (!influencer_id) {
    influencer_id = uuidv4();
    const ig_handle = handle && handle.startsWith('@') ? handle : null;
    await db.run(`
      INSERT INTO influencers (id, name_english, ig_handle, phone_number, email, supplier_source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [influencer_id, name || null, ig_handle, phone || null, email, 'portal']);
  }

  await db.run(`
    INSERT INTO portal_users (id, email, password_hash, name, handle, phone, platforms, influencer_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, email, hash, name || null, handle || null, phone || null, platforms ? JSON.stringify(platforms) : null, influencer_id]);

  const token = jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' });
  const user = await db.get('SELECT id, email, name, handle, phone, platforms, profile_pic, influencer_id, created_at FROM portal_users WHERE id = ?', [id]);
  res.json({ token, user, influencer_id });
});

/* ── Login ────────────────────────────────────────────────── */
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = await db.get('SELECT * FROM portal_users WHERE email = ?', [email]) as Record<string, unknown> | undefined;
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (user.status === 'suspended') return res.status(403).json({ error: 'Account suspended' });

  const valid = await bcrypt.compare(String(password), String(user.password_hash));
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  await db.run(`UPDATE portal_users SET last_login_at = NOW() WHERE id = ?`, [user.id]);

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
  const { password_hash, ...safeUser } = user;
  res.json({ token, user: safeUser });
});

/* ── Invite token lookup (no auth) ───────────────────────── */
router.get('/invite/:token', async (req, res) => {
  const inf = await db.get(
    `SELECT id, name_english, name_arabic, email, ig_handle, tiktok_handle FROM influencers WHERE invite_token = ? AND is_archived = 0`,
    [req.params.token]
  ) as Record<string, unknown> | undefined;
  if (!inf) return res.status(404).json({ error: 'Invite link is invalid or already used' });
  res.json({
    valid: true,
    influencer_id: inf.id,
    name: inf.name_english || inf.name_arabic,
    email: inf.email,
    handle: inf.ig_handle || inf.tiktok_handle,
  });
});

/* ── Social OAuth identity verification for portal registration ──────────── */
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND_URL  = process.env.BACKEND_URL  || `http://localhost:${process.env.PORT || 3001}`;

// In-memory state store: stateKey → { invite_token, provider, nonce, expiresAt }
const portalOAuthState = new Map<string, { invite_token?: string; provider: string; expiresAt: number }>();

// Clean expired states every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of portalOAuthState) {
    if (v.expiresAt < now) portalOAuthState.delete(k);
  }
}, 5 * 60 * 1000);

type PortalOAuthProvider = 'facebook' | 'google';

function buildOAuthConfig(provider: PortalOAuthProvider) {
  switch (provider) {
    case 'facebook': return {
      authUrl:     'https://www.facebook.com/v21.0/dialog/oauth',
      tokenUrl:    'https://graph.facebook.com/v21.0/oauth/access_token',
      meUrl:       'https://graph.facebook.com/v21.0/me?fields=id,name,email,picture.width(200)',
      clientId:    process.env.FACEBOOK_APP_ID || process.env.INSTAGRAM_APP_ID,
      clientSecret:process.env.FACEBOOK_APP_SECRET || process.env.INSTAGRAM_APP_SECRET,
      scopes:      'public_profile,email',
      callbackUrl: `${BACKEND_URL}/api/portal/auth/oauth/callback/facebook`,
    };
    case 'google': return {
      authUrl:     'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl:    'https://oauth2.googleapis.com/token',
      meUrl:       'https://www.googleapis.com/oauth2/v3/userinfo',
      clientId:    process.env.GOOGLE_CLIENT_ID,
      clientSecret:process.env.GOOGLE_CLIENT_SECRET,
      scopes:      'openid email profile',
      callbackUrl: `${BACKEND_URL}/api/portal/auth/oauth/callback/google`,
    };
  }
}

// GET /api/portal/auth/oauth/start/:provider?invite_token=xxx
router.get('/auth/oauth/start/:provider', (req, res) => {
  const provider = req.params.provider as PortalOAuthProvider;
  if (provider !== 'facebook' && provider !== 'google') {
    return res.status(400).json({ error: 'Unsupported provider. Use facebook or google.' });
  }

  const cfg = buildOAuthConfig(provider);
  if (!cfg.clientId) {
    return res.status(503).json({
      error: `${provider} OAuth is not configured. Ask your admin to add ${provider.toUpperCase()}_APP_ID / ${provider.toUpperCase()}_CLIENT_ID to the environment.`,
      configured: false,
    });
  }

  const stateKey = uuidv4().replace(/-/g, '');
  portalOAuthState.set(stateKey, {
    invite_token: req.query.invite_token as string | undefined,
    provider,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  });

  const params = new URLSearchParams({
    client_id:     cfg.clientId,
    redirect_uri:  cfg.callbackUrl,
    response_type: 'code',
    scope:         cfg.scopes,
    state:         stateKey,
  });
  if (provider === 'google') params.set('access_type', 'online');

  return res.json({ url: `${cfg.authUrl}?${params.toString()}`, configured: true });
});

// GET /api/portal/auth/oauth/callback/:provider
router.get('/auth/oauth/callback/:provider', async (req, res) => {
  const provider = req.params.provider as PortalOAuthProvider;
  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    return res.redirect(`${FRONTEND_URL}/portal/login?error=${encodeURIComponent(error)}`);
  }

  const stateData = portalOAuthState.get(state);
  if (!stateData || stateData.provider !== provider) {
    return res.redirect(`${FRONTEND_URL}/portal/login?error=invalid_state`);
  }
  portalOAuthState.delete(state);

  const cfg = buildOAuthConfig(provider);
  if (!cfg.clientId || !cfg.clientSecret) {
    return res.redirect(`${FRONTEND_URL}/portal/login?error=oauth_not_configured`);
  }

  try {
    // Exchange code for token
    const tokenRes = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     cfg.clientId,
        client_secret: cfg.clientSecret,
        code,
        redirect_uri:  cfg.callbackUrl,
        grant_type:    'authorization_code',
      }).toString(),
    });
    const tokenData = await tokenRes.json() as Record<string, unknown>;
    const access_token = String(tokenData.access_token || '');
    if (!access_token) throw new Error('No access_token received');

    // Fetch user profile
    const meRes = await fetch(cfg.meUrl, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const me = await meRes.json() as Record<string, unknown>;

    const oauth_id = String(me.id || me.sub || '');
    const oauth_name = String(me.name || '');
    const oauth_email = String(me.email || '');
    const oauth_picture = provider === 'facebook'
      ? String((me.picture as Record<string, unknown> | undefined)?.data
          ? ((me.picture as Record<string, unknown>).data as Record<string, unknown>).url || ''
          : (me.picture || ''))
      : String(me.picture || '');

    if (!oauth_id) throw new Error('No user ID received from provider');

    // 1) Try to find existing portal user with this OAuth identity
    let portalUser = await db.get(
      `SELECT * FROM portal_users WHERE oauth_provider = ? AND oauth_id = ?`,
      [provider, oauth_id]
    ) as Record<string, unknown> | undefined;

    if (portalUser) {
      await db.run(`UPDATE portal_users SET last_login_at = NOW() WHERE id = ?`, [portalUser.id]);
      const token = jwt.sign({ id: portalUser.id }, JWT_SECRET, { expiresIn: '30d' });
      return res.redirect(`${FRONTEND_URL}/portal/login?oauth_token=${token}&oauth_name=${encodeURIComponent(oauth_name)}`);
    }

    // 2) New user — resolve influencer_id via invite_token
    let influencer_id: string | null = null;
    if (stateData.invite_token) {
      const invited = await db.get(
        `SELECT id FROM influencers WHERE invite_token = ? AND is_archived = 0`,
        [stateData.invite_token]
      ) as { id: string } | undefined;
      if (invited) {
        influencer_id = invited.id;
        await db.run(`UPDATE influencers SET invite_token = NULL WHERE id = ?`, [invited.id]);
      }
    }

    // 3) If no invite, try to match by email
    if (!influencer_id && oauth_email) {
      const byEmail = await db.get(
        `SELECT id FROM influencers WHERE email = ? AND is_archived = 0`,
        [oauth_email]
      ) as { id: string } | undefined;
      influencer_id = byEmail?.id || null;
    }

    // 4) No influencer match → create one
    if (!influencer_id) {
      influencer_id = uuidv4();
      await db.run(`
        INSERT INTO influencers (id, name_english, email, supplier_source, created_at, updated_at)
        VALUES (?, ?, ?, ?, NOW(), NOW())
      `, [influencer_id, oauth_name || null, oauth_email || null, 'portal_oauth']);
    }

    // 5) Check if email already registered (password account) — link OAuth
    const emailUser = oauth_email
      ? await db.get(`SELECT * FROM portal_users WHERE email = ?`, [oauth_email]) as Record<string, unknown> | undefined
      : undefined;

    if (emailUser) {
      await db.run(`
        UPDATE portal_users SET oauth_provider = ?, oauth_id = ?, oauth_name = ?, oauth_picture = ?
        WHERE id = ?
      `, [provider, oauth_id, oauth_name, oauth_picture, emailUser.id]);
      await db.run(`UPDATE portal_users SET last_login_at = NOW() WHERE id = ?`, [emailUser.id]);
      const token = jwt.sign({ id: emailUser.id }, JWT_SECRET, { expiresIn: '30d' });
      return res.redirect(`${FRONTEND_URL}/portal/login?oauth_token=${token}&oauth_name=${encodeURIComponent(oauth_name)}`);
    }

    // 6) Create new portal user (OAuth-only, empty password hash placeholder)
    const newId = uuidv4();
    const emailForAccount = oauth_email || `${oauth_id}@${provider}.oauth`;
    await db.run(`
      INSERT INTO portal_users (id, email, password_hash, name, profile_pic, oauth_provider, oauth_id, oauth_name, oauth_picture, influencer_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [newId, emailForAccount, '', oauth_name || null, oauth_picture || null, provider, oauth_id, oauth_name, oauth_picture, influencer_id]);

    const token = jwt.sign({ id: newId }, JWT_SECRET, { expiresIn: '30d' });
    return res.redirect(`${FRONTEND_URL}/portal/login?oauth_token=${token}&oauth_name=${encodeURIComponent(oauth_name)}&new_user=1`);

  } catch (err) {
    console.error('Portal OAuth error:', err);
    return res.redirect(`${FRONTEND_URL}/portal/login?error=oauth_failed`);
  }
});

/* ── Profile ──────────────────────────────────────────────── */
router.get('/profile', requirePortalAuth, async (req: AuthRequest, res) => {
  let user = req.portalUser!;

  // Auto-create influencer record for legacy portal accounts that don't have one
  if (!user.influencer_id) {
    const influencer_id = uuidv4();
    const ig_handle = user.handle && String(user.handle).startsWith('@') ? String(user.handle) : null;
    await db.run(`
      INSERT INTO influencers (id, name_english, ig_handle, phone_number, email, supplier_source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [influencer_id, user.name || null, ig_handle, user.phone || null, user.email || null, 'portal']);
    await db.run(`UPDATE portal_users SET influencer_id = ? WHERE id = ?`, [influencer_id, user.id]);
    user = { ...user, influencer_id };
  }

  const { password_hash, ...safe } = user;
  res.json(safe);
});

router.put('/profile', requirePortalAuth, async (req: AuthRequest, res) => {
  const { name, handle, phone, bio, platforms } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined)      updates.name = name;
  if (handle !== undefined)    updates.handle = handle;
  if (phone !== undefined)     updates.phone = phone;
  if (bio !== undefined)       updates.bio = bio;
  if (platforms !== undefined) updates.platforms = JSON.stringify(platforms);

  if (Object.keys(updates).length === 0) return res.json(req.portalUser);

  const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const vals   = Object.values(updates);
  await db.run(`UPDATE portal_users SET ${fields} WHERE id = ?`, [...vals, req.portalUser!.id]);
  const updated = await db.get('SELECT * FROM portal_users WHERE id = ?', [req.portalUser!.id]) as Record<string, unknown>;
  const { password_hash, ...safe } = updated;
  res.json(safe);
});

/* ── Influencer record update (portal-scoped) ─────────────── */
router.put('/influencers/:id', requirePortalAuth, async (req: AuthRequest, res) => {
  const linkedInfluencerId = req.portalUser!.influencer_id as string | null;

  // Only allow updating the influencer record that belongs to this portal user
  if (!linkedInfluencerId || linkedInfluencerId !== req.params.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const allowed = [
    'name_english', 'name_arabic', 'nickname', 'ig_handle', 'tiktok_handle',
    'snap_handle', 'twitter_handle', 'youtube_handle',
    'main_category', 'sub_category_1', 'country', 'city',
    'phone_number', 'ig_rate', 'tiktok_rate', 'snapchat_rate', 'youtube_rate',
    'twitter_rate', 'rate_per_deliverable', 'internal_notes',
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length === 0) {
    const inf = await db.get('SELECT * FROM influencers WHERE id = ?', [linkedInfluencerId]);
    return res.json(inf);
  }

  const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const vals   = Object.values(updates);
  await db.run(`UPDATE influencers SET ${fields}, updated_at = NOW() WHERE id = ?`, [...vals, linkedInfluencerId]);

  const inf = await db.get('SELECT * FROM influencers WHERE id = ?', [linkedInfluencerId]);
  res.json(inf);
});

/* ── Offers ───────────────────────────────────────────────── */
router.get('/offers', requirePortalAuth, async (req: AuthRequest, res) => {
  const userId = req.portalUser!.id as string;
  const linkedInfluencerId = req.portalUser!.influencer_id as string | null;

  // Match offers assigned to this portal account OR linked by influencer_id
  const offers = await db.all(`
    SELECT o.*, c.name AS campaign_name
    FROM portal_offers o
    LEFT JOIN campaigns c ON o.campaign_id = c.id
    WHERE o.portal_user_id = ?
      OR (o.influencer_id = ? AND o.portal_user_id IS NULL AND ? IS NOT NULL)
    ORDER BY o.created_at DESC
  `, [userId, linkedInfluencerId, linkedInfluencerId]) as Record<string, unknown>[];

  // Auto-link unlinked offers to this portal user if they match influencer_id
  if (linkedInfluencerId) {
    await db.run(`
      UPDATE portal_offers
      SET portal_user_id = ?, updated_at = NOW()
      WHERE influencer_id = ? AND portal_user_id IS NULL
    `, [userId, linkedInfluencerId]);
  }

  res.json(offers);
});

router.get('/offers/:id', requirePortalAuth, async (req: AuthRequest, res) => {
  const userId = req.portalUser!.id as string;
  const linkedInfluencerId = req.portalUser!.influencer_id as string | null;

  const offer = await db.get(`
    SELECT o.*, c.name AS campaign_name, c.client_name
    FROM portal_offers o
    LEFT JOIN campaigns c ON o.campaign_id = c.id
    WHERE o.id = ? AND (
      o.portal_user_id = ?
      OR (o.influencer_id = ? AND ? IS NOT NULL)
    )
  `, [req.params.id, userId, linkedInfluencerId, linkedInfluencerId]) as Record<string, unknown> | undefined;

  if (!offer) return res.status(404).json({ error: 'Offer not found' });

  // Auto-link if not yet assigned
  if (!offer.portal_user_id && linkedInfluencerId) {
    await db.run(`UPDATE portal_offers SET portal_user_id = ?, updated_at = NOW() WHERE id = ?`, [userId, offer.id]);
  }

  const deliverables = await db.all('SELECT * FROM portal_deliverables WHERE offer_id = ? ORDER BY submitted_at DESC', [offer.id]) as Record<string, unknown>[];
  res.json({ ...offer, deliverables });
});

/* ── Respond to offer ─────────────────────────────────────── */
router.put('/offers/:id/respond', requirePortalAuth, async (req: AuthRequest, res) => {
  const { decision, influencer_notes } = req.body; // decision: 'accepted' | 'declined'
  if (!['accepted', 'declined'].includes(decision)) return res.status(400).json({ error: "decision must be 'accepted' or 'declined'" });

  const userId = req.portalUser!.id as string;
  const linkedInfluencerId = req.portalUser!.influencer_id as string | null;

  const offer = await db.get(`
    SELECT * FROM portal_offers WHERE id = ? AND (
      portal_user_id = ? OR (influencer_id = ? AND ? IS NOT NULL)
    )
  `, [req.params.id, userId, linkedInfluencerId, linkedInfluencerId]) as Record<string, unknown> | undefined;

  if (!offer) return res.status(404).json({ error: 'Offer not found' });
  if (!['pending', 'sent'].includes(String(offer.status))) {
    return res.status(409).json({ error: `Cannot respond to offer in status: ${offer.status}` });
  }

  await db.run(`
    UPDATE portal_offers
    SET status = ?, influencer_notes = ?, responded_at = NOW(),
        portal_user_id = ?, updated_at = NOW()
    WHERE id = ?
  `, [decision, influencer_notes || null, userId, offer.id]);

  // ── Commission calculation on acceptance ───────────────────────────────────
  if (decision === 'accepted') {
    try {
      const rate = offer.rate as number | null;
      if (rate && rate > 0) {
        const settingRow = await db.get("SELECT value FROM settings WHERE key = 'platform_commission_pct'", []) as { value: string } | undefined;
        const feePct   = parseFloat(settingRow?.value || '10');
        const feeAmt   = Math.round((rate * feePct / 100) * 100) / 100;
        const netAmt   = Math.round((rate - feeAmt) * 100) / 100;
        const currency = (offer.currency as string) || 'SAR';

        await db.run(`
          UPDATE portal_offers SET platform_fee_pct = ?, platform_fee_amount = ?, net_amount = ?
          WHERE id = ?
        `, [feePct, feeAmt, netAmt, offer.id]);

        await db.run(`
          INSERT INTO commissions
            (id, transaction_type, reference_id, offer_title, influencer_id, gross_amount,
             commission_rate, commission_amount, net_amount, currency, status)
          VALUES (?, 'offer', ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
        `, [uuidv4(), offer.id, offer.title || null, offer.influencer_id || null,
               rate, feePct, feeAmt, netAmt, currency]);
      }

      // Award loyalty points to influencer
      const loyaltyUserId = String(userId || linkedInfluencerId || '');
      if (loyaltyUserId) {
        await db.run(`
          INSERT INTO loyalty_points (id, user_type, user_id, action, points, reference_id, note)
          VALUES (?, 'influencer', ?, 'offer_accepted', 10, ?, 'Offer accepted')
        `, [uuidv4(), loyaltyUserId, offer.id]);
      }
    } catch (commErr) {
      console.error('[portal] Commission calculation failed:', commErr);
    }
  }

  // Notify the agency/admin that the influencer responded to the offer.
  try {
    const influencerName = (req.portalUser!.name as string) || (req.portalUser!.handle as string) || 'An influencer';
    const offerTitle = (offer.title as string) || 'offer';

    let agencyUserId: string | undefined;
    if (offer.campaign_id) {
      const campaign = await db.get('SELECT created_by FROM campaigns WHERE id = ?', [offer.campaign_id]) as { created_by: string } | undefined;
      if (campaign?.created_by) {
        const adminUser = await db.get(`SELECT id FROM users WHERE (display_name = ? OR email = ?) LIMIT 1`, [campaign.created_by, campaign.created_by]) as { id: string } | undefined;
        agencyUserId = adminUser?.id;
      }
    }
    if (!agencyUserId) {
      const fallback = await db.get(`SELECT id FROM users WHERE role IN ('platform_admin','agency') LIMIT 1`, []) as { id: string } | undefined;
      agencyUserId = fallback?.id;
    }

    if (agencyUserId) {
      const type = decision === 'accepted' ? 'offer_accepted' : 'offer_declined';
      const title = decision === 'accepted' ? 'Offer accepted' : 'Offer declined';
      const message = decision === 'accepted'
        ? `${influencerName} accepted the offer: ${offerTitle}`
        : `${influencerName} declined the offer: ${offerTitle}`;
      await createNotification(agencyUserId, type, title, message, `/offers/${String(offer.id)}`);
    }
  } catch (notifErr) {
    console.error('Notification trigger failed (portal respond):', notifErr);
  }

  res.json({ id: offer.id, status: decision });
});

/* ── Submit deliverable ───────────────────────────────────── */
router.post('/offers/:id/deliverables', requirePortalAuth, async (req: AuthRequest, res) => {
  const { content_url, caption, notes, submission_type = 'link' } = req.body;

  const userId = req.portalUser!.id as string;
  const linkedInfluencerId = req.portalUser!.influencer_id as string | null;

  const offer = await db.get(`
    SELECT * FROM portal_offers WHERE id = ? AND (
      portal_user_id = ? OR (influencer_id = ? AND ? IS NOT NULL)
    )
  `, [req.params.id, userId, linkedInfluencerId, linkedInfluencerId]) as Record<string, unknown> | undefined;

  if (!offer) return res.status(404).json({ error: 'Offer not found' });
  if (!['accepted', 'in_progress'].includes(String(offer.status))) {
    return res.status(409).json({ error: 'You must accept the offer before submitting work' });
  }
  if (!content_url && submission_type === 'link') {
    return res.status(400).json({ error: 'content_url is required for link submissions' });
  }

  // Ensure portal_user_id is set
  if (!offer.portal_user_id) {
    await db.run(`UPDATE portal_offers SET portal_user_id = ?, updated_at = NOW() WHERE id = ?`, [userId, offer.id]);
  }

  const id = uuidv4();
  await db.run(`
    INSERT INTO portal_deliverables (id, offer_id, portal_user_id, submission_type, content_url, caption, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [id, offer.id, userId, submission_type, content_url || null, caption || null, notes || null]);

  // Auto-update offer status to 'submitted'
  await db.run(`UPDATE portal_offers SET status = 'submitted', updated_at = NOW() WHERE id = ?`, [offer.id]);

  // Notify agency that a deliverable was submitted
  try {
    if (offer.created_by) {
      const agencyUser = await db.get('SELECT email, name FROM users WHERE id = ?', [offer.created_by]) as { email: string; name: string } | undefined;
      if (agencyUser?.email) {
        sendDeliverableSubmittedEmail(agencyUser.email, {
          influencerName: (req.portalUser!.name as string) || 'Influencer',
          offerTitle: String(offer.title || 'Untitled offer'),
          contentUrl: content_url || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/offers`,
          offerId: String(offer.id),
        }).catch(console.error);
      }
    }
  } catch { /* non-critical */ }

  const deliverable = await db.get('SELECT * FROM portal_deliverables WHERE id = ?', [id]);
  res.status(201).json(deliverable);
});

/* ── Upload file deliverable ─────────────────────────────── */
router.post('/offers/:id/deliverables/upload', requirePortalAuth, async (req: AuthRequest, res) => {
  const userId = req.portalUser!.id as string;
  const linkedInfluencerId = req.portalUser!.influencer_id as string | null;

  const offer = await db.get(`
    SELECT * FROM portal_offers WHERE id = ? AND (
      portal_user_id = ? OR (influencer_id = ? AND ? IS NOT NULL)
    )
  `, [req.params.id, userId, linkedInfluencerId, linkedInfluencerId]) as Record<string, unknown> | undefined;

  if (!offer) return res.status(404).json({ error: 'Offer not found' });
  if (!['accepted', 'in_progress'].includes(String(offer.status))) {
    return res.status(409).json({ error: 'You must accept the offer before submitting work' });
  }

  // express-fileupload attaches files to req.files
  const files = (req as Request & { files?: Record<string, unknown> }).files;
  if (!files || !files.file) return res.status(400).json({ error: 'No file uploaded' });

  const file = Array.isArray(files.file) ? (files.file as unknown[])[0] : files.file as {
    mimetype: string; size: number; name: string;
    mv: (path: string, cb: (err: Error) => void) => void;
  };

  // Allowed types
  const ALLOWED = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/webm',
    'application/pdf',
  ];
  if (!ALLOWED.includes((file as { mimetype: string }).mimetype)) {
    return res.status(400).json({ error: 'File type not allowed. Accepted: images, videos, PDF.' });
  }
  if ((file as { size: number }).size > 200 * 1024 * 1024) {
    return res.status(400).json({ error: 'File too large (max 200 MB)' });
  }

  // Save to /uploads/deliverables/
  const uploadDir = path.join(__dirname, '../../../uploads/deliverables');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const typedFile = file as { mimetype: string; size: number; name: string; mv: (p: string, cb: (e: Error) => void) => void };
  const ext = path.extname(typedFile.name) || '';
  const filename = `${uuidv4()}${ext}`;
  const filePath = path.join(uploadDir, filename);

  typedFile.mv(filePath, async (err: Error) => {
    if (err) {
      console.error('File move error:', err);
      return res.status(500).json({ error: 'Failed to save file' });
    }

    const { caption, notes } = req.body;

    // Ensure portal_user_id is set
    if (!offer.portal_user_id) {
      await db.run(`UPDATE portal_offers SET portal_user_id = ?, updated_at = NOW() WHERE id = ?`, [userId, offer.id]);
    }

    const delivId = uuidv4();
    const fileUrl = `/uploads/deliverables/${filename}`;
    await db.run(`
      INSERT INTO portal_deliverables (id, offer_id, portal_user_id, submission_type, content_url, file_name, file_size, mime_type, caption, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [delivId, offer.id, userId, 'file', fileUrl, typedFile.name, typedFile.size, typedFile.mimetype, caption || null, notes || null]);

    // Auto-update offer status to 'submitted'
    await db.run(`UPDATE portal_offers SET status = 'submitted', updated_at = NOW() WHERE id = ?`, [offer.id]);

    const deliverable = await db.get('SELECT * FROM portal_deliverables WHERE id = ?', [delivId]);
    res.status(201).json(deliverable);
  });
});

/* ── Accept counter-offer (portal side) ──────────────────── */
router.post('/offers/:id/accept-counter', requirePortalAuth, async (req: AuthRequest, res) => {
  const userId = req.portalUser!.id as string;
  const linkedInfluencerId = req.portalUser!.influencer_id as string | null;

  const offer = await db.get(`
    SELECT * FROM portal_offers WHERE id = ? AND (
      portal_user_id = ? OR (influencer_id = ? AND ? IS NOT NULL)
    )
  `, [req.params.id, userId, linkedInfluencerId, linkedInfluencerId]) as Record<string, unknown> | undefined;

  if (!offer) return res.status(404).json({ error: 'Offer not found' });
  if (!offer.counter_rate) return res.status(400).json({ error: 'No counter-offer to accept' });

  await db.run(`
    UPDATE portal_offers
    SET rate = ?, currency = COALESCE(counter_currency, currency),
        counter_rate = NULL, counter_currency = NULL, counter_notes = NULL, counter_by = NULL, counter_at = NULL,
        status = 'accepted', responded_at = NOW(), updated_at = NOW()
    WHERE id = ?
  `, [offer.counter_rate, req.params.id]);

  const updated = await db.get('SELECT * FROM portal_offers WHERE id = ?', [req.params.id]);
  res.json(updated);
});

/* ── Portal Social Connections ───────────────────────────── */

// GET /api/portal/connections — list connected social accounts for this influencer
router.get('/connections', requirePortalAuth, async (req: AuthRequest, res) => {
  const userId = req.portalUser!.id as string;

  const portalUser = await db.get('SELECT influencer_id FROM portal_users WHERE id = ?', [userId]) as { influencer_id: string | null } | undefined;
  const influencerId = portalUser?.influencer_id;

  if (!influencerId) {
    return res.json([]);
  }

  const connections = await db.all(`
    SELECT sa.*,
      sa.platform_username AS username,
      ps.followers_count, ps.following_count, ps.engagement_rate, ps.avg_views
    FROM social_accounts sa
    LEFT JOIN (
      SELECT platform, MAX(captured_at) as latest_at
      FROM platform_stats WHERE influencer_id = ?
      GROUP BY platform
    ) latest ON latest.platform = sa.platform
    LEFT JOIN platform_stats ps ON ps.platform = sa.platform AND ps.influencer_id = ? AND ps.captured_at = latest.latest_at
    WHERE sa.influencer_id = ?
    ORDER BY sa.connected_at DESC
  `, [influencerId, influencerId, influencerId]);

  res.json(connections);
});

// GET /api/portal/connections/oauth/:platform — get OAuth URL for portal user
router.get('/connections/oauth/:platform', requirePortalAuth, (req: AuthRequest, res) => {
  const { platform } = req.params;
  const userId = req.portalUser!.id as string;

  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  const authUrl = `${backendUrl}/api/oauth/${platform}/authorize?portal_user_id=${userId}`;

  res.json({ auth_url: authUrl });
});

// DELETE /api/portal/connections/:platform — disconnect a platform
router.delete('/connections/:platform', requirePortalAuth, async (req: AuthRequest, res) => {
  const userId = req.portalUser!.id as string;
  const { platform } = req.params;

  const portalUser = await db.get('SELECT influencer_id FROM portal_users WHERE id = ?', [userId]) as { influencer_id: string | null } | undefined;
  const influencerId = portalUser?.influencer_id;

  if (!influencerId) {
    return res.status(400).json({ error: 'No influencer linked to this account' });
  }

  await db.run('DELETE FROM social_accounts WHERE influencer_id = ? AND platform = ?', [influencerId, platform]);
  res.json({ success: true });
});

/* ── Portal Fan Requests ─────────────────────────────────── */

// GET /api/portal/fan-requests — influencer sees fan requests directed at them
router.get('/fan-requests', requirePortalAuth, async (req: AuthRequest, res) => {
  const userId = req.portalUser!.id as string;
  const portalUser = await db.get('SELECT influencer_id FROM portal_users WHERE id = ?', [userId]) as { influencer_id: string | null } | undefined;
  const influencerId = portalUser?.influencer_id;
  if (!influencerId) return res.json([]);

  const { status } = req.query;
  let where = 'WHERE fr.influencer_id = ?';
  const params: unknown[] = [influencerId];
  if (status && status !== 'all') { where += ' AND fr.status = ?'; params.push(status); }

  const requests = await db.all(`
    SELECT fr.*, fu.name AS fan_name, fu.email AS fan_email, fu.username AS fan_username
    FROM fan_requests fr
    JOIN fan_users fu ON fu.id = fr.fan_user_id
    ${where}
    ORDER BY fr.submitted_at DESC
  `, params);

  res.json(requests);
});

// PUT /api/portal/fan-requests/:id/respond — accept, decline, or mark fulfilled
router.put('/fan-requests/:id/respond', requirePortalAuth, async (req: AuthRequest, res) => {
  const userId = req.portalUser!.id as string;
  const portalUser = await db.get('SELECT influencer_id FROM portal_users WHERE id = ?', [userId]) as { influencer_id: string | null } | undefined;
  const influencerId = portalUser?.influencer_id;
  if (!influencerId) return res.status(403).json({ error: 'No influencer linked' });

  const request = await db.get('SELECT * FROM fan_requests WHERE id = ? AND influencer_id = ?', [req.params.id, influencerId]) as Record<string, unknown> | undefined;
  if (!request) return res.status(404).json({ error: 'Request not found' });

  const { decision, influencer_note, delivery_url, delivery_note } = req.body;
  const validDecisions = ['accepted', 'declined', 'fulfilled'];
  if (!validDecisions.includes(decision)) {
    return res.status(400).json({ error: `decision must be one of: ${validDecisions.join(', ')}` });
  }

  const updates: Record<string, unknown> = {
    status: decision,
    influencer_note: influencer_note || null,
    updated_at: new Date().toISOString(),
  };

  if (decision === 'accepted') updates.responded_at = new Date().toISOString();
  if (decision === 'fulfilled') {
    updates.fulfilled_at = new Date().toISOString();
    updates.responded_at = updates.responded_at || request.responded_at || new Date().toISOString();
    if (delivery_url) updates.delivery_url = delivery_url;
    if (delivery_note) updates.delivery_note = delivery_note;
    if (!request.share_token) updates.share_token = uuidv4().replace(/-/g, '');
  }
  if (decision === 'declined') updates.responded_at = new Date().toISOString();

  const set = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  await db.run(`UPDATE fan_requests SET ${set} WHERE id = ?`, [...Object.values(updates), req.params.id]);

  const updated = await db.get(`
    SELECT fr.*, fu.name AS fan_name, fu.email AS fan_email, fu.username AS fan_username
    FROM fan_requests fr JOIN fan_users fu ON fu.id = fr.fan_user_id
    WHERE fr.id = ?
  `, [req.params.id]) as Record<string, unknown> | undefined;

  // Email fan when request is fulfilled
  if (decision === 'fulfilled' && updated?.fan_email) {
    const influencerName = (req.portalUser!.name as string) || 'Your creator';
    const shareToken = updated.share_token as string | undefined;
    const APP_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    sendFanRequestFulfilledEmail(String(updated.fan_email), {
      fanName: String(updated.fan_name || updated.fan_username || 'Fan'),
      influencerName,
      requestType: String(request.request_type || 'request'),
      deliveryUrl: delivery_url || undefined,
      deliveryNote: delivery_note || undefined,
      sharePageUrl: shareToken ? `${APP_URL}/fan/delivery/${shareToken}` : undefined,
    }).catch(console.error);

    // Award loyalty points to fan
    try {
      await db.run(`INSERT INTO loyalty_points (id, user_type, user_id, action, points, reference_id, note)
        VALUES (?, 'fan', ?, 'fan_request_fulfilled', 10, ?, 'Request fulfilled')`,
        [uuidv4(), request.fan_user_id, request.id]);
    } catch { /* non-critical */ }
  }

  res.json(updated);
});

// PUT /api/portal/fan-settings — influencer sets prices & fan access settings
router.put('/fan-settings', requirePortalAuth, async (req: AuthRequest, res) => {
  const userId = req.portalUser!.id as string;
  const portalUser = await db.get('SELECT influencer_id FROM portal_users WHERE id = ?', [userId]) as { influencer_id: string | null } | undefined;
  const influencerId = portalUser?.influencer_id;
  if (!influencerId) return res.status(403).json({ error: 'No influencer linked' });

  const allowed = ['fan_shoutout_price', 'fan_video_price', 'fan_photo_price',
    'fan_meetup_price', 'fan_live_chat_price', 'fan_custom_price',
    'fan_response_time', 'fan_bio', 'fan_requests_enabled'];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of allowed) {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  }

  const set = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  await db.run(`UPDATE influencers SET ${set} WHERE id = ?`, [...Object.values(updates), influencerId]);

  const influencer = await db.get('SELECT * FROM influencers WHERE id = ?', [influencerId]);
  res.json(influencer);
});

// GET /api/portal/fan-settings — get current fan settings
router.get('/fan-settings', requirePortalAuth, async (req: AuthRequest, res) => {
  const userId = req.portalUser!.id as string;
  const portalUser = await db.get('SELECT influencer_id FROM portal_users WHERE id = ?', [userId]) as { influencer_id: string | null } | undefined;
  const influencerId = portalUser?.influencer_id;
  if (!influencerId) return res.json({});

  const settings = await db.get(`
    SELECT fan_shoutout_price, fan_video_price, fan_photo_price,
           fan_meetup_price, fan_live_chat_price, fan_custom_price,
           fan_response_time, fan_bio, fan_requests_enabled
    FROM influencers WHERE id = ?
  `, [influencerId]);
  res.json(settings || {});
});

export default router;
