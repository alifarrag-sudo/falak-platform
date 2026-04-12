import { Router, Request, Response } from 'express';
import { db } from '../db/connection';

const router = Router();

// GET /api/settings
router.get('/', async (_req: Request, res: Response) => {
  const rows = await db.all('SELECT key, value FROM settings', []) as { key: string; value: string }[];
  const obj: Record<string, string> = {};
  rows.forEach(r => { obj[r.key] = r.value; });
  return res.json(obj);
});

// PUT /api/settings - update multiple settings at once
router.put('/', async (req: Request, res: Response) => {
  const updates = req.body as Record<string, string>;

  await db.query('BEGIN');
  try {
    for (const [key, value] of Object.entries(updates)) {
      await db.run(`
        INSERT INTO settings (key, value, updated_at)
        VALUES (?, ?, NOW())
        ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `, [key, String(value ?? '')]);
    }
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }

  const rows = await db.all('SELECT key, value FROM settings', []) as { key: string; value: string }[];
  const obj: Record<string, string> = {};
  rows.forEach(r => { obj[r.key] = r.value; });
  return res.json(obj);
});

// POST /api/settings/logo - upload logo
router.post('/logo', async (req: Request, res: Response) => {
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

  file.mv(uploadPath, async (err: Error) => {
    if (err) return res.status(500).json({ error: err.message });

    await db.run(`
      INSERT INTO settings (key, value) VALUES ('logo_url', ?)
      ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value
    `, [`/uploads/${filename}`]);

    return res.json({ logo_url: `/uploads/${filename}` });
  });
});

// GET /api/settings/export - export all influencers as Excel
router.get('/export', async (_req: Request, res: Response) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const XLSX = require('xlsx');

  const influencers = await db.all('SELECT * FROM influencers WHERE is_archived = 0 ORDER BY created_at DESC', []);

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
