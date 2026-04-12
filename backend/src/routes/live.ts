/**
 * GET /api/live/feed   — Server-Sent Events stream (viewer + admin)
 * GET /api/live/metrics — Current platform snapshot (viewer + admin)
 *
 * No new dependencies — SSE is plain HTTP.
 *
 * Auth note: EventSource cannot send custom headers, so the feed endpoint
 * also accepts the JWT via ?token= query param (only for SSE — GET-only,
 * no side effects, safe).  The metrics endpoint uses the normal Bearer header.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db/connection';
import { requireViewerOrAdmin, JWT_SECRET } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import liveEmitter, { type LiveEvent } from '../events/liveEmitter';
import jwt from 'jsonwebtoken';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function filterDemo(): string {
  return process.env.LIVE_VIEW_MODE === 'true' ? 'AND is_demo = 0' : '';
}

function sseWrite(res: Response, event: Omit<LiveEvent, 'ts'> | { type: 'heartbeat' }) {
  const payload = JSON.stringify({ ...event, ts: new Date().toISOString() });
  res.write(`data: ${payload}\n\n`);
  // flush if compression middleware is active
  if (typeof (res as Response & { flush?: () => void }).flush === 'function') {
    (res as Response & { flush: () => void }).flush();
  }
}

// ── SSE token middleware (query param fallback for EventSource) ───────────────

function sseAuth(req: Request, res: Response, next: NextFunction): void {
  // If Authorization header already present, delegate to normal middleware
  if (req.headers.authorization) { requireViewerOrAdmin()(req as AuthRequest, res, next); return; }

  // Accept ?token= for EventSource clients that cannot set headers
  const token = (req.query.token as string | undefined)?.trim();
  if (!token) { res.status(401).json({ error: 'Unauthorized — no token' }); return; }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
    db.get('SELECT id, role, status FROM users WHERE id = ? AND status = ?', [payload.id, 'active'])
      .then(user => {
        if (!user) { res.status(401).json({ error: 'User not found or suspended' }); return; }
        const role = user.role as string;
        if (!['platform_admin', 'viewer'].includes(role)) {
          res.status(403).json({ error: 'Forbidden — insufficient role' }); return;
        }
        (req as AuthRequest).user = user;
        next();
      })
      .catch(() => res.status(401).json({ error: 'Auth error' }));
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── GET /api/live/feed ────────────────────────────────────────────────────────

router.get('/feed', sseAuth, (req: AuthRequest, res: Response) => {
  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  // Send an immediate heartbeat so the client knows the connection is live
  sseWrite(res, { type: 'heartbeat' });

  // Forward every liveEmitter event to this client
  const handler = (event: LiveEvent) => {
    try {
      sseWrite(res, event);
    } catch {
      // client already disconnected — listener will be cleaned up below
    }
  };
  liveEmitter.on('event', handler);

  // 30-second heartbeat to keep the connection alive through proxies
  const heartbeat = setInterval(() => {
    try {
      sseWrite(res, { type: 'heartbeat' });
    } catch {
      clearInterval(heartbeat);
    }
  }, 30_000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    liveEmitter.off('event', handler);
    res.end();
  });
});

// ── GET /api/live/metrics ─────────────────────────────────────────────────────

router.get('/metrics', requireViewerOrAdmin(), async (_req: AuthRequest, res: Response) => {
  try {
    const demo = filterDemo();

    // Total active influencers
    const infRow = await db.get(
      `SELECT COUNT(*) AS cnt FROM influencers WHERE is_archived = 0 ${demo}`, []
    ) as { cnt: number };

    // Active campaigns
    const campRow = await db.get(
      `SELECT COUNT(*) AS cnt FROM campaigns WHERE status = 'active' AND is_archived = 0 ${demo}`, []
    ) as { cnt: number };

    // Total paid this calendar month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartStr = monthStart.toISOString();

    const paidRow = await db.get(
      `SELECT COALESCE(SUM(rate), 0) AS total
       FROM portal_offers
       WHERE payment_status = 'paid'
         AND paid_at >= ?
         ${demo.replace('AND is_demo', 'AND is_demo')}`,
      [monthStartStr]
    ) as { total: number };

    // Average hours from offer created to paid
    const avgHoursRow = await db.get(
      `SELECT AVG(
         (JULIANDAY(paid_at) - JULIANDAY(created_at)) * 24
       ) AS avg_hours
       FROM portal_offers
       WHERE payment_status = 'paid' AND paid_at IS NOT NULL ${demo}`, []
    ) as { avg_hours: number | null };

    // Last 8 paid offers with influencer info
    const recentPayments = await db.all(
      `SELECT
         o.id,
         o.title,
         COALESCE(i.name_english, i.name_arabic, o.title) AS influencer_name,
         i.country AS market,
         c.name AS campaign,
         o.rate AS amount,
         o.currency,
         o.paid_at AS timestamp
       FROM portal_offers o
       LEFT JOIN influencers i ON o.influencer_id = i.id
       LEFT JOIN campaigns   c ON o.campaign_id   = c.id
       WHERE o.payment_status = 'paid' AND o.paid_at IS NOT NULL ${demo}
       ORDER BY o.paid_at DESC
       LIMIT 8`, []
    ) as Record<string, unknown>[];

    res.json({
      total_influencers: infRow?.cnt ?? 0,
      active_campaigns: campRow?.cnt ?? 0,
      total_paid_this_month: {
        amount: Math.round((paidRow?.total ?? 0) * 100) / 100,
        currency: 'SAR',
      },
      avg_payment_hours: avgHoursRow?.avg_hours != null
        ? Math.round(avgHoursRow.avg_hours * 10) / 10
        : null,
      recent_payments: recentPayments,
    });
  } catch (err) {
    console.error('[live/metrics]', err);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

export default router;
