/**
 * In-app messaging — per-offer thread between agency ↔ influencer.
 *
 * Routes:
 *   GET  /api/messages/:offerId          — list messages for an offer
 *   POST /api/messages/:offerId          — send a message
 *   PUT  /api/messages/:offerId/read     — mark all messages as read for the caller
 */
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { db } from '../db/connection';
import { sendNewMessageEmail } from '../services/emailService';

const router = Router();

const JWT_SECRET   = process.env.JWT_SECRET   || 'changeme';
const PORTAL_SECRET = process.env.PORTAL_JWT_SECRET || process.env.JWT_SECRET || 'changeme';

/** Resolve the caller from either a main-platform token or a portal token.
 *  Returns { id, senderType, email, name } or null. */
async function resolveAuth(req: Request): Promise<{ id: string; senderType: 'agency' | 'influencer'; email: string | null; name: string | null } | null> {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;

  // Try main platform JWT
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: string };
    const user = await db.get('SELECT id, name, email, role FROM users WHERE id = ?', [decoded.id]) as { id: string; name: string; email: string; role: string } | undefined;
    if (user && ['platform_admin', 'agency', 'brand', 'talent_manager'].includes(user.role)) {
      return { id: user.id, senderType: 'agency', email: user.email, name: user.name };
    }
  } catch { /* fall through */ }

  // Try portal JWT
  try {
    const decoded = jwt.verify(token, PORTAL_SECRET) as { id: string };
    const pu = await db.get('SELECT id, name, email FROM portal_users WHERE id = ?', [decoded.id]) as { id: string; name: string; email: string } | undefined;
    if (pu) return { id: pu.id, senderType: 'influencer', email: pu.email, name: pu.name };
  } catch { /* fall through */ }

  return null;
}

// GET /api/messages/:offerId
router.get('/:offerId', async (req: Request, res: Response) => {
  const caller = await resolveAuth(req);
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });

  const messages = await db.all(`
    SELECT id, offer_id, sender_type, sender_id, body, read_at, created_at
    FROM offer_messages
    WHERE offer_id = ?
    ORDER BY created_at ASC
  `, [req.params.offerId]);

  return res.json({ messages });
});

// POST /api/messages/:offerId
router.post('/:offerId', async (req: Request, res: Response) => {
  const caller = await resolveAuth(req);
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });

  const { body } = req.body as { body?: string };
  if (!body || !body.trim()) return res.status(400).json({ error: 'Message body is required' });

  const offerId = req.params.offerId;

  // Verify offer exists
  const offer = await db.get('SELECT id, title, portal_user_id, created_by FROM portal_offers WHERE id = ?', [offerId]) as
    { id: string; title: string | null; portal_user_id: string | null; created_by: string | null } | undefined;
  if (!offer) return res.status(404).json({ error: 'Offer not found' });

  const msgId = uuidv4();
  await db.run(`
    INSERT INTO offer_messages (id, offer_id, sender_type, sender_id, body)
    VALUES (?, ?, ?, ?, ?)
  `, [msgId, offerId, caller.senderType, caller.id, body.trim()]);

  const message = await db.get('SELECT * FROM offer_messages WHERE id = ?', [msgId]);

  // Notify the other party via email
  try {
    if (caller.senderType === 'agency' && offer.portal_user_id) {
      // Agency sent → notify influencer
      const influencer = await db.get('SELECT email, name FROM portal_users WHERE id = ?', [offer.portal_user_id]) as { email: string; name: string } | undefined;
      if (influencer?.email) {
        await sendNewMessageEmail(influencer.email, {
          recipientName: influencer.name,
          senderName: caller.name || 'Agency',
          offerTitle: offer.title || 'Untitled offer',
          messagePreview: body.trim().slice(0, 160),
          offerId: offer.id,
          isPortal: true,
        });
      }
    } else if (caller.senderType === 'influencer' && offer.created_by) {
      // Influencer sent → notify agency
      const agency = await db.get('SELECT email, name FROM users WHERE id = ?', [offer.created_by]) as { email: string; name: string } | undefined;
      if (agency?.email) {
        await sendNewMessageEmail(agency.email, {
          recipientName: agency.name,
          senderName: caller.name || 'Influencer',
          offerTitle: offer.title || 'Untitled offer',
          messagePreview: body.trim().slice(0, 160),
          offerId: offer.id,
          isPortal: false,
        });
      }
    }
  } catch (err) {
    console.error('[messages] Email notification failed:', err);
  }

  return res.status(201).json({ message });
});

// PUT /api/messages/:offerId/read — mark all unread messages from the other side as read
router.put('/:offerId/read', async (req: Request, res: Response) => {
  const caller = await resolveAuth(req);
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });

  const otherType = caller.senderType === 'agency' ? 'influencer' : 'agency';

  await db.run(`
    UPDATE offer_messages
    SET read_at = NOW()
    WHERE offer_id = ? AND sender_type = ? AND read_at IS NULL
  `, [req.params.offerId, otherType]);

  return res.json({ ok: true });
});

export default router;
