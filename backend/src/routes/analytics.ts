import { Router, Request } from 'express';
import { db } from '../db/connection';
import { requireViewerOrAdmin } from '../middleware/auth';

const router = Router();

/** Returns true when demo records should be hidden (LIVE_VIEW_MODE or ?demo=false) */
function filterDemo(req: Request): boolean {
  return process.env.LIVE_VIEW_MODE === 'true' || req.query.demo === 'false';
}

// GET /api/analytics/overview
router.get('/overview', requireViewerOrAdmin(), async (req, res) => {
  try {
    const demoI = filterDemo(req) ? 'AND is_demo = 0' : '';
    const demoC = filterDemo(req) ? 'AND is_demo = 0' : '';
    const demoO = filterDemo(req) ? 'AND is_demo = 0' : '';

    // Total influencers (non-archived)
    const totalInfluencersRow = await db.get(`SELECT COUNT(*) as count FROM influencers WHERE is_archived = 0 ${demoI}`, []) as Record<string, number>;
    const totalInfluencers = totalInfluencersRow.count;

    // Total campaigns (non-archived)
    const totalCampaignsRow = await db.get(`SELECT COUNT(*) as count FROM campaigns WHERE is_archived = 0 ${demoC}`, []) as Record<string, number>;
    const totalCampaigns = totalCampaignsRow.count;

    // Active campaigns
    const activeCampaignsRow = await db.get(`SELECT COUNT(*) as count FROM campaigns WHERE status = 'active' AND is_archived = 0 ${demoC}`, []) as Record<string, number>;
    const activeCampaigns = activeCampaignsRow.count;

    // Offers breakdown (portal_offers)
    const totalOffersRow = await db.get(`SELECT COUNT(*) as count FROM portal_offers WHERE 1=1 ${demoO}`, []) as Record<string, number>;
    const totalOffers = totalOffersRow.count;

    const offersAcceptedRow = await db.get(`SELECT COUNT(*) as count FROM portal_offers WHERE status = 'accepted' ${demoO}`, []) as Record<string, number>;
    const offersAccepted = offersAcceptedRow.count;

    const offersPendingRow = await db.get(`SELECT COUNT(*) as count FROM portal_offers WHERE status IN ('pending', 'sent') ${demoO}`, []) as Record<string, number>;
    const offersPending = offersPendingRow.count;

    const offersDeclinedRow = await db.get(`SELECT COUNT(*) as count FROM portal_offers WHERE status = 'declined' ${demoO}`, []) as Record<string, number>;
    const offersDeclined = offersDeclinedRow.count;

    // Acceptance rate
    const acceptanceRate = totalOffers > 0
      ? Math.round((offersAccepted / totalOffers) * 100)
      : 0;

    // Total reach — sum all platform followers per influencer (max per platform)
    const reachRow = await db.get(`
      SELECT
        COALESCE(SUM(
          COALESCE(ig_followers, 0) +
          COALESCE(tiktok_followers, 0) +
          COALESCE(snap_followers, 0) +
          COALESCE(youtube_followers, 0) +
          COALESCE(fb_followers, 0)
        ), 0) as total_reach
      FROM influencers WHERE is_archived = 0 ${demoI}
    `, []) as Record<string, number>;
    const totalReach = reachRow.total_reach;

    // Platform distribution — count influencers who have each platform
    const igCountRow = await db.get(`SELECT COUNT(*) as count FROM influencers WHERE ig_handle IS NOT NULL AND ig_handle != '' AND is_archived = 0 ${demoI}`, []) as Record<string, number>;
    const igCount = igCountRow.count;

    const tiktokCountRow = await db.get(`SELECT COUNT(*) as count FROM influencers WHERE tiktok_handle IS NOT NULL AND tiktok_handle != '' AND is_archived = 0 ${demoI}`, []) as Record<string, number>;
    const tiktokCount = tiktokCountRow.count;

    const youtubeCountRow = await db.get(`SELECT COUNT(*) as count FROM influencers WHERE youtube_handle IS NOT NULL AND youtube_handle != '' AND is_archived = 0 ${demoI}`, []) as Record<string, number>;
    const youtubeCount = youtubeCountRow.count;

    const snapchatCountRow = await db.get(`SELECT COUNT(*) as count FROM influencers WHERE snap_handle IS NOT NULL AND snap_handle != '' AND is_archived = 0 ${demoI}`, []) as Record<string, number>;
    const snapchatCount = snapchatCountRow.count;

    // Tier distribution
    const tierRows = await db.all(
      `SELECT account_tier, COUNT(*) as count FROM influencers WHERE is_archived = 0 AND account_tier IS NOT NULL ${demoI} GROUP BY account_tier`,
      []
    ) as Array<{ account_tier: string; count: number }>;

    const byTier: Record<string, number> = { nano: 0, micro: 0, macro: 0, mega: 0 };
    for (const row of tierRows) {
      const tier = row.account_tier.toLowerCase();
      if (tier in byTier) byTier[tier] = row.count;
    }

    // Top categories
    const categoryRows = await db.all(`
      SELECT main_category as category, COUNT(*) as count
      FROM influencers
      WHERE is_archived = 0 AND main_category IS NOT NULL AND main_category != '' ${demoI}
      GROUP BY main_category
      ORDER BY count DESC
      LIMIT 10
    `, []) as Array<{ category: string; count: number }>;

    // Recent signups — last 30 days
    const recentSignupsRow = await db.get(
      `SELECT COUNT(*) as count FROM influencers WHERE is_archived = 0 ${demoI} AND created_at >= NOW() - INTERVAL '30 days'`,
      []
    ) as Record<string, number>;
    const recentSignups = recentSignupsRow.count;

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
  } catch (err: unknown) {
    console.error('Analytics overview error:', err);
    res.status(500).json({ error: (err as Error).message || 'Internal server error' });
  }
});

// GET /api/analytics/growth  — last 30 days daily signups & offers
router.get('/growth', requireViewerOrAdmin(), async (req, res) => {
  try {
    const demoI = filterDemo(req) ? 'AND is_demo = 0' : '';
    const demoO = filterDemo(req) ? 'AND is_demo = 0' : '';

    // Build date series for last 30 days
    const days: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }

    // Influencers per day
    const influencerRows = await db.all(`
      SELECT DATE(created_at) as day, COUNT(*) as count
      FROM influencers
      WHERE created_at >= NOW() - INTERVAL '30 days' AND is_archived = 0 ${demoI}
      GROUP BY day
    `, []) as Array<{ day: string; count: number }>;

    const influencerMap: Record<string, number> = {};
    for (const row of influencerRows) {
      influencerMap[row.day] = row.count;
    }

    // Offers per day
    const offerRows = await db.all(`
      SELECT DATE(created_at) as day, COUNT(*) as count
      FROM portal_offers
      WHERE created_at >= NOW() - INTERVAL '30 days' ${demoO}
      GROUP BY day
    `, []) as Array<{ day: string; count: number }>;

    const offerMap: Record<string, number> = {};
    for (const row of offerRows) {
      offerMap[row.day] = row.count;
    }

    const growth = days.map((date) => ({
      date,
      influencers: influencerMap[date] || 0,
      offers: offerMap[date] || 0,
    }));

    res.json({ growth });
  } catch (err: unknown) {
    console.error('Analytics growth error:', err);
    res.status(500).json({ error: (err as Error).message || 'Internal server error' });
  }
});

export default router;
