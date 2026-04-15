/**
 * POST /api/webhooks/n8n
 *
 * Inbound webhook from n8n and Render notifications.
 * Validates X-N8N-Secret header, logs event to webhook_events table,
 * returns 200 immediately (n8n handles async processing).
 *
 * Accepted event types:
 *   deploy_complete · deploy_failed · new_compliance_submission
 *   new_influencer_signup · escrow_released · escrow_disputed
 *   error_threshold_exceeded · stalled_campaign
 */
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';

const router = Router();

const VALID_EVENTS = new Set([
  'deploy_complete',
  'deploy_failed',
  'new_compliance_submission',
  'new_influencer_signup',
  'escrow_released',
  'escrow_disputed',
  'error_threshold_exceeded',
  'stalled_campaign',
]);

// ── POST /api/webhooks/n8n ────────────────────────────────────────────────────
router.post('/n8n', async (req: Request, res: Response): Promise<void> => {
  // 1. Validate shared secret
  const secret = req.headers['x-n8n-secret'];
  const expected = process.env.N8N_WEBHOOK_SECRET;

  if (!expected) {
    console.error('[webhooks] N8N_WEBHOOK_SECRET is not configured');
    res.status(503).json({ error: 'Webhook endpoint not configured' });
    return;
  }

  if (!secret || secret !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // 2. Parse and validate payload
  const { event, timestamp, data } = req.body as {
    event: string;
    timestamp: string;
    data: Record<string, unknown>;
  };

  if (!event || !VALID_EVENTS.has(event)) {
    res.status(400).json({
      error: 'Invalid event type',
      valid_events: Array.from(VALID_EVENTS),
    });
    return;
  }

  // 3. Log to webhook_events — return 200 immediately before async work
  const id = uuidv4();
  const received_at = new Date().toISOString();

  // Respond immediately so n8n doesn't time out
  res.json({ ok: true, id, event, received_at });

  // 4. Persist event asynchronously
  try {
    await db.run(
      `INSERT INTO webhook_events (id, event_type, payload, received_at, processed)
       VALUES (?, ?, ?, ?, 0)`,
      [id, event, JSON.stringify({ event, timestamp, data }), received_at],
    );
    console.log(`[webhooks] ${event} logged — id: ${id}`);
  } catch (err) {
    console.error('[webhooks] Failed to log event:', err);
  }
});

// ── GET /api/webhooks/events (admin only — for debugging) ─────────────────────
router.get('/events', async (_req: Request, res: Response): Promise<void> => {
  try {
    const events = await db.all(
      `SELECT id, event_type, received_at, processed
       FROM webhook_events
       ORDER BY received_at DESC
       LIMIT 100`,
      [],
    );
    res.json({ events });
  } catch (err) {
    console.error('[webhooks] Failed to list events:', err);
    res.status(500).json({ error: 'Failed to list events' });
  }
});

export default router;
