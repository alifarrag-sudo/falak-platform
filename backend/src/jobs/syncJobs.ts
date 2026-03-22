/**
 * Background cron jobs for data sync and maintenance.
 *
 * Job schedule:
 *   - OAuth sync:         every 24h  (0 2 * * *)   — refresh all connected accounts
 *   - Scraper sync:       every 72h  (0 3 every-3-days) — refresh unconnected influencers via RapidAPI
 *   - Trust scores:       every 30d  (0 4 1 * *)   — recalculate all trust scores
 *   - Stale data flags:   every day  (0 5 * * *)   — flag influencers with >30d old data
 *
 * Call initSyncJobs() once at server startup.
 */
import cron from 'node-cron';
import { syncAllOAuthAccounts, recalculateAllTrustScores, syncViaScraperByHandle } from '../services/platformSyncService';
import { getDb } from '../db/schema';
import { sendOfferExpiryWarningEmail, sendOfferExpiredEmail } from '../services/emailService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P = any;

let initialized = false;

export function initSyncJobs(): void {
  if (initialized) return;
  initialized = true;

  // ── Job 1: OAuth accounts — every day at 2am ─────────────────────────────
  cron.schedule('0 2 * * *', async () => {
    console.log('[cron] Starting OAuth account sync...');
    try {
      const result = await syncAllOAuthAccounts();
      console.log(`[cron] OAuth sync complete: ${result.synced} synced, ${result.errors} errors`);
    } catch (err) {
      console.error('[cron] OAuth sync error:', err);
    }
  });

  // ── Job 2: Scraper sync for unconnected influencers — every 3 days at 3am ─
  cron.schedule('0 3 */3 * *', async () => {
    console.log('[cron] Starting scraper sync for unconnected influencers...');
    try {
      const db = getDb();

      // Find influencers with ig_handle that don't have a connected instagram account
      // and haven't been scraped in 72h
      const toSync = db.prepare(`
        SELECT i.id, i.ig_handle, i.tiktok_handle
        FROM influencers i
        WHERE i.is_archived = 0
          AND (i.ig_handle IS NOT NULL OR i.tiktok_handle IS NOT NULL)
          AND NOT EXISTS (
            SELECT 1 FROM social_accounts sa
            WHERE sa.influencer_id = i.id AND sa.last_synced_at > datetime('now', '-3 days')
          )
          AND (i.last_enriched_at IS NULL OR i.last_enriched_at < datetime('now', '-3 days'))
        LIMIT 50
      `).all() as Array<{ id: string; ig_handle: string | null; tiktok_handle: string | null }>;

      let synced = 0;
      for (const inf of toSync) {
        if (inf.ig_handle) {
          const ok = await syncViaScraperByHandle(inf.id, 'instagram', inf.ig_handle);
          if (ok) synced++;
        } else if (inf.tiktok_handle) {
          const ok = await syncViaScraperByHandle(inf.id, 'tiktok', inf.tiktok_handle);
          if (ok) synced++;
        }
        await new Promise(r => setTimeout(r, 1000)); // 1s delay between calls
      }
      console.log(`[cron] Scraper sync complete: ${synced}/${toSync.length} updated`);
    } catch (err) {
      console.error('[cron] Scraper sync error:', err);
    }
  });

  // ── Job 3: Trust score recalculation — 1st of each month at 4am ──────────
  cron.schedule('0 4 1 * *', async () => {
    console.log('[cron] Recalculating trust scores...');
    try {
      const count = await recalculateAllTrustScores();
      console.log(`[cron] Trust scores updated for ${count} influencers`);
    } catch (err) {
      console.error('[cron] Trust score error:', err);
    }
  });

  // ── Job 4: Flag stale manual data — every day at 5am ─────────────────────
  cron.schedule('0 5 * * *', async () => {
    try {
      const db = getDb();
      // Flag influencers whose data hasn't been updated in 30+ days as needing enrichment
      db.prepare(`
        UPDATE influencers
        SET enrichment_status = 'stale'
        WHERE is_archived = 0
          AND (last_enriched_at IS NULL OR last_enriched_at < datetime('now', '-30 days'))
          AND enrichment_status != 'stale'
      `).run();
    } catch (err) {
      console.error('[cron] Stale flag error:', err);
    }
  });

  // ── Job 5: Offer expiry — every hour ─────────────────────────────────────
  cron.schedule('0 * * * *', async () => {
    try {
      const db = getDb();

      // 1. Send 24h expiry warning (offers >48h old, <72h, not yet warned)
      type OfferRow = { id: string; title: string | null; portal_user_id: string | null; created_by: string | null; email: string | null };
      const warnOffers = db.prepare(`
        SELECT po.id, po.title, po.portal_user_id, po.created_by,
               pu.email
        FROM portal_offers po
        LEFT JOIN portal_users pu ON po.portal_user_id = pu.id
        WHERE po.status IN ('sent', 'pending')
          AND po.sent_at IS NOT NULL
          AND datetime(po.sent_at, '+48 hours') <= datetime('now')
          AND datetime(po.sent_at, '+72 hours') > datetime('now')
          AND po.expiry_warned_at IS NULL
      `).all() as OfferRow[];

      for (const o of warnOffers) {
        if (o.email) {
          await sendOfferExpiryWarningEmail(o.email, {
            influencerName: '',
            offerTitle: o.title || 'Untitled offer',
            expiresIn: 'in 24 hours',
            offerId: o.id,
          }).catch(console.error);
        }
        db.prepare(`UPDATE portal_offers SET expiry_warned_at = datetime('now') WHERE id = ?`).run(o.id as P);
      }
      if (warnOffers.length) console.log(`[cron] Offer expiry: warned ${warnOffers.length} offers`);

      // 2. Auto-expire offers >72h old
      type ExpiredRow = { id: string; title: string | null; created_by: string | null; agency_email: string | null };
      const toExpire = db.prepare(`
        SELECT po.id, po.title, po.created_by,
               u.email AS agency_email
        FROM portal_offers po
        LEFT JOIN users u ON po.created_by = u.id
        WHERE po.status IN ('sent', 'pending')
          AND po.sent_at IS NOT NULL
          AND datetime(po.sent_at, '+72 hours') <= datetime('now')
      `).all() as ExpiredRow[];

      for (const o of toExpire) {
        db.prepare(`UPDATE portal_offers SET status = 'expired', updated_at = datetime('now') WHERE id = ?`).run(o.id as P);
        if (o.agency_email) {
          await sendOfferExpiredEmail(o.agency_email, {
            offerTitle: o.title || 'Untitled offer',
            influencerName: '',
            offerId: o.id,
          }).catch(console.error);
        }
      }
      if (toExpire.length) console.log(`[cron] Offer expiry: expired ${toExpire.length} offers`);
    } catch (err) {
      console.error('[cron] Offer expiry error:', err);
    }
  });

  console.log('[cron] Background sync jobs initialized (5 jobs scheduled)');
}
