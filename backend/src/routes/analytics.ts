import { Router } from 'express';
import { getDb } from '../db/schema';

const router = Router();

// GET /api/analytics/overview
router.get('/overview', (_req, res) => {
  try {
    const db = getDb();

    // Total influencers (non-archived)
    const totalInfluencers = (db.prepare(
      `SELECT COUNT(*) as count FROM influencers WHERE is_archived = 0`
    ).get() as any).count as number;

    // Total campaigns (non-archived)
    const totalCampaigns = (db.prepare(
      `SELECT COUNT(*) as count FROM campaigns WHERE is_archived = 0`
    ).get() as any).count as number;

    // Active campaigns
    const activeCampaigns = (db.prepare(
      `SELECT COUNT(*) as count FROM campaigns WHERE status = 'active' AND is_archived = 0`
    ).get() as any).count as number;

    // Offers breakdown (portal_offers)
    const totalOffers = (db.prepare(
      `SELECT COUNT(*) as count FROM portal_offers`
    ).get() as any).count as number;

    const offersAccepted = (db.prepare(
      `SELECT COUNT(*) as count FROM portal_offers WHERE status = 'accepted'`
    ).get() as any).count as number;

    const offersPending = (db.prepare(
      `SELECT COUNT(*) as count FROM portal_offers WHERE status IN ('pending', 'sent')`
    ).get() as any).count as number;

    const offersDeclined = (db.prepare(
      `SELECT COUNT(*) as count FROM portal_offers WHERE status = 'declined'`
    ).get() as any).count as number;

    // Acceptance rate
    const acceptanceRate = totalOffers > 0
      ? Math.round((offersAccepted / totalOffers) * 100)
      : 0;

    // Total reach — sum all platform followers per influencer (max per platform)
    const reachRow = db.prepare(`
      SELECT
        COALESCE(SUM(
          COALESCE(ig_followers, 0) +
          COALESCE(tiktok_followers, 0) +
          COALESCE(snap_followers, 0) +
          COALESCE(youtube_followers, 0) +
          COALESCE(fb_followers, 0)
        ), 0) as total_reach
      FROM influencers WHERE is_archived = 0
    `).get() as any;
    const totalReach = reachRow.total_reach as number;

    // Platform distribution — count influencers who have each platform
    const igCount = (db.prepare(
      `SELECT COUNT(*) as count FROM influencers WHERE ig_handle IS NOT NULL AND ig_handle != '' AND is_archived = 0`
    ).get() as any).count as number;

    const tiktokCount = (db.prepare(
      `SELECT COUNT(*) as count FROM influencers WHERE tiktok_handle IS NOT NULL AND tiktok_handle != '' AND is_archived = 0`
    ).get() as any).count as number;

    const youtubeCount = (db.prepare(
      `SELECT COUNT(*) as count FROM influencers WHERE youtube_handle IS NOT NULL AND youtube_handle != '' AND is_archived = 0`
    ).get() as any).count as number;

    const snapchatCount = (db.prepare(
      `SELECT COUNT(*) as count FROM influencers WHERE snap_handle IS NOT NULL AND snap_handle != '' AND is_archived = 0`
    ).get() as any).count as number;

    // Tier distribution
    const tierRows = db.prepare(
      `SELECT account_tier, COUNT(*) as count FROM influencers WHERE is_archived = 0 AND account_tier IS NOT NULL GROUP BY account_tier`
    ).all() as any[];

    const byTier: Record<string, number> = { nano: 0, micro: 0, macro: 0, mega: 0 };
    for (const row of tierRows) {
      const tier = (row.account_tier as string).toLowerCase();
      if (tier in byTier) byTier[tier] = row.count as number;
    }

    // Top categories
    const categoryRows = db.prepare(`
      SELECT main_category as category, COUNT(*) as count
      FROM influencers
      WHERE is_archived = 0 AND main_category IS NOT NULL AND main_category != ''
      GROUP BY main_category
      ORDER BY count DESC
      LIMIT 10
    `).all() as any[];

    // Recent signups — last 30 days
    const recentSignups = (db.prepare(
      `SELECT COUNT(*) as count FROM influencers WHERE is_archived = 0 AND created_at >= datetime('now', '-30 days')`
    ).get() as any).count as number;

    res.json({
      total_influencers: totalInfluencers,
      total_campaigns: totalCampaigns,
      active_campaigns: activeCampaigns,
      total_offers: totalOffers,
      offers_accepted: offersAccepted,
      offers_pending: offersPending,
      offers_declined: offersDeclined,
      total_reach: totalReach,
      acceptance_rate: acceptanceRate,
      by_platform: {
        instagram: igCount,
        tiktok: tiktokCount,
        youtube: youtubeCount,
        snapchat: snapchatCount,
      },
      by_tier: byTier,
      top_categories: categoryRows.map((r) => ({
        category: r.category,
        count: r.count,
      })),
      recent_signups: recentSignups,
    });
  } catch (err: any) {
    console.error('Analytics overview error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// GET /api/analytics/growth  — last 30 days daily signups & offers
router.get('/growth', (_req, res) => {
  try {
    const db = getDb();

    // Build date series for last 30 days
    const days: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }

    // Influencers per day
    const influencerRows = db.prepare(`
      SELECT DATE(created_at) as day, COUNT(*) as count
      FROM influencers
      WHERE created_at >= datetime('now', '-30 days') AND is_archived = 0
      GROUP BY day
    `).all() as any[];

    const influencerMap: Record<string, number> = {};
    for (const row of influencerRows) {
      influencerMap[row.day as string] = row.count as number;
    }

    // Offers per day
    const offerRows = db.prepare(`
      SELECT DATE(created_at) as day, COUNT(*) as count
      FROM portal_offers
      WHERE created_at >= datetime('now', '-30 days')
      GROUP BY day
    `).all() as any[];

    const offerMap: Record<string, number> = {};
    for (const row of offerRows) {
      offerMap[row.day as string] = row.count as number;
    }

    const growth = days.map((date) => ({
      date,
      influencers: influencerMap[date] || 0,
      offers: offerMap[date] || 0,
    }));

    res.json({ growth });
  } catch (err: any) {
    console.error('Analytics growth error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
