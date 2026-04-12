import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/connection';
import { generateProposalPdf, generateOfferContractPdf } from '../services/pdfService';
import { requireAuth, JWT_SECRET } from '../middleware/auth';

const PORTAL_SECRET = process.env.JWT_SECRET || 'cp-portal-secret-change-in-prod';

/** Accepts both main-platform JWT (users table) and portal JWT (portal_users table) */
async function requireAnyAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers.authorization?.replace('Bearer ', '').trim();
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }
  // Try main JWT
  try {
    const payload = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
    const user = await db.get('SELECT id FROM users WHERE id = ? AND status = ?', [payload.id, 'active']);
    if (user) { next(); return; }
  } catch { /* try portal */ }
  // Try portal JWT
  try {
    const payload = jwt.verify(token, PORTAL_SECRET) as Record<string, unknown>;
    const user = await db.get('SELECT id FROM portal_users WHERE id = ? AND status = ?', [payload.id, 'active']);
    if (user) { next(); return; }
  } catch { /* invalid */ }
  res.status(401).json({ error: 'Unauthorized' });
}

const router = Router();

// POST /api/pdf/campaign/:id - generate PDF for a campaign
router.post('/campaign/:id', requireAuth('platform_admin', 'agency', 'brand', 'talent_manager'), async (req: Request, res: Response) => {
  const campaign = await db.get('SELECT * FROM campaigns WHERE id = ?', [req.params.id]) as Record<string, unknown> | undefined;
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const influencers = await db.all(`
    SELECT ci.*, i.name_english, i.name_arabic, i.ig_handle, i.tiktok_handle,
           i.snap_handle, i.fb_handle, i.ig_followers, i.tiktok_followers,
           i.snap_followers, i.fb_followers, i.profile_photo_url,
           i.main_category, i.account_tier, i.mawthouq_certificate,
           i.ig_rate, i.tiktok_rate, i.snapchat_rate, i.package_rate,
           i.nationality, i.country, i.city
    FROM campaign_influencers ci
    JOIN influencers i ON i.id = ci.influencer_id
    WHERE ci.campaign_id = ?
    ORDER BY ci.added_at ASC
  `, [req.params.id]) as Record<string, unknown>[];

  const settingsRows = await db.all('SELECT key, value FROM settings', []) as { key: string; value: string }[];
  const settingsMap: Record<string, string> = {};
  settingsRows.forEach(s => { settingsMap[s.key] = s.value; });

  try {
    const pdfBuffer = await generateProposalPdf(campaign, influencers, settingsMap);
    const filename = `proposal-${campaign.name}-${Date.now()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    return res.status(500).json({ error: `PDF generation failed: ${(err as Error).message}` });
  }
});

// POST /api/pdf/offer/:id - generate PDF contract for an offer
// Accepts both main platform JWT and portal JWT (used by the creator portal)
router.post('/offer/:id', requireAnyAuth, async (req: Request, res: Response) => {
  const offer = await db.get(`
    SELECT o.*, i.name_english, i.ig_handle, i.tiktok_handle, i.name_arabic
    FROM portal_offers o
    LEFT JOIN influencers i ON o.influencer_id = i.id
    WHERE o.id = ?
  `, [req.params.id]) as Record<string, unknown> | undefined;

  if (!offer) return res.status(404).json({ error: 'Offer not found' });

  const settingsRows = await db.all('SELECT key, value FROM settings', []) as { key: string; value: string }[];
  const settingsMap: Record<string, string> = {};
  settingsRows.forEach((s: { key: string; value: string }) => { settingsMap[s.key] = s.value; });

  const influencer = {
    name_english: offer.name_english,
    ig_handle: offer.ig_handle,
    tiktok_handle: offer.tiktok_handle,
  };

  try {
    const pdfBuffer = await generateOfferContractPdf(offer, influencer, settingsMap);
    const filename = `contract-${String(offer.title || 'offer').replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    return res.status(500).json({ error: `PDF generation failed: ${(err as Error).message}` });
  }
});

export default router;
