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
import { db } from '../db/connection';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// All notifications routes require auth
router.use(requireAuth());

// GET /api/notifications
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id as string;
    const notifications = await db.all(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );
    const unreadRow = await db.get(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    ) as { count: number };
    res.json({ notifications, unread_count: unreadRow.count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user!.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark notifications read' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await db.run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user!.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark notification read' });
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await db.run('DELETE FROM notifications WHERE id = ? AND user_id = ?', [req.params.id, req.user!.id]);
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
export async function createNotification(userId: string, type: string, title: string, body?: string, link?: string): Promise<void> {
  try {
    const id = uuidv4();
    await db.run(
      'INSERT INTO notifications (id, user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?, ?)',
      [id, userId, type, title, body ?? null, link ?? null]
    );
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}

export default router;
