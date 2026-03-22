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

  console.log('[cron] Background sync jobs initialized (4 jobs scheduled)');
}
