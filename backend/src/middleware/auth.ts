/**
 * Unified authentication middleware for all 6 user roles.
 * Use requireAuth() for any authenticated route.
 * Use requireAuth('platform_admin', 'agency') to restrict to specific roles.
 * The old requirePortalAuth in portal.ts remains for backward compat.
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDb } from '../db/schema';

export const JWT_SECRET = process.env.JWT_SECRET || 'cp-nsm-secret-change-in-production';

export type UserRole = 'platform_admin' | 'agency' | 'brand' | 'influencer' | 'public' | 'talent_manager';

export interface AuthRequest extends Request {
  user?: Record<string, unknown>;
}

/**
 * Returns middleware that validates JWT from Authorization header and checks role.
 * If roles array is empty, any authenticated user is allowed.
 */
export function requireAuth(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const token = req.headers.authorization?.replace('Bearer ', '').trim();
    if (!token) {
      res.status(401).json({ error: 'Unauthorized — no token' });
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type P = any;
      const payload = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
      const db = getDb();
      const user = db.prepare(
        'SELECT id, email, role, display_name, avatar_url, linked_influencer_id, linked_agency_id, linked_brand_id, status, created_at FROM users WHERE id = ? AND status = ?'
      ).get(payload.id as P, 'active') as Record<string, unknown> | undefined;

      if (!user) {
        res.status(401).json({ error: 'User not found or suspended' });
        return;
      }
      if (roles.length > 0 && !roles.includes(user.role as UserRole)) {
        res.status(403).json({ error: 'Forbidden — insufficient role' });
        return;
      }
      req.user = user;
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

/** Generate a signed JWT for a user id (30 day expiry by default) */
export function signToken(userId: string, expiresIn = '30d'): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (jwt as any).sign({ id: userId }, JWT_SECRET, { expiresIn });
}
