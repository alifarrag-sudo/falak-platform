import { Router, Request, Response } from 'express';
import { getDb } from '../db/schema';
import { enrichInfluencer, bulkEnrich } from '../services/enrichmentService';

const router = Router();

// POST /api/enrichment/:id - enrich a single influencer
router.post('/:id', async (req: Request, res: Response) => {
  const db = getDb();
  const influencer = db.prepare('SELECT * FROM influencers WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!influencer) return res.status(404).json({ error: 'Influencer not found' });

  try {
    const result = await enrichInfluencer(influencer);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/enrichment/bulk - enrich multiple or all
router.post('/bulk/start', async (req: Request, res: Response) => {
  const { ids } = req.body as { ids?: string[] };

  // Run in background, return immediately
  res.json({ message: 'Bulk enrichment started', count: ids?.length || 'all' });

  // Fire and forget
  bulkEnrich(ids).catch(console.error);
});

// GET /api/enrichment/status - get enrichment status for all
router.get('/status', (_req: Request, res: Response) => {
  const db = getDb();
  const stats = db.prepare(`
    SELECT
      enrichment_status,
      COUNT(*) as count,
      MAX(last_enriched_at) as last_enriched
    FROM influencers
    WHERE is_archived = 0
    GROUP BY enrichment_status
  `).all();
  return res.json(stats);
});

export default router;
