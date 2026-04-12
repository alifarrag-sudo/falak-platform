/**
 * Offer Templates routes
 * GET    /api/offer-templates          — list all templates
 * POST   /api/offer-templates          — create a template
 * PUT    /api/offer-templates/:id      — update a template
 * DELETE /api/offer-templates/:id      — delete a template
 */
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';

const router = Router();

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await db.all(
      'SELECT * FROM offer_templates ORDER BY name ASC',
      []
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, title, platform, content_type, brief, deliverables, rate, currency, agency_notes } = req.body as Record<string, unknown>;
    if (!name) { res.status(400).json({ error: 'name is required' }); return; }
    const id = uuidv4();
    await db.run(`
      INSERT INTO offer_templates (id, name, title, platform, content_type, brief, deliverables, rate, currency, agency_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, name, title ?? null, platform ?? null,
      content_type ?? null, brief ?? null, deliverables ?? null,
      rate ?? null, currency ?? 'SAR', agency_notes ?? null,
    ]);
    const created = await db.get('SELECT * FROM offer_templates WHERE id = ?', [id]);
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, title, platform, content_type, brief, deliverables, rate, currency, agency_notes } = req.body as Record<string, unknown>;
    await db.run(`
      UPDATE offer_templates SET
        name=?, title=?, platform=?, content_type=?, brief=?,
        deliverables=?, rate=?, currency=?, agency_notes=?,
        updated_at=NOW()
      WHERE id=?
    `, [
      name ?? null, title ?? null, platform ?? null,
      content_type ?? null, brief ?? null, deliverables ?? null,
      rate ?? null, currency ?? 'SAR', agency_notes ?? null,
      req.params.id,
    ]);
    const updated = await db.get('SELECT * FROM offer_templates WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    await db.run('DELETE FROM offer_templates WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

export default router;
