import { Router, Request, Response } from 'express';
import { getDb } from '../db/schema';

const router = Router();

// GET /api/settings
router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const obj: Record<string, string> = {};
  rows.forEach(r => { obj[r.key] = r.value; });
  return res.json(obj);
});

// PUT /api/settings - update multiple settings at once
router.put('/', (req: Request, res: Response) => {
  const db = getDb();
  const updates = req.body as Record<string, string>;

  const stmt = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);

  db.exec('BEGIN');
  try {
    for (const [key, value] of Object.entries(updates)) {
      stmt.run(key, String(value ?? ''));
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const obj: Record<string, string> = {};
  rows.forEach(r => { obj[r.key] = r.value; });
  return res.json(obj);
});

// POST /api/settings/logo - upload logo
router.post('/logo', (req: Request, res: Response) => {
  if (!req.files || !req.files.logo) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const file = Array.isArray(req.files.logo) ? req.files.logo[0] : req.files.logo;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!['png', 'jpg', 'jpeg', 'svg', 'webp'].includes(ext || '')) {
    return res.status(400).json({ error: 'Only image files allowed' });
  }

  const filename = `logo-${Date.now()}.${ext}`;
  const uploadPath = `uploads/${filename}`;

  file.mv(uploadPath, (err: Error) => {
    if (err) return res.status(500).json({ error: err.message });

    const db = getDb();
    db.prepare(`
      INSERT INTO settings (key, value) VALUES ('logo_url', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(`/uploads/${filename}`);

    return res.json({ logo_url: `/uploads/${filename}` });
  });
});

// GET /api/settings/export - export all influencers as Excel
router.get('/export', (_req: Request, res: Response) => {
  const db = getDb();
  const XLSX = require('xlsx');

  const influencers = db.prepare('SELECT * FROM influencers WHERE is_archived = 0 ORDER BY created_at DESC').all();

  const ws = XLSX.utils.json_to_sheet(influencers);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Influencers');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const filename = `influencers-export-${new Date().toISOString().split('T')[0]}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
});

export default router;
