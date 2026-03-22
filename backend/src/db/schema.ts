import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

let db: DatabaseSync;

export function getDb(): DatabaseSync {
  if (!db) {
    // Resolve DB_PATH lazily so dotenv has time to load before this is called
    const DB_PATH = process.env.DB_PATH
      ? path.resolve(process.cwd(), process.env.DB_PATH)
      : path.join(__dirname, '../../../data/influencers.db');

    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    db.exec("PRAGMA encoding = 'UTF-8'");
  }
  return db;
}

export function initializeDatabase(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS influencers (
      id TEXT PRIMARY KEY,
      serial INTEGER,
      name_arabic TEXT,
      name_english TEXT,
      nickname TEXT,
      ig_handle TEXT,
      ig_url TEXT,
      ig_followers INTEGER,
      ig_engagement_rate REAL,
      tiktok_handle TEXT,
      tiktok_url TEXT,
      tiktok_followers INTEGER,
      tiktok_engagement_rate REAL,
      snap_handle TEXT,
      snap_url TEXT,
      snap_followers INTEGER,
      snap_engagement_rate REAL,
      fb_handle TEXT,
      fb_url TEXT,
      fb_followers INTEGER,
      fb_engagement_rate REAL,
      main_category TEXT,
      sub_category_1 TEXT,
      sub_category_2 TEXT,
      ig_rate REAL,
      tiktok_rate REAL,
      snapchat_rate REAL,
      facebook_rate REAL,
      package_rate REAL,
      rate_per_deliverable REAL,
      last_known_rate_date TEXT,
      currency TEXT DEFAULT 'SAR',
      phone_number TEXT,
      way_of_contact TEXT,
      email TEXT,
      nationality TEXT,
      country TEXT,
      city TEXT,
      address TEXT,
      mawthouq_certificate INTEGER DEFAULT 0,
      mawthouq_link TEXT,
      national_id TEXT,
      verified_status TEXT DEFAULT 'unverified',
      profile_photo_url TEXT,
      media_kit_link TEXT,
      internal_notes TEXT,
      tags TEXT,
      supplier_source TEXT,
      account_tier TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      is_archived INTEGER DEFAULT 0,
      last_enriched_at TEXT,
      enrichment_status TEXT DEFAULT 'pending'
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS influencers_fts USING fts5(
      id UNINDEXED,
      name_arabic,
      name_english,
      nickname,
      ig_handle,
      tiktok_handle,
      snap_handle,
      fb_handle,
      main_category,
      sub_category_1,
      tags,
      internal_notes,
      content=influencers,
      content_rowid=rowid
    );

    CREATE TRIGGER IF NOT EXISTS influencers_fts_insert AFTER INSERT ON influencers BEGIN
      INSERT INTO influencers_fts(rowid, id, name_arabic, name_english, nickname, ig_handle, tiktok_handle, snap_handle, fb_handle, main_category, sub_category_1, tags, internal_notes)
      VALUES (new.rowid, new.id, new.name_arabic, new.name_english, new.nickname, new.ig_handle, new.tiktok_handle, new.snap_handle, new.fb_handle, new.main_category, new.sub_category_1, new.tags, new.internal_notes);
    END;

    CREATE TRIGGER IF NOT EXISTS influencers_fts_update AFTER UPDATE ON influencers BEGIN
      INSERT INTO influencers_fts(influencers_fts, rowid, id, name_arabic, name_english, nickname, ig_handle, tiktok_handle, snap_handle, fb_handle, main_category, sub_category_1, tags, internal_notes)
      VALUES ('delete', old.rowid, old.id, old.name_arabic, old.name_english, old.nickname, old.ig_handle, old.tiktok_handle, old.snap_handle, old.fb_handle, old.main_category, old.sub_category_1, old.tags, old.internal_notes);
      INSERT INTO influencers_fts(rowid, id, name_arabic, name_english, nickname, ig_handle, tiktok_handle, snap_handle, fb_handle, main_category, sub_category_1, tags, internal_notes)
      VALUES (new.rowid, new.id, new.name_arabic, new.name_english, new.nickname, new.ig_handle, new.tiktok_handle, new.snap_handle, new.fb_handle, new.main_category, new.sub_category_1, new.tags, new.internal_notes);
    END;

    CREATE TRIGGER IF NOT EXISTS influencers_fts_delete AFTER DELETE ON influencers BEGIN
      INSERT INTO influencers_fts(influencers_fts, rowid, id, name_arabic, name_english, nickname, ig_handle, tiktok_handle, snap_handle, fb_handle, main_category, sub_category_1, tags, internal_notes)
      VALUES ('delete', old.rowid, old.id, old.name_arabic, old.name_english, old.nickname, old.ig_handle, old.tiktok_handle, old.snap_handle, old.fb_handle, old.main_category, old.sub_category_1, old.tags, old.internal_notes);
    END;

    CREATE INDEX IF NOT EXISTS idx_influencers_name_english ON influencers(name_english);
    CREATE INDEX IF NOT EXISTS idx_influencers_name_arabic ON influencers(name_arabic);
    CREATE INDEX IF NOT EXISTS idx_influencers_ig_handle ON influencers(ig_handle);
    CREATE INDEX IF NOT EXISTS idx_influencers_tiktok_handle ON influencers(tiktok_handle);
    CREATE INDEX IF NOT EXISTS idx_influencers_main_category ON influencers(main_category);
    CREATE INDEX IF NOT EXISTS idx_influencers_country ON influencers(country);
    CREATE INDEX IF NOT EXISTS idx_influencers_ig_followers ON influencers(ig_followers);
    CREATE INDEX IF NOT EXISTS idx_influencers_archived ON influencers(is_archived);

    CREATE TABLE IF NOT EXISTS edit_log (
      id TEXT PRIMARY KEY,
      influencer_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      edited_by TEXT DEFAULT 'system',
      edited_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      client_name TEXT,
      start_date TEXT,
      end_date TEXT,
      budget REAL,
      brief TEXT,
      platform_focus TEXT,
      status TEXT DEFAULT 'draft',
      created_by TEXT DEFAULT 'admin',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      is_archived INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS campaign_influencers (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      influencer_id TEXT NOT NULL,
      platform TEXT,
      num_posts INTEGER DEFAULT 1,
      rate REAL,
      deliverables TEXT,
      notes TEXT,
      status TEXT DEFAULT 'pending',
      added_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO settings (key, value) VALUES
      ('company_name', 'iConnect Agency'),
      ('default_currency', 'SAR'),
      ('pdf_primary_color', '#2563eb'),
      ('pdf_secondary_color', '#1e40af'),
      ('pdf_font', 'Arial'),
      ('rapidapi_key', ''),
      ('logo_url', '');

    -- ── Influencer Portal ──────────────────────────────────
    CREATE TABLE IF NOT EXISTS portal_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      handle TEXT,
      phone TEXT,
      bio TEXT,
      platforms TEXT,           -- JSON array: ["instagram","tiktok"]
      profile_pic TEXT,
      status TEXT DEFAULT 'active',  -- active | suspended
      influencer_id TEXT,       -- linked DB influencer, if matched
      created_at TEXT DEFAULT (datetime('now')),
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS portal_offers (
      id TEXT PRIMARY KEY,
      campaign_id TEXT,
      influencer_id TEXT,       -- agency DB influencer id
      portal_user_id TEXT,      -- portal account id (nullable until accepted)
      title TEXT NOT NULL,
      brief TEXT,
      platform TEXT,
      deliverables TEXT,        -- "1 Reel + 3 Stories"
      rate REAL,
      currency TEXT DEFAULT 'SAR',
      deadline TEXT,
      status TEXT DEFAULT 'pending',  -- pending|sent|accepted|declined|in_progress|submitted|approved|rejected|completed
      agency_notes TEXT,
      influencer_notes TEXT,
      sent_at TEXT,
      responded_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS portal_deliverables (
      id TEXT PRIMARY KEY,
      offer_id TEXT NOT NULL,
      portal_user_id TEXT NOT NULL,
      submission_type TEXT DEFAULT 'link',  -- link | file
      content_url TEXT,
      file_path TEXT,
      caption TEXT,
      notes TEXT,
      status TEXT DEFAULT 'submitted',  -- submitted | approved | rejected | revision_requested
      feedback TEXT,
      submitted_at TEXT DEFAULT (datetime('now')),
      reviewed_at TEXT,
      reviewed_by TEXT DEFAULT 'agency',
      live_at TEXT,
      live_url TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_portal_offers_status ON portal_offers(status);
    CREATE INDEX IF NOT EXISTS idx_portal_offers_portal_user ON portal_offers(portal_user_id);
    CREATE INDEX IF NOT EXISTS idx_portal_offers_influencer ON portal_offers(influencer_id);
    CREATE INDEX IF NOT EXISTS idx_portal_deliverables_offer ON portal_deliverables(offer_id);
    -- ────────────────────────────────────────────────────────

    CREATE TABLE IF NOT EXISTS import_sessions (
      id TEXT PRIMARY KEY,
      filename TEXT,
      status TEXT DEFAULT 'pending',
      total_rows INTEGER DEFAULT 0,
      added INTEGER DEFAULT 0,
      updated INTEGER DEFAULT 0,
      duplicates INTEGER DEFAULT 0,
      errors INTEGER DEFAULT 0,
      error_details TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    );
  `);

  // ── Phase 1+ tables (additive migration — never drops existing tables) ──────

  db.exec(`
    -- Unified user accounts (all 6 roles)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'public',
      display_name TEXT,
      avatar_url TEXT,
      linked_influencer_id TEXT,
      linked_agency_id TEXT,
      linked_brand_id TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      last_login_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

    CREATE TABLE IF NOT EXISTS agencies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      logo_url TEXT,
      contact_email TEXT,
      commission_override_pct REAL DEFAULT 15,
      verified INTEGER DEFAULT 0,
      subscription_tier TEXT DEFAULT 'basic',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS brands (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      logo_url TEXT,
      category TEXT,
      contact_email TEXT,
      country TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      link TEXT,
      is_read INTEGER DEFAULT 0,
      email_sent INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, is_read);

    -- Campaign notes / comments
    CREATE TABLE IF NOT EXISTS campaign_notes (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      author TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_campaign_notes ON campaign_notes(campaign_id);

    -- Social account OAuth connections
    CREATE TABLE IF NOT EXISTS social_accounts (
      id TEXT PRIMARY KEY,
      influencer_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      token_expiry TEXT,
      platform_user_id TEXT,
      platform_username TEXT,
      connected_at TEXT DEFAULT (datetime('now')),
      last_synced_at TEXT,
      sync_status TEXT DEFAULT 'pending'
    );
    CREATE INDEX IF NOT EXISTS idx_social_accounts_influencer ON social_accounts(influencer_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_social_accounts_unique ON social_accounts(influencer_id, platform);

    -- Live platform stats snapshots
    CREATE TABLE IF NOT EXISTS platform_stats (
      id TEXT PRIMARY KEY,
      influencer_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      follower_count INTEGER,
      following_count INTEGER,
      post_count INTEGER,
      avg_engagement_rate REAL,
      avg_views REAL,
      avg_likes REAL,
      avg_comments REAL,
      audience_age_13_17_pct REAL,
      audience_age_18_24_pct REAL,
      audience_age_25_34_pct REAL,
      audience_age_35_44_pct REAL,
      audience_age_45_plus_pct REAL,
      audience_gender_male_pct REAL,
      audience_gender_female_pct REAL,
      audience_top_country_1 TEXT,
      audience_top_country_2 TEXT,
      audience_top_city_1 TEXT,
      audience_top_city_2 TEXT,
      data_source TEXT DEFAULT 'manual',
      captured_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_platform_stats_influencer ON platform_stats(influencer_id, platform);

    -- Sample / top posts for public profiles
    CREATE TABLE IF NOT EXISTS influencer_posts (
      id TEXT PRIMARY KEY,
      influencer_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      post_id TEXT,
      post_url TEXT,
      thumbnail_url TEXT,
      caption TEXT,
      media_type TEXT DEFAULT 'IMAGE',
      likes INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      views INTEGER DEFAULT 0,
      shares INTEGER DEFAULT 0,
      engagement_rate REAL,
      posted_at TEXT,
      is_pinned INTEGER DEFAULT 0,
      source TEXT DEFAULT 'oauth',
      synced_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (influencer_id) REFERENCES influencers(id)
    );
    CREATE INDEX IF NOT EXISTS idx_influencer_posts_influencer ON influencer_posts(influencer_id, platform);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_influencer_posts_unique ON influencer_posts(influencer_id, platform, post_id);

    -- Trust scores
    CREATE TABLE IF NOT EXISTS trust_scores (
      id TEXT PRIMARY KEY,
      influencer_id TEXT UNIQUE NOT NULL,
      score REAL DEFAULT 0,
      tier TEXT DEFAULT 'CAUTION',
      engagement_ratio_score REAL,
      growth_pattern_score REAL,
      account_age_score REAL,
      consistency_score REAL,
      platform_verified_score REAL,
      mawthouq_score REAL,
      calculated_at TEXT DEFAULT (datetime('now'))
    );

    -- Proposals
    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      agency_id TEXT,
      brand_client_id TEXT,
      campaign_name TEXT NOT NULL,
      campaign_type TEXT,
      objective TEXT,
      target_market TEXT,
      target_audience_desc TEXT,
      start_date TEXT,
      end_date TEXT,
      brief_text TEXT,
      total_budget REAL,
      currency TEXT DEFAULT 'SAR',
      status TEXT DEFAULT 'DRAFT',
      created_by_user_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_proposals_agency ON proposals(agency_id);
    CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);

    CREATE TABLE IF NOT EXISTS proposal_influencers (
      id TEXT PRIMARY KEY,
      proposal_id TEXT NOT NULL,
      influencer_id TEXT NOT NULL,
      platform TEXT,
      content_type TEXT,
      num_posts INTEGER DEFAULT 1,
      rate REAL,
      currency TEXT DEFAULT 'SAR',
      status TEXT DEFAULT 'PENDING',
      accepted_at TEXT,
      declined_reason TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_proposal_influencers_proposal ON proposal_influencers(proposal_id);

    CREATE TABLE IF NOT EXISTS proposal_comments (
      id TEXT PRIMARY KEY,
      proposal_id TEXT NOT NULL,
      user_id TEXT,
      influencer_id_ref TEXT,
      comment TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Campaign messaging (scoped per campaign per influencer)
    CREATE TABLE IF NOT EXISTS campaign_messages (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      influencer_id TEXT,
      sender_user_id TEXT,
      message TEXT NOT NULL,
      attachment_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      read_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_campaign_messages_campaign ON campaign_messages(campaign_id);

    -- Full deliverable workflow
    CREATE TABLE IF NOT EXISTS deliverables (
      id TEXT PRIMARY KEY,
      proposal_influencer_id TEXT NOT NULL,
      type TEXT,
      status TEXT DEFAULT 'PENDING',
      draft_url TEXT,
      draft_file_path TEXT,
      live_url TEXT,
      agency_feedback TEXT,
      submitted_at TEXT,
      approved_at TEXT,
      revision_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS post_metrics (
      id TEXT PRIMARY KEY,
      deliverable_id TEXT NOT NULL,
      checked_at TEXT DEFAULT (datetime('now')),
      likes INTEGER,
      comments INTEGER,
      views INTEGER,
      shares INTEGER,
      saves INTEGER,
      reach INTEGER,
      impressions INTEGER,
      data_source TEXT,
      raw_response_json TEXT
    );

    -- Direct brand marketplace
    CREATE TABLE IF NOT EXISTS direct_requests (
      id TEXT PRIMARY KEY,
      brand_user_id TEXT NOT NULL,
      influencer_id TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING',
      platform TEXT,
      content_type TEXT,
      brief TEXT,
      rate_offered REAL,
      rate_final REAL,
      currency TEXT DEFAULT 'SAR',
      deadline TEXT,
      round_number INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      agreed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_direct_requests_influencer ON direct_requests(influencer_id);
    CREATE INDEX IF NOT EXISTS idx_direct_requests_brand ON direct_requests(brand_user_id);

    CREATE TABLE IF NOT EXISTS direct_request_messages (
      id TEXT PRIMARY KEY,
      direct_request_id TEXT NOT NULL,
      sender_user_id TEXT,
      message_type TEXT,
      rate REAL,
      deliverables TEXT,
      deadline TEXT,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Fan booking
    CREATE TABLE IF NOT EXISTS fan_services (
      id TEXT PRIMARY KEY,
      influencer_id TEXT NOT NULL,
      service_type TEXT NOT NULL,
      price REAL,
      currency TEXT DEFAULT 'SAR',
      turnaround_days INTEGER DEFAULT 3,
      is_active INTEGER DEFAULT 1,
      max_per_week INTEGER,
      description TEXT,
      seasonal_service_start TEXT,
      seasonal_service_end TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_fan_services_influencer ON fan_services(influencer_id);

    CREATE TABLE IF NOT EXISTS fan_bookings (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      influencer_id TEXT NOT NULL,
      public_user_id TEXT,
      recipient_name TEXT,
      occasion_message TEXT,
      special_instructions TEXT,
      contact_email TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING',
      fulfillment_url TEXT,
      fulfillment_type TEXT DEFAULT 'link',
      payment_amount REAL,
      commission_amount REAL,
      net_amount REAL,
      stripe_payment_intent_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      fulfilled_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_fan_bookings_influencer ON fan_bookings(influencer_id);

    CREATE TABLE IF NOT EXISTS fan_ratings (
      id TEXT PRIMARY KEY,
      fan_booking_id TEXT UNIQUE NOT NULL,
      rating INTEGER NOT NULL,
      review_text TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Brand store
    CREATE TABLE IF NOT EXISTS store_products (
      id TEXT PRIMARY KEY,
      influencer_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      product_type TEXT,
      price REAL,
      currency TEXT DEFAULT 'SAR',
      cover_image_url TEXT,
      digital_file_url TEXT,
      external_link TEXT,
      affiliate_code TEXT,
      stock_qty INTEGER,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_store_products_influencer ON store_products(influencer_id);

    CREATE TABLE IF NOT EXISTS store_orders (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      influencer_id TEXT NOT NULL,
      buyer_user_id TEXT,
      buyer_email TEXT NOT NULL,
      buyer_name TEXT,
      status TEXT DEFAULT 'PENDING',
      payment_amount REAL,
      commission_amount REAL,
      net_amount REAL,
      stripe_payment_intent_id TEXT,
      fulfillment_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      fulfilled_at TEXT
    );

    -- Talent Academy
    CREATE TABLE IF NOT EXISTS academy_courses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      level TEXT DEFAULT 'BEGINNER',
      language TEXT DEFAULT 'AR',
      duration_minutes INTEGER,
      price REAL DEFAULT 0,
      currency TEXT DEFAULT 'SAR',
      is_free INTEGER DEFAULT 1,
      video_url TEXT,
      thumbnail_url TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS academy_enrollments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      course_id TEXT NOT NULL,
      status TEXT DEFAULT 'ENROLLED',
      enrolled_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      certificate_issued INTEGER DEFAULT 0
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_academy_enrollment_unique ON academy_enrollments(user_id, course_id);

    CREATE TABLE IF NOT EXISTS academy_certifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      certification_name TEXT NOT NULL,
      issued_at TEXT DEFAULT (datetime('now')),
      badge_url TEXT
    );

    -- Trend intelligence
    CREATE TABLE IF NOT EXISTS trending_topics (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      market TEXT NOT NULL,
      topic TEXT,
      hashtag TEXT,
      volume_estimate INTEGER,
      captured_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_trending_platform ON trending_topics(platform, market);

    -- Talent manager relationships
    CREATE TABLE IF NOT EXISTS talent_manager_relationships (
      id TEXT PRIMARY KEY,
      talent_manager_user_id TEXT NOT NULL,
      influencer_id TEXT NOT NULL,
      commission_split_pct REAL DEFAULT 10,
      contract_start TEXT,
      contract_end TEXT,
      status TEXT DEFAULT 'ACTIVE',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Brand collaborations history
    CREATE TABLE IF NOT EXISTS brand_collaborations (
      id TEXT PRIMARY KEY,
      influencer_id TEXT NOT NULL,
      brand_name TEXT NOT NULL,
      brand_logo_url TEXT,
      campaign_type TEXT,
      period_start TEXT,
      period_end TEXT,
      verified INTEGER DEFAULT 0,
      added_by_user_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_brand_collaborations_influencer ON brand_collaborations(influencer_id);

    -- Commissions ledger
    CREATE TABLE IF NOT EXISTS commissions (
      id TEXT PRIMARY KEY,
      transaction_type TEXT NOT NULL,
      reference_id TEXT NOT NULL,
      gross_amount REAL,
      commission_rate REAL,
      commission_amount REAL,
      net_amount REAL,
      status TEXT DEFAULT 'PENDING',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Escrow transactions
    CREATE TABLE IF NOT EXISTS escrow_transactions (
      id TEXT PRIMARY KEY,
      proposal_id TEXT NOT NULL,
      influencer_id TEXT,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'SAR',
      status TEXT DEFAULT 'HELD',
      held_at TEXT DEFAULT (datetime('now')),
      released_at TEXT,
      paid_at TEXT,
      payment_reference TEXT,
      notes TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_escrow_proposal ON escrow_transactions(proposal_id);

    -- Studio tools
    CREATE TABLE IF NOT EXISTS studio_tool_usage (
      id TEXT PRIMARY KEY,
      influencer_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      used_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS content_calendar (
      id TEXT PRIMARY KEY,
      influencer_id TEXT NOT NULL,
      planned_date TEXT NOT NULL,
      platform TEXT,
      content_type TEXT,
      title TEXT,
      notes TEXT,
      status TEXT DEFAULT 'PLANNED',
      campaign_ref_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_content_calendar_influencer ON content_calendar(influencer_id, planned_date);

    -- Profile views
    CREATE TABLE IF NOT EXISTS profile_views (
      id TEXT PRIMARY KEY,
      influencer_id TEXT NOT NULL,
      viewer_user_id TEXT,
      viewer_ip_hash TEXT,
      viewed_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_profile_views_influencer ON profile_views(influencer_id);

    -- Shortlists
    CREATE TABLE IF NOT EXISTS shortlists (
      id TEXT PRIMARY KEY,
      agency_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shortlist_influencers (
      id TEXT PRIMARY KEY,
      shortlist_id TEXT NOT NULL,
      influencer_id TEXT NOT NULL,
      added_at TEXT DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_shortlist_influencer_unique ON shortlist_influencers(shortlist_id, influencer_id);

    -- Creator filter presets
    CREATE TABLE IF NOT EXISTS creator_presets (
      id TEXT PRIMARY KEY,
      influencer_id TEXT NOT NULL,
      preset_name TEXT NOT NULL,
      preset_settings_json TEXT,
      is_for_sale INTEGER DEFAULT 0,
      price REAL,
      currency TEXT DEFAULT 'SAR',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Payment tracking migrations
  const paymentCols = [
    `ALTER TABLE portal_offers ADD COLUMN payment_status TEXT DEFAULT 'unpaid'`,
    `ALTER TABLE portal_offers ADD COLUMN paid_at TEXT`,
    `ALTER TABLE portal_offers ADD COLUMN payment_reference TEXT`,
    `ALTER TABLE portal_offers ADD COLUMN payment_notes TEXT`,
  ];
  for (const sql of paymentCols) {
    try { db.prepare(sql).run(); } catch { /* column already exists */ }
  }

  // Add new columns to influencers table (safe — ALTER TABLE ignores if column exists)
  const newInfluencerCols: [string, string][] = [
    ['youtube_handle',             'TEXT'],
    ['youtube_url',                'TEXT'],
    ['youtube_followers',          'INTEGER'],
    ['youtube_engagement_rate',    'REAL'],
    ['youtube_rate',               'REAL'],
    ['twitter_handle',             'TEXT'],
    ['twitter_url',                'TEXT'],
    ['twitter_followers',          'INTEGER'],
    ['twitter_engagement_rate',    'REAL'],
    ['twitter_rate',               'REAL'],
    ['language',                   'TEXT'],
    ['advertising_license_number', 'TEXT'],
    ['license_issuing_authority',  'TEXT'],
    ['license_expiry',             'TEXT'],
    ['license_verified',           'INTEGER DEFAULT 0'],
    ['trust_score',                'REAL'],
    ['trust_tier',                 'TEXT'],
  ];
  for (const [col, def] of newInfluencerCols) {
    try { db.exec(`ALTER TABLE influencers ADD COLUMN ${col} ${def}`); } catch { /* already exists */ }
  }

  // Add invite_token to influencers
  try { db.exec(`ALTER TABLE influencers ADD COLUMN invite_token TEXT`); } catch { /* already exists */ }

  // Add counter-offer fields to portal_offers
  const offerNegotiationCols: [string, string][] = [
    ['counter_rate',     'REAL'],
    ['counter_currency', 'TEXT'],
    ['counter_notes',    'TEXT'],
    ['counter_by',       'TEXT'],
    ['counter_at',       'TEXT'],
  ];
  for (const [col, def] of offerNegotiationCols) {
    try { db.exec(`ALTER TABLE portal_offers ADD COLUMN ${col} ${def}`); } catch { /* already exists */ }
  }

  // Add new columns to agencies table
  const newAgencyCols: [string, string][] = [
    ['website', 'TEXT'],
    ['country', 'TEXT'],
  ];
  for (const [col, def] of newAgencyCols) {
    try { db.exec(`ALTER TABLE agencies ADD COLUMN ${col} ${def}`); } catch { /* already exists */ }
  }

  // Add new columns to brands table
  const newBrandCols: [string, string][] = [
    ['website',      'TEXT'],
    ['industry',     'TEXT'],
    ['budget_range', 'TEXT'],
  ];
  for (const [col, def] of newBrandCols) {
    try { db.exec(`ALTER TABLE brands ADD COLUMN ${col} ${def}`); } catch { /* already exists */ }
  }

  // Portal user OAuth identity columns
  const portalOAuthCols: [string, string][] = [
    ['oauth_provider',    'TEXT'],          // 'facebook' | 'google' | null (password auth)
    ['oauth_id',          'TEXT'],          // provider's user ID
    ['oauth_name',        'TEXT'],          // display name from provider
    ['oauth_picture',     'TEXT'],          // profile picture URL from provider
    ['password_hash_bak', 'TEXT'],          // kept for portability; NULL for pure-OAuth accounts
  ];
  for (const [col, def] of portalOAuthCols) {
    try { db.exec(`ALTER TABLE portal_users ADD COLUMN ${col} ${def}`); } catch { /* already exists */ }
  }
  // Allow password_hash to be NULL for OAuth-only accounts
  // (SQLite cannot change NOT NULL constraint in ALTER — handled in INSERT logic instead)

  // portal_deliverables file metadata columns
  for (const [col, def] of [
    ['file_name', 'TEXT'],
    ['file_size', 'INTEGER'],
    ['mime_type', 'TEXT'],
  ] as [string, string][]) {
    try { db.exec(`ALTER TABLE portal_deliverables ADD COLUMN ${col} ${def}`); } catch { /* already exists */ }
  }

  // Offer templates
  db.exec(`
    CREATE TABLE IF NOT EXISTS offer_templates (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      title       TEXT,
      platform    TEXT,
      content_type TEXT,
      brief       TEXT,
      deliverables TEXT,
      rate        REAL,
      currency    TEXT DEFAULT 'SAR',
      agency_notes TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    )
  `);

  // Add fan access columns to influencers table
  for (const [col, def] of [
    ['fan_shoutout_price',   'REAL'],
    ['fan_video_price',      'REAL'],
    ['fan_photo_price',      'REAL'],
    ['fan_meetup_price',     'REAL'],
    ['fan_live_chat_price',  'REAL'],
    ['fan_custom_price',     'REAL'],
    ['fan_response_time',    'TEXT'],
    ['fan_bio',              'TEXT'],
    ['fan_requests_enabled', 'INTEGER DEFAULT 1'],
  ] as [string, string][]) {
    try { db.exec(`ALTER TABLE influencers ADD COLUMN ${col} ${def}`); } catch { /* already exists */ }
  }

  // ── Fan Access ─────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS fan_users (
      id          TEXT PRIMARY KEY,
      email       TEXT UNIQUE NOT NULL,
      password    TEXT NOT NULL,
      name        TEXT,
      username    TEXT,
      bio         TEXT,
      country     TEXT,
      avatar_url  TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_fan_users_email ON fan_users(email);

    CREATE TABLE IF NOT EXISTS fan_requests (
      id              TEXT PRIMARY KEY,
      fan_user_id     TEXT NOT NULL REFERENCES fan_users(id),
      influencer_id   TEXT NOT NULL REFERENCES influencers(id),
      request_type    TEXT NOT NULL,
      title           TEXT NOT NULL,
      message         TEXT,
      budget          REAL,
      currency        TEXT DEFAULT 'SAR',
      platform        TEXT,
      deadline        TEXT,
      status          TEXT DEFAULT 'pending',
      influencer_note TEXT,
      delivery_url    TEXT,
      delivery_note   TEXT,
      submitted_at    TEXT DEFAULT (datetime('now')),
      responded_at    TEXT,
      fulfilled_at    TEXT,
      updated_at      TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_fan_requests_fan ON fan_requests(fan_user_id);
    CREATE INDEX IF NOT EXISTS idx_fan_requests_influencer ON fan_requests(influencer_id);
    CREATE INDEX IF NOT EXISTS idx_fan_requests_status ON fan_requests(status);
  `);

  console.log('Database initialized successfully');
}
