/**
 * Loyalty programme routes.
 *
 * Tiers per user_type:
 *   Influencer → Bronze 0-99  | Silver 100-499 | Gold 500-1999 | Platinum 2000+
 *   Agency     → Bronze 0-49  | Silver 50-199  | Gold 200-499  | Platinum 500+
 *   Fan        → Bronze 0-29  | Silver 30-99   | Gold 100-299  | Platinum 300+
 *   Brand      → Bronze 0-99  | Silver 100-499 | Gold 500-1999 | Platinum 2000+
 *
 * Points per action:
 *   offer_accepted           → Influencer +10
 *   offer_completed          → Influencer +25
 *   offer_sent               → Agency     +5
 *   fan_request_fulfilled    → Fan        +10
 *   review_left              → Fan        +5
 *
 * Benefits (lower commission for higher tiers — influencers):
 *   Bronze   → standard platform commission
 *   Silver   → -1% commission (agency pays normal, platform takes less)
 *   Gold     → -2% commission
 *   Platinum → -3% commission + featured placement in Discover
 *
 * Routes:
 *   GET  /api/loyalty/me             — current user's points & tier (portal auth OR main auth)
 *   GET  /api/loyalty/history        — points history for current user
 *   GET  /api/loyalty/leaderboard    — top earners ?user_type=influencer
 *   POST /api/loyalty/award          — (admin only) manually award points
 *   GET  /api/loyalty/all            — (admin) all users' loyalty summary
 */
import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getDb } from '../db/schema';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P = any;

const PORTAL_JWT_SECRET = process.env.JWT_SECRET || 'cp-portal-secret-change-in-prod';

// Tier thresholds per user type
const TIER_THRESHOLDS: Record<string, [number, string][]> = {
  influencer: [[2000, 'Platinum'], [500, 'Gold'], [100, 'Silver'], [0, 'Bronze']],
  agency:     [[500,  'Platinum'], [200, 'Gold'], [50,  'Silver'], [0, 'Bronze']],
  fan:        [[300,  'Platinum'], [100, 'Gold'], [30,  'Silver'], [0, 'Bronze']],
  brand:      [[2000, 'Platinum'], [500, 'Gold'], [100, 'Silver'], [0, 'Bronze']],
};

// Commission discount per influencer tier
const INFLUENCER_COMMISSION_DISCOUNT: Record<string, number> = {
  Bronze: 0, Silver: 1, Gold: 2, Platinum: 3,
};

function getTier(userType: string, totalPoints: number): string {
  const thresholds = TIER_THRESHOLDS[userType] || TIER_THRESHOLDS.influencer;
  for (const [min, name] of thresholds) {
    if (totalPoints >= min) return name;
  }
  return 'Bronze';
}

function nextTierInfo(userType: string, totalPoints: number): { next_tier: string | null; points_needed: number } {
  const thresholds = TIER_THRESHOLDS[userType] || TIER_THRESHOLDS.influencer;
  for (let i = 0; i < thresholds.length - 1; i++) {
    const [current_min] = thresholds[i];
    const [, next_name] = thresholds[i];
    const [next_min] = thresholds[i - 1] || [current_min, next_name];
    if (i === 0 && totalPoints < current_min) {
      return { next_tier: thresholds[0][1], points_needed: current_min - totalPoints };
    }
  }
  // Walk forward (thresholds are descending)
  for (let i = thresholds.length - 1; i > 0; i--) {
    if (totalPoints < thresholds[i - 1][0]) {
      return { next_tier: thresholds[i - 1][1], points_needed: thresholds[i - 1][0] - totalPoints };
    }
  }
  return { next_tier: null, points_needed: 0 }; // already at top
}

// Dual-auth middleware: accepts either portal JWT or main platform JWT
interface DualAuthRequest extends Request {
  loyaltyUserId?: string;
  loyaltyUserType?: string;
  isAdmin?: boolean;
}

function requireLoyaltyAuth(req: DualAuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const db = getDb();

  // Try portal JWT first
  try {
    const payload = jwt.verify(token, PORTAL_JWT_SECRET) as Record<string, unknown>;
    const user = db.prepare('SELECT id FROM portal_users WHERE id = ?').get(payload.id as P) as { id: string } | undefined;
    if (user) {
      req.loyaltyUserId   = user.id;
      req.loyaltyUserType = 'influencer';
      return next();
    }
  } catch { /* not a portal token */ }

  // Try main platform JWT
  try {
    const mainSecret = process.env.JWT_SECRET || 'change-me-in-prod';
    const payload = jwt.verify(token, mainSecret) as Record<string, unknown>;
    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(payload.id as P) as { id: string; role: string } | undefined;
    if (user) {
      req.loyaltyUserId   = user.id;
      req.loyaltyUserType = user.role === 'platform_admin' ? 'agency' : user.role;
      req.isAdmin         = user.role === 'platform_admin';
      return next();
    }
  } catch { /* not a main token */ }

  return res.status(401).json({ error: 'Invalid token' });
}

