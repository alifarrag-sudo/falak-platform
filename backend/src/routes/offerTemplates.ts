/**
 * Offer Templates routes
 * GET    /api/offer-templates          — list all templates
 * POST   /api/offer-templates          — create a template
 * PUT    /api/offer-templates/:id      — update a template
 * DELETE /api/offer-templates/:id      — delete a template
 */
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P = any;

const router = Router();

router.get('/', (_req: Request, res: Response): void => {
  try {
    const db = getDb();
    const rows = db.prepare(
      'SELECT * FROM offer_templates ORDER BY name ASC'
    ).all() as Record<string, unknown>[];
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

router.post('/', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { name, title, platform, content_type, brief, deliverables, rate, currency, agency_notes } = req.body as Record<string, unknown>;
    if (!name) { res.status(400).json({ error: 'name is required' }); return; }
    const id = uuidv4();
    db.prepare(`
      INSERT INTO offer_templates (id, name, title, platform, content_type, brief, deliverables, rate, currency, agency_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id as P, name as P, (title ?? null) as P, (platform ?? null) as P,
      (content_type ?? null) as P, (brief ?? null) as P, (deliverables ?? null) as P,
      (rate ?? null) as P, (currency ?? 'SAR') as P, (agency_notes ?? null) as P
    );
    const created = db.prepare('SELECT * FROM offer_templates WHERE id = ?').get(id as P);
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

router.put('/:id', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { name, title, platform, content_type, brief, deliverables, rate, currency, agency_notes } = req.body as Record<string, unknown>;
    db.prepare(`
      UPDATE offer_templates SET
        name=?, title=?, platform=?, content_type=?, brief=?,
        deliverables=?, rate=?, currency=?, agency_notes=?,
        updated_at=datetime('now')
      WHERE id=?
    `).run(
      (name ?? null) as P, (title ?? null) as P, (platform ?? null) as P,
      (content_type ?? null) as P, (brief ?? null) as P, (deliverables ?? null) as P,
      (rate ?? null) as P, (currency ?? 'SAR') as P, (agency_notes ?? null) as P,
      req.params.id as P
    );
    const updated = db.prepare('SELECT * FROM offer_templates WHERE id = ?').get(req.params.id as P);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

router.delete('/:id', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM offer_templates WHERE id = ?').run(req.params.id as P);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

export default router;
