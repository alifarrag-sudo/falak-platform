/**
 * Payments tracking — agency/admin side.
 * Tracks payment status for completed/approved portal_offers.
 */
import { Router } from 'express';
import { db } from '../db/connection';
import { requireAuth } from '../middleware/auth';
import { sendPaymentSentEmail } from '../services/emailService';
import liveEmitter from '../events/liveEmitter';

const router = Router();

router.use(requireAuth());

/* ── GET /api/payments/summary ──────────────────────────────── */
router.get('/summary', async (_req, res) => {
  const row = await db.get(`
    SELECT
      COALESCE(SUM(rate), 0)                                   AS total_earned,
      COALESCE(SUM(CASE WHEN payment_status = 'paid'   THEN rate ELSE 0 END), 0) AS total_paid,
      COALESCE(SUM(CASE WHEN payment_status = 'unpaid' THEN rate ELSE 0 END), 0) AS total_unpaid,
      COUNT(CASE WHEN payment_status = 'paid'   THEN 1 END)   AS count_paid,
      COUNT(CASE WHEN payment_status = 'unpaid' THEN 1 END)   AS count_unpaid
    FROM portal_offers
    WHERE status IN ('completed', 'approved')
  `, []) as {
    total_earned: number;
    total_paid: number;
    total_unpaid: number;
    count_paid: number;
    count_unpaid: number;
  };

  res.json(row);
});

/* ── GET /api/payments ──────────────────────────────────────── */
router.get('/', async (req, res) => {
  const {
    payment_status,
    campaign_id,
    page = '1',
    limit = '20',
  } = req.query as Record<string, string>;

  const conditions: string[] = ["o.status IN ('completed', 'approved')"];
  const params: unknown[] = [];

  if (payment_status && payment_status !== 'all') {
    conditions.push('o.payment_status = ?');
    params.push(payment_status);
  }
  if (campaign_id) {
    conditions.push('o.campaign_id = ?');
    params.push(campaign_id);
  }

  const where = 'WHERE ' + conditions.join(' AND ');
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  const countRow = await db.get(`SELECT COUNT(*) AS n FROM portal_offers o ${where}`, params) as { n: number };
  const total = countRow.n;

  const rows = await db.all(`
    SELECT o.id, o.title, o.rate, o.currency, o.status, o.payment_status,
           o.paid_at, o.payment_reference, o.payment_notes,
           o.created_at, o.updated_at,
           c.name AS campaign_name,
           i.name_english AS influencer_name,
           i.ig_handle, i.tiktok_handle
    FROM portal_offers o
    LEFT JOIN campaigns c  ON o.campaign_id   = c.id
    LEFT JOIN influencers i ON o.influencer_id = i.id
    ${where}
    ORDER BY o.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limitNum, offset]) as Record<string, unknown>[];

  res.json({ data: rows, total, page: pageNum, limit: limitNum });
});

/* ── PUT /api/payments/:id/mark-paid ───────────────────────── */
router.put('/:id/mark-paid', async (req, res) => {
  const { payment_reference, payment_notes } = req.body as {
    payment_reference?: string;
    payment_notes?: string;
  };

  const existing = await db.get(
    `SELECT id FROM portal_offers WHERE id = ? AND status IN ('completed', 'approved')`,
    [req.params.id]
  ) as { id: string } | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Offer not found or not eligible for payment tracking' });
    return;
  }

  await db.run(`
    UPDATE portal_offers
    SET payment_status    = 'paid',
        paid_at           = NOW(),
        payment_reference = ?,
        payment_notes     = ?,
        updated_at        = NOW()
    WHERE id = ?
  `, [payment_reference ?? null, payment_notes ?? null, req.params.id]);

  const updated = await db.get(`
    SELECT o.id, o.title, o.rate, o.currency, o.status, o.payment_status,
           o.paid_at, o.payment_reference, o.payment_notes,
           o.created_at, o.updated_at,
           c.name AS campaign_name,
           i.name_english AS influencer_name,
           i.ig_handle, i.tiktok_handle
    FROM portal_offers o
    LEFT JOIN campaigns c  ON o.campaign_id   = c.id
    LEFT JOIN influencers i ON o.influencer_id = i.id
    WHERE o.id = ?
  `, [req.params.id]) as Record<string, unknown>;

  // Email influencer that payment was sent
  try {
    const inf = await db.get('SELECT i.email, i.name_english FROM influencers i JOIN portal_offers o ON o.influencer_id = i.id WHERE o.id = ?', [req.params.id]) as { email?: string; name_english?: string } | undefined;
    if (inf?.email && updated.rate) {
      sendPaymentSentEmail(inf.email, {
        influencerName: inf.name_english || inf.email.split('@')[0],
        offerTitle: String(updated.title || 'Campaign'),
        amount: Number(updated.rate),
        currency: String(updated.currency || 'SAR'),
        reference: payment_reference,
      }).catch(() => {});
    }
  } catch { /* non-fatal */ }

  // Broadcast payment event to live SSE clients
  liveEmitter.emit('event', {
    type: 'payment',
    data: {
      id: updated.id,
      influencer_name: updated.influencer_name,
      amount: updated.rate,
      currency: updated.currency,
      campaign: updated.campaign_name,
      market: null,
      reference: payment_reference ?? null,
    },
    ts: new Date().toISOString(),
  });

  res.json(updated);
});

/* ── PUT /api/payments/:id/mark-unpaid ─────────────────────── */
router.put('/:id/mark-unpaid', async (req, res) => {
  const existing = await db.get(
    `SELECT id FROM portal_offers WHERE id = ? AND status IN ('completed', 'approved')`,
    [req.params.id]
  ) as { id: string } | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Offer not found or not eligible for payment tracking' });
    return;
  }

  await db.run(`
    UPDATE portal_offers
    SET payment_status    = 'unpaid',
        paid_at           = NULL,
        payment_reference = NULL,
        payment_notes     = NULL,
        updated_at        = NOW()
    WHERE id = ?
  `, [req.params.id]);

  const updated = await db.get(`
    SELECT o.id, o.title, o.rate, o.currency, o.status, o.payment_status,
           o.paid_at, o.payment_reference, o.payment_notes,
           o.created_at, o.updated_at,
           c.name AS campaign_name,
           i.name_english AS influencer_name,
           i.ig_handle, i.tiktok_handle
    FROM portal_offers o
    LEFT JOIN campaigns c  ON o.campaign_id   = c.id
    LEFT JOIN influencers i ON o.influencer_id = i.id
    WHERE o.id = ?
  `, [req.params.id]) as Record<string, unknown>;

  res.json(updated);
});

export default router;
