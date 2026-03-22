/**
 * Agency-side offer management
 * - Send offers to influencers (creates portal_offer + optionally invites by email)
 * - Review submitted deliverables (approve / reject)
 * - List all offers with status tracking
 */
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/schema';
import { createNotification } from './notifications';
import { sendOfferReceivedEmail, sendOfferStatusEmail } from '../services/emailService';

const router = Router();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P = any;

/* ── List all offers ──────────────────────────────────────── */
router.get('/', (req, res) => {
  const db = getDb();
  const { campaign_id, status, influencer_id, search, page = '1', limit = '20' } = req.query;

  const conditions: string[] = [];
  const params: P[] = [];

  if (campaign_id) { conditions.push('o.campaign_id = ?'); params.push(campaign_id); }
  if (status)      { conditions.push('o.status = ?');      params.push(status); }
  if (influencer_id) { conditions.push('o.influencer_id = ?'); params.push(influencer_id); }
  if (search) {
    const q = `%${search}%`;
    conditions.push('(i.name_english LIKE ? OR i.name_arabic LIKE ? OR i.ig_handle LIKE ? OR o.title LIKE ? OR c.name LIKE ?)');
    params.push(q, q, q, q, q);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const offset = (parseInt(String(page)) - 1) * parseInt(String(limit));

  const total = (db.prepare(`
    SELECT COUNT(*) as n FROM portal_offers o
    LEFT JOIN campaigns c ON o.campaign_id = c.id
    LEFT JOIN influencers i ON o.influencer_id = i.id
    ${where}
  `).get(...params as P[]) as { n: number }).n;
  const rows = db.prepare(`
    SELECT o.*,
      c.name AS campaign_name,
      pu.email AS portal_email,
      pu.name  AS portal_name,
      i.name_english AS influencer_name,
      i.name_arabic  AS influencer_name_arabic
    FROM portal_offers o
    LEFT JOIN campaigns c     ON o.campaign_id  = c.id
    LEFT JOIN portal_users pu ON o.portal_user_id = pu.id
    LEFT JOIN influencers  i  ON o.influencer_id   = i.id
    ${where}
    ORDER BY o.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params as P[], parseInt(String(limit)), offset) as Record<string, unknown>[];

  res.json({ data: rows, total, page: parseInt(String(page)), limit: parseInt(String(limit)) });
});

/* ── Stats (must be before /:id to avoid route conflict) ─── */
router.get('/stats/summary', (_req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT status, COUNT(*) as count FROM portal_offers GROUP BY status
  `).all() as { status: string; count: number }[];
  res.json(rows);
});

/* ── Get single offer ─────────────────────────────────────── */
router.get('/:id', (req, res) => {
  const db = getDb();
  const offer = db.prepare(`
    SELECT o.*,
      c.name AS campaign_name, c.client_name,
      pu.email AS portal_email, pu.name AS portal_name,
      i.name_english AS influencer_name, i.ig_handle, i.tiktok_handle
    FROM portal_offers o
    LEFT JOIN campaigns c     ON o.campaign_id  = c.id
    LEFT JOIN portal_users pu ON o.portal_user_id = pu.id
    LEFT JOIN influencers  i  ON o.influencer_id   = i.id
    WHERE o.id = ?
  `).get(req.params.id) as Record<string, unknown> | undefined;

  if (!offer) return res.status(404).json({ error: 'Not found' });

  const deliverables = db.prepare(`
    SELECT d.*, pu.name AS submitter_name, pu.email AS submitter_email
    FROM portal_deliverables d
    JOIN portal_users pu ON d.portal_user_id = pu.id
    WHERE d.offer_id = ?
    ORDER BY d.submitted_at DESC
  `).all(offer.id as P) as Record<string, unknown>[];

  res.json({ ...offer, deliverables });
});

/* ── Bulk send offers (must be before /:id) ─────────────────── */
router.post('/bulk', (req, res) => {
  const {
    influencer_ids,
    campaign_id, title, brief, platform, deliverables,
    rate, currency = 'SAR', deadline, agency_notes
  } = req.body;

  if (!Array.isArray(influencer_ids) || influencer_ids.length === 0) {
    return res.status(400).json({ error: 'influencer_ids array is required' });
  }
  if (!title) return res.status(400).json({ error: 'title is required' });

  const db = getDb();
  const now = new Date().toISOString();
  const created: Record<string, unknown>[] = [];
  const errors: { influencer_id: string; error: string }[] = [];

  for (const influencer_id of influencer_ids) {
    try {
      const id = uuidv4();
      // Find linked portal user
      const portalUser = db.prepare(
        `SELECT pu.id FROM portal_users pu WHERE pu.influencer_id = ? LIMIT 1`
      ).get(influencer_id as P) as { id: string } | undefined;

      db.prepare(`
        INSERT INTO portal_offers
          (id, campaign_id, influencer_id, portal_user_id, title, brief, platform,
           deliverables, rate, currency, deadline, agency_notes, status, sent_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', ?, ?, ?)
      `).run(
        id, campaign_id || null, influencer_id, portalUser?.id || null,
        title, brief || null, platform || null, deliverables || null,
        rate || null, currency, deadline || null, agency_notes || null,
        now, now, now
      );

      const offer = db.prepare('SELECT * FROM portal_offers WHERE id = ?').get(id) as Record<string, unknown>;
      created.push(offer);

      // Notify influencer (in-app + email)
      try {
        const inf = db.prepare('SELECT name_english, email FROM influencers WHERE id = ?')
          .get(influencer_id as P) as { name_english?: string; email?: string } | undefined;
        const campaign = campaign_id
          ? db.prepare('SELECT name FROM campaigns WHERE id = ?').get(campaign_id as P) as { name?: string } | undefined
          : undefined;

        if (portalUser) {
          const pu = db.prepare('SELECT email FROM portal_users WHERE id = ?')
            .get(portalUser.id as P) as { email: string } | undefined;
          if (pu?.email) {
            const unifiedUser = db.prepare('SELECT id FROM users WHERE email = ?')
              .get(pu.email as P) as { id: string } | undefined;
            if (unifiedUser) {
              createNotification(unifiedUser.id, 'offer_received', 'New offer received',
                `You have a new offer: ${title}`, `/portal/offers/${id}`);
            }
            // Send email to portal email
            sendOfferReceivedEmail(pu.email, {
              influencerName: inf?.name_english || pu.email.split('@')[0],
              campaignName: campaign?.name,
              offerTitle: title,
              rate,
              currency,
              deadline,
              platform,
            }).catch(() => {});
          }
        } else if (inf?.email) {
          // No portal user yet — email the influencer's direct email
          sendOfferReceivedEmail(inf.email, {
            influencerName: inf.name_english || inf.email.split('@')[0],
            campaignName: campaign?.name,
            offerTitle: title,
            rate,
            currency,
            deadline,
            platform,
          }).catch(() => {});
        }
      } catch { /* non-fatal */ }
    } catch (err) {
      errors.push({ influencer_id, error: String(err) });
    }
  }

  res.status(201).json({ created, errors, count: created.length });
});

/* ── Create / send offer ─────────────────────────────────────── */
router.post('/', (req, res) => {
  const {
    campaign_id, influencer_id, portal_user_id,
    title, brief, platform, deliverables,
    rate, currency = 'SAR', deadline, agency_notes
  } = req.body;

  if (!title || !influencer_id) return res.status(400).json({ error: 'title and influencer_id are required' });

  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO portal_offers
      (id, campaign_id, influencer_id, portal_user_id, title, brief, platform,
       deliverables, rate, currency, deadline, agency_notes, status, sent_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', ?, ?, ?)
  `).run(
    id, campaign_id || null, influencer_id, portal_user_id || null,
    title, brief || null, platform || null, deliverables || null,
    rate || null, currency, deadline || null, agency_notes || null,
    now, now, now
  );

  const offer = db.prepare('SELECT * FROM portal_offers WHERE id = ?').get(id) as Record<string, unknown>;

  // Notify the influencer that they have received a new offer.
  // We look up the linked portal user (if any) and their unified user account.
  try {
    // First try to find a portal_user linked to this influencer
    const portalUser = db.prepare(
      `SELECT pu.id FROM portal_users pu WHERE pu.influencer_id = ? LIMIT 1`
    ).get(influencer_id as P) as { id: string } | undefined;

    if (portalUser) {
      // Try to find a unified users account with the same email as the portal user
      const portalUserFull = db.prepare('SELECT email FROM portal_users WHERE id = ?')
        .get(portalUser.id as P) as { email: string } | undefined;
      if (portalUserFull?.email) {
        const unifiedUser = db.prepare('SELECT id FROM users WHERE email = ?')
          .get(portalUserFull.email as P) as { id: string } | undefined;
        if (unifiedUser) {
          createNotification(
            unifiedUser.id,
            'offer_received',
            'New offer received',
            `You have a new offer: ${title}`,
            `/portal/offers/${id}`
          );
        }
      }
    }
  } catch (notifErr) {
    console.error('Notification trigger failed (offer created):', notifErr);
  }

  res.status(201).json(offer);
});

/* ── Update offer ─────────────────────────────────────────── */
router.put('/:id', (req, res) => {
  const allowed = ['title', 'brief', 'platform', 'deliverables', 'rate', 'currency', 'deadline', 'agency_notes', 'status'];
  const db = getDb();
  const updates: Record<string, unknown> = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' });

  // Fetch old status before updating so we can detect status changes
  const prevOffer = db.prepare('SELECT * FROM portal_offers WHERE id = ?')
    .get(req.params.id as P) as Record<string, unknown> | undefined;

  updates.updated_at = new Date().toISOString();
  const set = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const vals = Object.values(updates);
  db.prepare(`UPDATE portal_offers SET ${set} WHERE id = ?`).run(...vals as P[], req.params.id);

  const offer = db.prepare('SELECT * FROM portal_offers WHERE id = ?').get(req.params.id) as Record<string, unknown>;

  // Fire status-change notifications to the agency/admin user when an influencer's
  // offer status changes to accepted or declined (agency-side status updates).
  const newStatus = updates.status as string | undefined;
  if (prevOffer && newStatus && prevOffer.status !== newStatus && ['accepted', 'declined', 'completed'].includes(newStatus)) {
    try {
      // Find the agency/admin user — we look for any platform_admin or agency user.
      // Prefer the user who created the linked campaign, otherwise fall back to any admin.
      let agencyUserId: string | undefined;
      if (prevOffer.campaign_id) {
        const campaign = db.prepare('SELECT created_by FROM campaigns WHERE id = ?')
          .get(prevOffer.campaign_id as P) as { created_by: string } | undefined;
        if (campaign?.created_by) {
          const adminUser = db.prepare(`SELECT id FROM users WHERE (display_name = ? OR email = ?) LIMIT 1`)
            .get(campaign.created_by as P, campaign.created_by as P) as { id: string } | undefined;
          agencyUserId = adminUser?.id;
        }
      }
      if (!agencyUserId) {
        const fallback = db.prepare(`SELECT id FROM users WHERE role IN ('platform_admin','agency') LIMIT 1`)
          .get() as { id: string } | undefined;
        agencyUserId = fallback?.id;
      }

      if (agencyUserId) {
        const influencerName = (offer.influencer_name as string) || 'An influencer';
        const offerTitle = (offer.title as string) || 'offer';
        const typeMap: Record<string, string> = {
          accepted:  'offer_accepted',
          declined:  'offer_declined',
          completed: 'offer_completed',
        };
        const titleMap: Record<string, string> = {
          accepted:  'Offer accepted',
          declined:  'Offer declined',
          completed: 'Offer completed',
        };
        const msgMap: Record<string, string> = {
          accepted:  `${influencerName} accepted the offer: ${offerTitle}`,
          declined:  `${influencerName} declined the offer: ${offerTitle}`,
          completed: `Offer completed: ${offerTitle}`,
        };
        createNotification(
          agencyUserId,
          typeMap[newStatus],
          titleMap[newStatus],
          msgMap[newStatus],
          `/offers/${req.params.id}`
        );

        // Email the agency user
        const agencyUser = db.prepare('SELECT email, display_name FROM users WHERE id = ?')
          .get(agencyUserId as P) as { email: string; display_name: string } | undefined;
        if (agencyUser?.email && ['accepted', 'declined'].includes(newStatus)) {
          sendOfferStatusEmail(agencyUser.email, {
            influencerName: influencerName,
            offerTitle: offerTitle,
            status: newStatus as 'accepted' | 'declined',
            offerId: req.params.id,
          }).catch(() => {});
        }
      }
    } catch (notifErr) {
      console.error('Notification trigger failed (offer status update):', notifErr);
    }
  }

  res.json(offer);
});

/* ── Counter-offer (agency or influencer proposes alternative rate) ── */
router.post('/:id/counter', (req, res) => {
  const { counter_rate, counter_currency, counter_notes, counter_by } = req.body;
  if (!counter_rate || !counter_by) {
    return res.status(400).json({ error: 'counter_rate and counter_by are required' });
  }
  if (!['influencer', 'agency'].includes(counter_by)) {
    return res.status(400).json({ error: 'counter_by must be influencer or agency' });
  }

  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE portal_offers
    SET counter_rate = ?, counter_currency = ?, counter_notes = ?,
        counter_by = ?, counter_at = ?, status = 'negotiating', updated_at = ?
    WHERE id = ?
  `).run(
    counter_rate, counter_currency || 'SAR', counter_notes || null,
    counter_by, now, now, req.params.id
  );

  const offer = db.prepare('SELECT * FROM portal_offers WHERE id = ?').get(req.params.id) as Record<string, unknown>;

  // Notify the other party
  try {
    if (counter_by === 'influencer') {
      // Notify agency that influencer proposed a counter
      let agencyUserId: string | undefined;
      if (offer.campaign_id) {
        const campaign = db.prepare('SELECT created_by FROM campaigns WHERE id = ?')
          .get(offer.campaign_id as P) as { created_by: string } | undefined;
        if (campaign?.created_by) {
          const u = db.prepare('SELECT id FROM users WHERE (display_name = ? OR email = ?) LIMIT 1')
            .get(campaign.created_by as P, campaign.created_by as P) as { id: string } | undefined;
          agencyUserId = u?.id;
        }
      }
      if (!agencyUserId) {
        const fallback = db.prepare(`SELECT id FROM users WHERE role IN ('platform_admin','agency') LIMIT 1`).get() as { id: string } | undefined;
        agencyUserId = fallback?.id;
      }
      if (agencyUserId) {
        createNotification(agencyUserId, 'offer_received',
          'Counter-offer received',
          `Influencer proposed ${counter_currency || 'SAR'} ${counter_rate} for: ${offer.title as string}`,
          `/offers/${req.params.id}`);
      }
    } else {
      // Notify influencer of counter
      const pu = offer.portal_user_id
        ? db.prepare('SELECT email FROM portal_users WHERE id = ?').get(offer.portal_user_id as P) as { email: string } | undefined
        : undefined;
      if (pu?.email) {
        const unifiedUser = db.prepare('SELECT id FROM users WHERE email = ?').get(pu.email as P) as { id: string } | undefined;
        if (unifiedUser) {
          createNotification(unifiedUser.id, 'offer_received',
            'Counter-offer from agency',
            `Agency proposed ${counter_currency || 'SAR'} ${counter_rate} for: ${offer.title as string}`,
            `/portal/offers/${req.params.id}`);
        }
      }
    }
  } catch { /* non-fatal */ }

  res.json(offer);
});

/* ── Accept counter-offer ─────────────────────────────────── */
router.post('/:id/accept-counter', (req, res) => {
  const db = getDb();
  const offer = db.prepare('SELECT * FROM portal_offers WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!offer) return res.status(404).json({ error: 'Not found' });
  if (!offer.counter_rate) return res.status(400).json({ error: 'No counter-offer to accept' });

  db.prepare(`
    UPDATE portal_offers
    SET rate = ?, currency = COALESCE(counter_currency, currency),
        counter_rate = NULL, counter_currency = NULL, counter_notes = NULL, counter_by = NULL, counter_at = NULL,
        status = 'accepted', updated_at = datetime('now')
    WHERE id = ?
  `).run(offer.counter_rate as P, req.params.id);

  const updated = db.prepare('SELECT * FROM portal_offers WHERE id = ?').get(req.params.id);
  res.json(updated);
});

/* ── Review deliverable ───────────────────────────────────── */
router.put('/:offerId/deliverables/:deliverableId/review', (req, res) => {
  const { decision, feedback, live_url } = req.body; // decision: approved | rejected | revision_requested
  if (!['approved', 'rejected', 'revision_requested'].includes(decision)) {
    return res.status(400).json({ error: 'Invalid decision' });
  }

  const db = getDb();
  db.prepare(`
    UPDATE portal_deliverables
    SET status = ?, feedback = ?, live_url = ?, reviewed_at = datetime('now')
    WHERE id = ? AND offer_id = ?
  `).run(decision, feedback || null, live_url || null, req.params.deliverableId, req.params.offerId);

  // Fetch offer details before updating for notification context
  const reviewedOffer = db.prepare('SELECT * FROM portal_offers WHERE id = ?')
    .get(req.params.offerId as P) as Record<string, unknown> | undefined;

  // If approved, auto-complete the offer and record live_at
  if (decision === 'approved') {
    db.prepare(`
      UPDATE portal_offers SET status = 'completed', updated_at = datetime('now') WHERE id = ?
    `).run(req.params.offerId);
    if (live_url) {
      db.prepare(`UPDATE portal_deliverables SET live_at = datetime('now'), live_url = ? WHERE id = ?`)
        .run(live_url, req.params.deliverableId);
    }

    // Notify the influencer (portal user) that their deliverable was approved
    try {
      if (reviewedOffer?.portal_user_id) {
        const pu = db.prepare('SELECT email FROM portal_users WHERE id = ?')
          .get(reviewedOffer.portal_user_id as P) as { email: string } | undefined;
        if (pu?.email) {
          const unifiedUser = db.prepare('SELECT id FROM users WHERE email = ?')
            .get(pu.email as P) as { id: string } | undefined;
          if (unifiedUser) {
            createNotification(
              unifiedUser.id,
              'offer_completed',
              'Deliverable approved!',
              `Your deliverable for "${reviewedOffer.title as string}" has been approved.`,
              `/portal/offers/${req.params.offerId}`
            );
          }
        }
      }
    } catch (notifErr) {
      console.error('Notification trigger failed (deliverable approved):', notifErr);
    }
  } else if (decision === 'revision_requested') {
    db.prepare(`UPDATE portal_offers SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?`)
      .run(req.params.offerId);
  }

  const deliverable = db.prepare('SELECT * FROM portal_deliverables WHERE id = ?').get(req.params.deliverableId);
  res.json(deliverable);
});

/* ── PUT /:id/status — simple status update for mobile app ──── */
router.put('/:id/status', (req, res) => {
  const { status, notes } = req.body;
  if (!status) return res.status(400).json({ error: 'status is required' });

  const db = getDb();
  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (notes) updates.agency_notes = notes;

  const set = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE portal_offers SET ${set} WHERE id = ?`).run(...Object.values(updates) as P[], req.params.id);

  const offer = db.prepare('SELECT * FROM portal_offers WHERE id = ?').get(req.params.id);
  res.json(offer);
});

/* ── POST /:id/send — send offer to influencer (draft → sent) ── */
router.post('/:id/send', (req, res) => {
  const db = getDb();
  const offer = db.prepare('SELECT * FROM portal_offers WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!offer) return res.status(404).json({ error: 'Offer not found' });

  db.prepare(`UPDATE portal_offers SET status = 'sent', sent_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`)
    .run(req.params.id);

  // Notify portal user if linked
  try {
    if (offer.portal_user_id) {
      const pu = db.prepare('SELECT email FROM portal_users WHERE id = ?')
        .get(offer.portal_user_id as P) as { email: string } | undefined;
      if (pu?.email) {
        sendOfferReceivedEmail(pu.email, {
          influencerName: pu.email,
          offerTitle: offer.title as string,
          rate: offer.rate as number,
          currency: (offer.currency as string) || 'SAR',
          deadline: offer.deadline as string,
        }).catch(() => {});
      }
    }
  } catch {}

  const updated = db.prepare('SELECT * FROM portal_offers WHERE id = ?').get(req.params.id);
  res.json(updated);
});

export default router;
