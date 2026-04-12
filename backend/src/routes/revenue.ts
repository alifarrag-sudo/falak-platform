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
import { db } from '../db/connection';

const router = Router();

// ── GET /api/revenue/summary ───────────────────────────────────────────────────
router.get('/summary', requireAuth('platform_admin', 'agency', 'viewer'), async (_req: AuthRequest, res: Response) => {
  const total = await db.get(`
    SELECT
      COUNT(*)                                              AS total_commissions,
      COALESCE(SUM(commission_amount), 0)                  AS total_earned,
      COALESCE(SUM(CASE WHEN status='COLLECTED' THEN commission_amount ELSE 0 END), 0) AS collected,
      COALESCE(SUM(CASE WHEN status='PENDING'   THEN commission_amount ELSE 0 END), 0) AS pending,
      COALESCE(SUM(gross_amount), 0)                        AS total_offer_volume
    FROM commissions WHERE transaction_type = 'offer'
  `, []) as Record<string, number>;

  const monthlyRow = await db.get(`
    SELECT COALESCE(SUM(commission_amount), 0) AS this_month
    FROM commissions
    WHERE transaction_type = 'offer'
      AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
  `, []) as { this_month: number };

  const activeOffers = await db.get(`
    SELECT COUNT(*) AS cnt FROM portal_offers WHERE status IN ('accepted','in_progress','submitted')
  `, []) as { cnt: number };

  const commPctRow = await db.get("SELECT value FROM settings WHERE key = 'platform_commission_pct'", []) as { value: string } | undefined;

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
router.get('/commissions', requireAuth('platform_admin', 'agency', 'viewer'), async (req: AuthRequest, res: Response) => {
  const { status, page = '1', limit = '50' } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where = status ? 'WHERE c.status = ?' : '';
  const filterParams: unknown[] = status ? [status] : [];

  const rows = await db.all(`
    SELECT c.*,
           i.name_english AS influencer_name, i.ig_handle
    FROM commissions c
    LEFT JOIN influencers i ON c.influencer_id = i.id
    ${where}
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `, [...filterParams, parseInt(limit), offset]) as Record<string, unknown>[];

  const totalRow = await db.get(`SELECT COUNT(*) AS cnt FROM commissions ${where}`, filterParams) as { cnt: number };

  res.json({ items: rows, total: totalRow.cnt, page: parseInt(page), limit: parseInt(limit) });
});

// ── PUT /api/revenue/commissions/:id/collect ───────────────────────────────────
router.put('/commissions/:id/collect', requireAuth('platform_admin'), async (req: AuthRequest, res: Response) => {
  const { reference } = req.body as { reference?: string };
  await db.run(`
    UPDATE commissions SET status = 'COLLECTED', collected_at = NOW()
    WHERE id = ?
  `, [req.params.id]);
  if (reference) {
    await db.run(`UPDATE commissions SET offer_title = COALESCE(offer_title, ?) WHERE id = ?`, [reference, req.params.id]);
  }
  res.json({ success: true });
});

// ── GET /api/revenue/settings ──────────────────────────────────────────────────
router.get('/settings', requireAuth('platform_admin'), async (_req: AuthRequest, res: Response) => {
  const keys = [
    'platform_commission_pct',
    'subscription_growth_price_egp',
    'subscription_pro_price_egp',
    'subscription_enterprise_price_egp',
  ];
  const out: Record<string, string> = {};
  for (const k of keys) {
    const row = await db.get('SELECT value FROM settings WHERE key = ?', [k]) as { value: string } | undefined;
    out[k] = row?.value || '';
  }
  res.json(out);
});

// ── PUT /api/revenue/settings ──────────────────────────────────────────────────
router.put('/settings', requireAuth('platform_admin'), async (req: AuthRequest, res: Response) => {
  const allowed = [
    'platform_commission_pct',
    'subscription_growth_price_egp',
    'subscription_pro_price_egp',
    'subscription_enterprise_price_egp',
  ];
  const body = req.body as Record<string, string>;
  for (const key of allowed) {
    if (body[key] !== undefined) {
      await db.run(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, NOW()) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`, [key, String(body[key])]);
    }
  }
  res.json({ success: true });
});

// ── GET /api/revenue/offer-breakdown ──────────────────────────────────────────
// Monthly breakdown for chart
router.get('/offer-breakdown', requireAuth('platform_admin', 'agency', 'viewer'), async (_req: AuthRequest, res: Response) => {
  const rows = await db.all(`
    SELECT TO_CHAR(created_at, 'YYYY-MM') AS month,
           COUNT(*) AS offer_count,
           COALESCE(SUM(gross_amount), 0) AS volume,
           COALESCE(SUM(commission_amount), 0) AS earned
    FROM commissions
    WHERE transaction_type = 'offer'
    GROUP BY month
    ORDER BY month DESC
    LIMIT 12
  `, []) as Record<string, unknown>[];
  res.json(rows.reverse());
});

export default router;
