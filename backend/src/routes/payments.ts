/**
 * Payments tracking — agency/admin side.
 * Tracks payment status for completed/approved portal_offers.
 */
import { Router } from 'express';
import { getDb } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { sendPaymentSentEmail } from '../services/emailService';

const router = Router();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P = any;

router.use(requireAuth());

/* ── GET /api/payments/summary ──────────────────────────────── */
router.get('/summary', (_req, res) => {
  const db = getDb();

  const row = db.prepare(`
    SELECT
      COALESCE(SUM(rate), 0)                                   AS total_earned,
      COALESCE(SUM(CASE WHEN payment_status = 'paid'   THEN rate ELSE 0 END), 0) AS total_paid,
      COALESCE(SUM(CASE WHEN payment_status = 'unpaid' THEN rate ELSE 0 END), 0) AS total_unpaid,
      COUNT(CASE WHEN payment_status = 'paid'   THEN 1 END)   AS count_paid,
      COUNT(CASE WHEN payment_status = 'unpaid' THEN 1 END)   AS count_unpaid
    FROM portal_offers
    WHERE status IN ('completed', 'approved')
  `).get() as {
    total_earned: number;
    total_paid: number;
    total_unpaid: number;
    count_paid: number;
    count_unpaid: number;
  };

  res.json(row);
});

/* ── GET /api/payments ──────────────────────────────────────── */
router.get('/', (req, res) => {
  const db = getDb();
  const {
    payment_status,
    campaign_id,
    page = '1',
    limit = '20',
  } = req.query as Record<string, string>;

  const conditions: string[] = ["o.status IN ('completed', 'approved')"];
  const params: P[] = [];

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

  const total = (
    db.prepare(`SELECT COUNT(*) AS n FROM portal_offers o ${where}`).get(...params as P[]) as { n: number }
  ).n;

  const rows = db.prepare(`
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
  `).all(...params as P[], limitNum, offset) as Record<string, unknown>[];

  res.json({ data: rows, total, page: pageNum, limit: limitNum });
});

/* ── PUT /api/payments/:id/mark-paid ───────────────────────── */
router.put('/:id/mark-paid', (req, res) => {
  const db = getDb();
  const { payment_reference, payment_notes } = req.body as {
    payment_reference?: string;
    payment_notes?: string;
  };

  const existing = db.prepare(
    `SELECT id FROM portal_offers WHERE id = ? AND status IN ('completed', 'approved')`
  ).get(req.params.id as P) as { id: string } | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Offer not found or not eligible for payment tracking' });
    return;
  }

  db.prepare(`
    UPDATE portal_offers
    SET payment_status    = 'paid',
        paid_at           = datetime('now'),
        payment_reference = ?,
        payment_notes     = ?,
        updated_at        = datetime('now')
    WHERE id = ?
  `).run(
    payment_reference ?? null,
    payment_notes ?? null,
    req.params.id as P
  );

  const updated = db.prepare(`
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
  `).get(req.params.id as P) as Record<string, unknown>;

  // Email influencer that payment was sent
  try {
    const inf = db.prepare('SELECT i.email, i.name_english FROM influencers i JOIN portal_offers o ON o.influencer_id = i.id WHERE o.id = ?')
      .get(req.params.id as P) as { email?: string; name_english?: string } | undefined;
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

  res.json(updated);
});

/* ── PUT /api/payments/:id/mark-unpaid ─────────────────────── */
router.put('/:id/mark-unpaid', (req, res) => {
  const db = getDb();

  const existing = db.prepare(
    `SELECT id FROM portal_offers WHERE id = ? AND status IN ('completed', 'approved')`
  ).get(req.params.id as P) as { id: string } | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Offer not found or not eligible for payment tracking' });
    return;
  }

  db.prepare(`
    UPDATE portal_offers
    SET payment_status    = 'unpaid',
        paid_at           = NULL,
        payment_reference = NULL,
        payment_notes     = NULL,
        updated_at        = datetime('now')
    WHERE id = ?
  `).run(req.params.id as P);

  const updated = db.prepare(`
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
  `).get(req.params.id as P) as Record<string, unknown>;

  res.json(updated);
});

export default router;
