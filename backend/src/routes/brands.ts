/**
 * Admin brands management routes.
 * GET    /api/brands        — list brands with search & pagination
 * POST   /api/brands        — create brand
 * PUT    /api/brands/:id    — update brand
 * DELETE /api/brands/:id    — delete brand
 */
import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// ── GET /api/brands ───────────────────────────────────────────────────────────
router.get('/', requireAuth('platform_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, page = '1', limit = '50' } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search) {
      conditions.push("(b.name LIKE ? OR b.contact_email LIKE ? OR b.category LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = await db.get(`SELECT COUNT(*) as count FROM brands b ${where}`, params) as Record<string, number>;
    const total = countRow.count;

    const brands = await db.all(
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
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    res.json({ brands, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) });
  } catch (err) {
    console.error('List brands error:', err);
    res.status(500).json({ error: 'Failed to list brands' });
  }
});

// ── POST /api/brands ──────────────────────────────────────────────────────────
router.post('/', requireAuth('platform_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, industry, contact_email, website, country, budget_range } = req.body as Record<string, string>;

    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Brand name is required' });
      return;
    }

    const id = uuidv4();

    await db.run(
      `INSERT INTO brands (id, name, category, contact_email, website, country, industry, budget_range)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name.trim(), industry || null, contact_email || null, website || null, country || null, industry || null, budget_range || null]
    );

    const brand = await db.get('SELECT * FROM brands WHERE id = ?', [id]);

    res.status(201).json({ brand });
  } catch (err) {
    console.error('Create brand error:', err);
    res.status(500).json({ error: 'Failed to create brand' });
  }
});

// ── PUT /api/brands/:id ───────────────────────────────────────────────────────
router.put('/:id', requireAuth('platform_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, industry, contact_email, website, country, budget_range } = req.body as Record<string, string>;

    const existing = await db.get('SELECT id FROM brands WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Brand not found' });
      return;
    }

    const fields: string[] = [];
    const params: unknown[] = [];

    if (name !== undefined) { fields.push('name = ?'); params.push(name.trim()); }
    if (industry !== undefined) { fields.push('industry = ?'); params.push(industry || null); fields.push('category = ?'); params.push(industry || null); }
    if (contact_email !== undefined) { fields.push('contact_email = ?'); params.push(contact_email || null); }
    if (website !== undefined) { fields.push('website = ?'); params.push(website || null); }
    if (country !== undefined) { fields.push('country = ?'); params.push(country || null); }
    if (budget_range !== undefined) { fields.push('budget_range = ?'); params.push(budget_range || null); }

    if (fields.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    params.push(id);
    await db.run(`UPDATE brands SET ${fields.join(', ')} WHERE id = ?`, params);

    const brand = await db.get('SELECT * FROM brands WHERE id = ?', [id]);

    res.json({ brand });
  } catch (err) {
    console.error('Update brand error:', err);
    res.status(500).json({ error: 'Failed to update brand' });
  }
});

// ── DELETE /api/brands/:id ────────────────────────────────────────────────────
router.delete('/:id', requireAuth('platform_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await db.get('SELECT id FROM brands WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Brand not found' });
      return;
    }

    await db.run('DELETE FROM brands WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete brand error:', err);
    res.status(500).json({ error: 'Failed to delete brand' });
  }
});

export default router;
