import { Router, Request, Response } from 'express';
import { getDb } from '../db/schema';
import { generateProposalPdf, generateOfferContractPdf } from '../services/pdfService';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P = any;

const router = Router();

// POST /api/pdf/campaign/:id - generate PDF for a campaign
router.post('/campaign/:id', async (req: Request, res: Response) => {
  const db = getDb();

  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const influencers = db.prepare(`
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
  `).all(req.params.id) as Record<string, unknown>[];

  const settings = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const settingsMap: Record<string, string> = {};
  settings.forEach(s => { settingsMap[s.key] = s.value; });

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
router.post('/offer/:id', async (req: Request, res: Response) => {
  const db = getDb();

  const offer = db.prepare(`
    SELECT o.*, i.name_english, i.ig_handle, i.tiktok_handle, i.name_arabic
    FROM portal_offers o
    LEFT JOIN influencers i ON o.influencer_id = i.id
    WHERE o.id = ?
  `).get(req.params.id) as Record<string, unknown> | undefined;

  if (!offer) return res.status(404).json({ error: 'Offer not found' });

  const settings = db.prepare('SELECT key, value FROM settings').all() as P[];
  const settingsMap: Record<string, string> = {};
  settings.forEach((s: { key: string; value: string }) => { settingsMap[s.key] = s.value; });

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
