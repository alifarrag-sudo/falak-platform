/**
 * Post-campaign ratings — agencies rate influencers after offer completion.
 *
 * Routes:
 *   POST /api/ratings/:offerId           — submit a rating (agency only)
 *   GET  /api/ratings/:offerId           — get rating for a specific offer
 *   GET  /api/ratings/influencer/:id     — all ratings for an influencer (avg + list)
 */
import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { db } from '../db/connection';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: string };
    (req as Request & { user: unknown }).user = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// POST /api/ratings/:offerId — submit or update rating
router.post('/:offerId', requireAuth, async (req: Request, res: Response) => {
  const user = (req as Request & { user: { id: string; role: string } }).user;
  const { rating, review } = req.body as { rating?: number; review?: string };

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  const offer = await db.get('SELECT id, status, created_by FROM portal_offers WHERE id = ?', [req.params.offerId]) as
    { id: string; status: string; created_by: string | null } | undefined;

  if (!offer) return res.status(404).json({ error: 'Offer not found' });
  if (offer.status !== 'completed') return res.status(400).json({ error: 'Can only rate completed offers' });
  if (offer.created_by !== user.id && user.role !== 'platform_admin') {
    return res.status(403).json({ error: 'Only the offer creator can rate it' });
  }

  // Upsert rating
  const existing = await db.get('SELECT id FROM offer_ratings WHERE offer_id = ?', [req.params.offerId]) as { id: string } | undefined;

  if (existing) {
    await db.run('UPDATE offer_ratings SET rating = ?, review = ? WHERE offer_id = ?', [rating, review || null, req.params.offerId]);
  } else {
    await db.run(`
      INSERT INTO offer_ratings (id, offer_id, rater_type, rater_id, rating, review)
      VALUES (?, ?, 'agency', ?, ?, ?)
    `, [uuidv4(), req.params.offerId, user.id, rating, review || null]);
  }

  const updated = await db.get('SELECT * FROM offer_ratings WHERE offer_id = ?', [req.params.offerId]);
  return res.json({ rating: updated });
});

// GET /api/ratings/:offerId
router.get('/:offerId', async (req: Request, res: Response) => {
  const rating = await db.get('SELECT * FROM offer_ratings WHERE offer_id = ?', [req.params.offerId]);
  return res.json({ rating: rating || null });
});

// GET /api/ratings/influencer/:id — aggregate + history for an influencer portal user
router.get('/influencer/:id', async (req: Request, res: Response) => {
  // Offers belonging to this portal user
  const avg = await db.get(`
    SELECT
      AVG(r.rating) AS avg_rating,
      COUNT(r.id)   AS total_ratings
    FROM offer_ratings r
    JOIN portal_offers po ON po.id = r.offer_id
    WHERE po.portal_user_id = ?
  `, [req.params.id]) as { avg_rating: number | null; total_ratings: number };

  const list = await db.all(`
    SELECT r.rating, r.review, r.created_at, po.title AS offer_title
    FROM offer_ratings r
    JOIN portal_offers po ON po.id = r.offer_id
    WHERE po.portal_user_id = ?
    ORDER BY r.created_at DESC
    LIMIT 50
  `, [req.params.id]);

  return res.json({
    avg_rating: avg.avg_rating ? Math.round(avg.avg_rating * 10) / 10 : null,
    total_ratings: avg.total_ratings,
    ratings: list,
  });
});

export default router;
