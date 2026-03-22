/**
 * Admin brands management routes.
 * GET    /api/brands        — list brands with search & pagination
 * POST   /api/brands        — create brand
 * PUT    /api/brands/:id    — update brand
 * DELETE /api/brands/:id    — delete brand
 */
import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/schema';
import { requireAuth, AuthRequest } from '../middleware/auth';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P = any;

const router = Router();

// ── GET /api/brands ───────────────────────────────────────────────────────────
router.get('/', requireAuth('platform_admin'), (req: AuthRequest, res: Response): void => {
  try {
    const db = getDb();
    const { search, page = '1', limit = '50' } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const params: P[] = [];

    if (search) {
      conditions.push("(b.name LIKE ? OR b.contact_email LIKE ? OR b.category LIKE ?)");
      params.push(`%${search}%` as P, `%${search}%` as P, `%${search}%` as P);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const total = (db.prepare(`SELECT COUNT(*) as count FROM brands b ${where}`)
      .get(...params as P[]) as Record<string, number>).count;

    const brands = db.prepare(
      `SELECT
         b.id,
         b.name,
         b.category,
         b.contact_email,
         b.country,
         b.logo_url,
         b.created_at,
         b.website,
         b.industry,
         b.budget_range
       FROM brands b
       ${where}
       ORDER BY b.created_at DESC
       LIMIT ? OFFSET ?`
    ).all(...params as P[], limitNum as P, offset as P) as Record<string, unknown>[];

    res.json({ brands, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) });
  } catch (err) {
    console.error('List brands error:', err);
    res.status(500).json({ error: 'Failed to list brands' });
  }
});

// ── POST /api/brands ──────────────────────────────────────────────────────────
router.post('/', requireAuth('platform_admin'), (req: AuthRequest, res: Response): void => {
  try {
    const { name, industry, contact_email, website, country, budget_range } = req.body as Record<string, string>;

    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Brand name is required' });
      return;
    }

    const db = getDb();
    const id = uuidv4();

    db.prepare(
      `INSERT INTO brands (id, name, category, contact_email, website, country, industry, budget_range)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id as P,
      name.trim() as P,
      (industry || null) as P,
      (contact_email || null) as P,
      (website || null) as P,
      (country || null) as P,
      (industry || null) as P,
      (budget_range || null) as P
    );

    const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(id as P) as Record<string, unknown>;

    res.status(201).json({ brand });
  } catch (err) {
    console.error('Create brand error:', err);
    res.status(500).json({ error: 'Failed to create brand' });
  }
});

// ── PUT /api/brands/:id ───────────────────────────────────────────────────────
router.put('/:id', requireAuth('platform_admin'), (req: AuthRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const { name, industry, contact_email, website, country, budget_range } = req.body as Record<string, string>;

    const db = getDb();
    const existing = db.prepare('SELECT id FROM brands WHERE id = ?').get(id as P);
    if (!existing) {
      res.status(404).json({ error: 'Brand not found' });
      return;
    }

    const fields: string[] = [];
    const params: P[] = [];

    if (name !== undefined) { fields.push('name = ?'); params.push(name.trim() as P); }
    if (industry !== undefined) { fields.push('industry = ?'); params.push((industry || null) as P); fields.push('category = ?'); params.push((industry || null) as P); }
    if (contact_email !== undefined) { fields.push('contact_email = ?'); params.push((contact_email || null) as P); }
    if (website !== undefined) { fields.push('website = ?'); params.push((website || null) as P); }
    if (country !== undefined) { fields.push('country = ?'); params.push((country || null) as P); }
    if (budget_range !== undefined) { fields.push('budget_range = ?'); params.push((budget_range || null) as P); }

    if (fields.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    params.push(id as P);
    db.prepare(`UPDATE brands SET ${fields.join(', ')} WHERE id = ?`).run(...params as P[]);

    const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(id as P) as Record<string, unknown>;

    res.json({ brand });
  } catch (err) {
    console.error('Update brand error:', err);
    res.status(500).json({ error: 'Failed to update brand' });
  }
});

// ── DELETE /api/brands/:id ────────────────────────────────────────────────────
router.delete('/:id', requireAuth('platform_admin'), (req: AuthRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const db = getDb();

    const existing = db.prepare('SELECT id FROM brands WHERE id = ?').get(id as P);
    if (!existing) {
      res.status(404).json({ error: 'Brand not found' });
      return;
    }

    db.prepare('DELETE FROM brands WHERE id = ?').run(id as P);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete brand error:', err);
    res.status(500).json({ error: 'Failed to delete brand' });
  }
});

export default router;
