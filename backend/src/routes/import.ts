import { Router, Request, Response } from 'express';
import path from 'path';
import { getDb } from '../db/schema';
import { previewImport, processImport } from '../services/importService';

const router = Router();

// POST /api/import/preview - upload and preview column mappings
router.post('/preview', (req: Request, res: Response) => {
  if (!req.files || !req.files.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const file = Array.isArray(req.files.file) ? req.files.file[0] : req.files.file;
  const filename = file.name;
  const buffer = file.data;

  try {
    const preview = previewImport(buffer, filename);
    return res.json({ filename, sheets: preview });
  } catch (err) {
    return res.status(400).json({ error: `Failed to parse file: ${(err as Error).message}` });
  }
});

// POST /api/import/process - actually import the data
router.post('/process', async (req: Request, res: Response) => {
  if (!req.files || !req.files.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const file = Array.isArray(req.files.file) ? req.files.file[0] : req.files.file;
  const filename = file.name;
  const buffer = file.data;

  const {
    columnOverrides,
    skipDuplicates
  } = req.body as {
    columnOverrides?: Record<string, string>;
    skipDuplicates?: boolean;
  };

  try {
    const result = await processImport(
      buffer,
      filename,
      columnOverrides,
      skipDuplicates === true || (skipDuplicates as unknown) === 'true'
    );
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: `Import failed: ${(err as Error).message}` });
  }
});

// GET /api/import/sessions - list import history
router.get('/sessions', (_req: Request, res: Response) => {
  const db = getDb();
  const sessions = db.prepare(`
    SELECT * FROM import_sessions ORDER BY created_at DESC LIMIT 50
  `).all();
  return res.json(sessions);
});

// GET /api/import/sessions/:id
router.get('/sessions/:id', (req: Request, res: Response) => {
  const db = getDb();
  const session = db.prepare('SELECT * FROM import_sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  return res.json(session);
});

export default router;
