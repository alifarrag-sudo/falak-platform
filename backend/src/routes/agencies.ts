/**
 * Admin agencies management routes.
 * GET    /api/agencies        — list agencies with search & pagination
 * POST   /api/agencies        — create agency
 * PUT    /api/agencies/:id    — update agency
 * DELETE /api/agencies/:id    — delete agency
 */
import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// ── GET /api/agencies ─────────────────────────────────────────────────────────
router.get('/', requireAuth('platform_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, page = '1', limit = '50' } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search) {
      conditions.push("(a.name LIKE ? OR a.contact_email LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = await db.get(`SELECT COUNT(*) as count FROM agencies a ${where}`, params) as Record<string, number>;
    const total = countRow.count;

    const agencies = await db.all(
      `SELECT
         a.id,
         a.name,
         a.contact_email,
         a.logo_url,
         a.commission_override_pct,
         a.verified,
         a.subscription_tier,
         a.created_at,
         a.website,
         a.country,
         (SELECT COUNT(*) FROM users u WHERE u.linked_agency_id = a.id AND u.status != 'deleted') as user_count
       FROM agencies a
       ${where}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    res.json({ agencies, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) });
  } catch (err) {
    console.error('List agencies error:', err);
    res.status(500).json({ error: 'Failed to list agencies' });
  }
});

// ── POST /api/agencies ────────────────────────────────────────────────────────
router.post('/', requireAuth('platform_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, contact_email, website, country, commission_rate } = req.body as Record<string, string>;

    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Agency name is required' });
      return;
    }

    const id = uuidv4();
    const commissionPct = commission_rate ? parseFloat(commission_rate) : 15;

    await db.run(
      `INSERT INTO agencies (id, name, contact_email, website, country, commission_override_pct)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name.trim(), contact_email || null, website || null, country || null, commissionPct]
    );

    const agency = await db.get(
      `SELECT a.*, (SELECT COUNT(*) FROM users u WHERE u.linked_agency_id = a.id AND u.status != 'deleted') as user_count
       FROM agencies a WHERE a.id = ?`,
      [id]
    );

    res.status(201).json({ agency });
  } catch (err) {
    console.error('Create agency error:', err);
    res.status(500).json({ error: 'Failed to create agency' });
  }
});

// ── PUT /api/agencies/:id ─────────────────────────────────────────────────────
router.put('/:id', requireAuth('platform_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, contact_email, website, country, commission_rate, verified, subscription_tier } = req.body as Record<string, string>;

    const existing = await db.get('SELECT id FROM agencies WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Agency not found' });
      return;
    }

    const fields: string[] = [];
    const params: unknown[] = [];

    if (name !== undefined) { fields.push('name = ?'); params.push(name.trim()); }
    if (contact_email !== undefined) { fields.push('contact_email = ?'); params.push(contact_email || null); }
    if (website !== undefined) { fields.push('website = ?'); params.push(website || null); }
    if (country !== undefined) { fields.push('country = ?'); params.push(country || null); }
    if (commission_rate !== undefined) { fields.push('commission_override_pct = ?'); params.push(parseFloat(commission_rate)); }
    if (verified !== undefined) { fields.push('verified = ?'); params.push(verified ? 1 : 0); }
    if (subscription_tier !== undefined) { fields.push('subscription_tier = ?'); params.push(subscription_tier); }

    if (fields.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    params.push(id);
    await db.run(`UPDATE agencies SET ${fields.join(', ')} WHERE id = ?`, params);

    const agency = await db.get(
      `SELECT a.*, (SELECT COUNT(*) FROM users u WHERE u.linked_agency_id = a.id AND u.status != 'deleted') as user_count
       FROM agencies a WHERE a.id = ?`,
      [id]
    );

    res.json({ agency });
  } catch (err) {
    console.error('Update agency error:', err);
    res.status(500).json({ error: 'Failed to update agency' });
  }
});

// ── DELETE /api/agencies/:id ──────────────────────────────────────────────────
router.delete('/:id', requireAuth('platform_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await db.get('SELECT id FROM agencies WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Agency not found' });
      return;
    }

    await db.run('DELETE FROM agencies WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete agency error:', err);
    res.status(500).json({ error: 'Failed to delete agency' });
  }
});

export default router;
