/**
 * Revenue & Commission routes — platform monetisation dashboard.
 *
 * GET  /api/revenue/summary        — total revenue KPIs
 * GET  /api/revenue/commissions    — paginated commission ledger
 * PUT  /api/revenue/commissions/:id/collect — mark a commission as collected
 * GET  /api/revenue/settings       — commission rate + subscription prices
 * PUT  /api/revenue/settings       — update commission rate
 */
import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getDb } from '../db/schema';

const router = Router();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P = any;

// ── GET /api/revenue/summary ───────────────────────────────────────────────────
router.get('/summary', requireAuth('platform_admin', 'agency'), (_req: AuthRequest, res: Response) => {
  const db = getDb();

  const total = db.prepare(`
    SELECT
      COUNT(*)                                              AS total_commissions,
      COALESCE(SUM(commission_amount), 0)                  AS total_earned,
      COALESCE(SUM(CASE WHEN status='COLLECTED' THEN commission_amount ELSE 0 END), 0) AS collected,
      COALESCE(SUM(CASE WHEN status='PENDING'   THEN commission_amount ELSE 0 END), 0) AS pending,
      COALESCE(SUM(gross_amount), 0)                        AS total_offer_volume
    FROM commissions WHERE transaction_type = 'offer'
  `).get() as Record<string, number>;

  const monthlyRow = db.prepare(`
    SELECT COALESCE(SUM(commission_amount), 0) AS this_month
    FROM commissions
    WHERE transaction_type = 'offer'
      AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
  `).get() as { this_month: number };

  const activeOffers = db.prepare(`
    SELECT COUNT(*) AS cnt FROM portal_offers WHERE status IN ('accepted','in_progress','submitted')
  `).get() as { cnt: number };

  const commPctRow = db.prepare("SELECT value FROM settings WHERE key = 'platform_commission_pct'")
    .get() as { value: string } | undefined;

  res.json({
    commission_rate_pct:    parseFloat(commPctRow?.value || '10'),
    total_commissions:      total.total_commissions,
    total_earned:           total.total_earned,
    collected:              total.collected,
    pending:                total.pending,
    total_offer_volume:     total.total_offer_volume,
    this_month_earned:      monthlyRow.this_month,
    active_offers:          activeOffers.cnt,
  });
});

// ── GET /api/revenue/commissions ───────────────────────────────────────────────
router.get('/commissions', requireAuth('platform_admin', 'agency'), (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { status, page = '1', limit = '50' } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where = status ? 'WHERE c.status = ?' : '';
  const params: P[] = status ? [status, parseInt(limit), offset] : [parseInt(limit), offset];

  const rows = db.prepare(`
    SELECT c.*,
           i.name_english AS influencer_name, i.ig_handle
    FROM commissions c
    LEFT JOIN influencers i ON c.influencer_id = i.id
    ${where}
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params) as Record<string, unknown>[];

  const totalRow = db.prepare(`SELECT COUNT(*) AS cnt FROM commissions ${where}`)
    .get(...(status ? [status] : [])) as { cnt: number };

  res.json({ items: rows, total: totalRow.cnt, page: parseInt(page), limit: parseInt(limit) });
});

// ── PUT /api/revenue/commissions/:id/collect ───────────────────────────────────
router.put('/commissions/:id/collect', requireAuth('platform_admin'), (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { reference } = req.body as { reference?: string };
  db.prepare(`
    UPDATE commissions SET status = 'COLLECTED', collected_at = datetime('now')
    WHERE id = ?
  `).run(req.params.id as P);
  if (reference) {
    db.prepare(`UPDATE commissions SET offer_title = COALESCE(offer_title, ?) WHERE id = ?`)
      .run(reference as P, req.params.id as P);
  }
  res.json({ success: true });
});

// ── GET /api/revenue/settings ──────────────────────────────────────────────────
router.get('/settings', requireAuth('platform_admin'), (_req: AuthRequest, res: Response) => {
  const db = getDb();
  const keys = [
    'platform_commission_pct',
    'subscription_growth_price_egp',
    'subscription_pro_price_egp',
    'subscription_enterprise_price_egp',
  ];
  const out: Record<string, string> = {};
  for (const k of keys) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(k as P) as { value: string } | undefined;
    out[k] = row?.value || '';
  }
  res.json(out);
});

// ── PUT /api/revenue/settings ──────────────────────────────────────────────────
router.put('/settings', requireAuth('platform_admin'), (req: AuthRequest, res: Response) => {
  const db = getDb();
  const allowed = [
    'platform_commission_pct',
    'subscription_growth_price_egp',
    'subscription_pro_price_egp',
    'subscription_enterprise_price_egp',
  ];
  const body = req.body as Record<string, string>;
  for (const key of allowed) {
    if (body[key] !== undefined) {
      db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))')
        .run(key as P, String(body[key]) as P);
    }
  }
  res.json({ success: true });
});

// ── GET /api/revenue/offer-breakdown ──────────────────────────────────────────
// Monthly breakdown for chart
router.get('/offer-breakdown', requireAuth('platform_admin', 'agency'), (_req: AuthRequest, res: Response) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT strftime('%Y-%m', created_at) AS month,
           COUNT(*) AS offer_count,
           COALESCE(SUM(gross_amount), 0) AS volume,
           COALESCE(SUM(commission_amount), 0) AS earned
    FROM commissions
    WHERE transaction_type = 'offer'
    GROUP BY month
    ORDER BY month DESC
    LIMIT 12
  `).all() as Record<string, unknown>[];
  res.json(rows.reverse());
});

export default router;