// ── GET /api/loyalty/me ────────────────────────────────────────────────────────
router.get('/me', requireLoyaltyAuth, (req: DualAuthRequest, res: Response) => {
  const db  = getDb();
  const uid = req.loyaltyUserId!;
  const ut  = req.loyaltyUserType!;

  const totalRow = db.prepare(`
    SELECT COALESCE(SUM(points), 0) AS total FROM loyalty_points WHERE user_id = ? AND user_type = ?
  `).get(uid, ut) as { total: number };

  const total = totalRow.total;
  const tier  = getTier(ut, total);
  const next  = nextTierInfo(ut, total);

  const commissionDiscount = ut === 'influencer' ? (INFLUENCER_COMMISSION_DISCOUNT[tier] || 0) : 0;

  const commPctRow = db.prepare("SELECT value FROM settings WHERE key = 'platform_commission_pct'")
    .get() as { value: string } | undefined;
  const baseCommission  = parseFloat(commPctRow?.value || '10');
  const effectiveCommission = Math.max(0, baseCommission - commissionDiscount);

  res.json({
    user_id:              uid,
    user_type:            ut,
    total_points:         total,
    tier,
    next_tier:            next.next_tier,
    points_to_next_tier:  next.points_needed,
    commission_discount_pct: commissionDiscount,
    effective_commission_pct: effectiveCommission,
  });
});

// ── GET /api/loyalty/history ───────────────────────────────────────────────────
router.get('/history', requireLoyaltyAuth, (req: DualAuthRequest, res: Response) => {
  const db  = getDb();
  const uid = req.loyaltyUserId!;
  const ut  = req.loyaltyUserType!;
  const { page = '1', limit = '20' } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const rows = db.prepare(`
    SELECT * FROM loyalty_points WHERE user_id = ? AND user_type = ?
    ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(uid, ut, parseInt(limit), offset) as Record<string, unknown>[];

  res.json(rows);
});

// ── GET /api/loyalty/leaderboard ───────────────────────────────────────────────
router.get('/leaderboard', (req: Request, res: Response) => {
  const db = getDb();
  const { user_type = 'influencer', limit = '10' } = req.query as Record<string, string>;

  const rows = db.prepare(`
    SELECT user_id, user_type, SUM(points) AS total_points
    FROM loyalty_points WHERE user_type = ?
    GROUP BY user_id, user_type
    ORDER BY total_points DESC
    LIMIT ?
  `).all(user_type, parseInt(limit)) as { user_id: string; user_type: string; total_points: number }[];

  // Enrich with names for influencers
  const enriched = rows.map((r, i) => {
    let name = r.user_id;
    try {
      if (r.user_type === 'influencer') {
        const pu = db.prepare('SELECT name FROM portal_users WHERE id = ?').get(r.user_id as P) as { name: string } | undefined;
        if (pu?.name) name = pu.name;
      }
    } catch { /* ignore */ }
    return {
      rank: i + 1,
      user_id: r.user_id,
      user_type: r.user_type,
      total_points: r.total_points,
      tier: getTier(r.user_type, r.total_points),
      display_name: name,
    };
  });

  res.json(enriched);
});

// ── POST /api/loyalty/award (admin only) ───────────────────────────────────────
router.post('/award', requireAuth('platform_admin'), (req: AuthRequest, res: Response) => {
  const { user_type, user_id, action, points, note, reference_id } = req.body as {
    user_type: string; user_id: string; action: string; points: number; note?: string; reference_id?: string;
  };
  if (!user_type || !user_id || !action || !points) {
    return res.status(400).json({ error: 'user_type, user_id, action, and points are required' });
  }
  const db = getDb();
  db.prepare(`
    INSERT INTO loyalty_points (id, user_type, user_id, action, points, reference_id, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), user_type, user_id, action, points, reference_id || null, note || null);
  res.json({ success: true });
});

// ── GET /api/loyalty/all (admin) ───────────────────────────────────────────────
router.get('/all', requireAuth('platform_admin'), (_req: AuthRequest, res: Response) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT user_id, user_type, SUM(points) AS total_points, COUNT(*) AS action_count,
           MAX(created_at) AS last_activity
    FROM loyalty_points
    GROUP BY user_id, user_type
    ORDER BY total_points DESC
    LIMIT 100
  `).all() as Record<string, unknown>[];

  const enriched = rows.map(r => ({
    ...r,
    tier: getTier(r.user_type as string, r.total_points as number),
  }));
  res.json(enriched);
});

export default router;
