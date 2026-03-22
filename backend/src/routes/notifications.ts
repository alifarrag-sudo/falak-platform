/**
 * Notification routes — in-platform bell notifications.
 * All routes require a valid unified auth token (users table).
 * GET    /api/notifications           — list for current user
 * PUT    /api/notifications/read-all  — mark all read
 * PUT    /api/notifications/:id/read  — mark one read
 * DELETE /api/notifications/:id       — delete one
 */
import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/schema';
import { requireAuth, AuthRequest } from '../middleware/auth';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P = any;

const router = Router();

// All notifications routes require auth
router.use(requireAuth());

// GET /api/notifications
router.get('/', (req: AuthRequest, res: Response): void => {
  try {
    const db = getDb();
    const userId = req.user!.id as string;
    const notifications = db.prepare(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
    ).all(userId as P) as Record<string, unknown>[];
    const unreadCount = (db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
    ).get(userId as P) as { count: number }).count;
    res.json({ notifications, unread_count: unreadCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', (req: AuthRequest, res: Response): void => {
  try {
    const db = getDb();
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?')
      .run(req.user!.id as P);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark notifications read' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', (req: AuthRequest, res: Response): void => {
  try {
    const db = getDb();
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
      .run(req.params.id as P, req.user!.id as P);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark notification read' });
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', (req: AuthRequest, res: Response): void => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?')
      .run(req.params.id as P, req.user!.id as P);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

/**
 * Utility: create a notification for a user (called from other routes).
 * Import this wherever you need to fire a notification.
 */
export function createNotification(userId: string, type: string, title: string, body?: string, link?: string): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type P = any;
    const db = getDb();
    const id = uuidv4();
    db.prepare(
      'INSERT INTO notifications (id, user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id as P, userId as P, type as P, title as P, (body ?? null) as P, (link ?? null) as P);
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}

export default router;
