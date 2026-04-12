-- ─────────────────────────────────────────────────────────────────────────────
-- FALAK Platform — PostgreSQL schema migration
-- Converted from SQLite (node:sqlite) to PostgreSQL 15+
--
-- Changes from SQLite version:
--   • TEXT DEFAULT (datetime('now'))   →  TIMESTAMPTZ DEFAULT NOW()
--   • INTEGER 0/1 booleans kept as    INTEGER  (existing code reads 0/1)
--   • FTS5 virtual table replaced by  tsvector column + GIN index + trigger
--   • INSERT OR IGNORE                →  ON CONFLICT DO NOTHING
--   • REAL                            →  DOUBLE PRECISION (alias: FLOAT8)
--   • All text primary keys stay TEXT (UUIDs stored as text)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Core entities ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS influencers (
  id                        TEXT PRIMARY KEY,
  serial                    INTEGER,
  name_arabic               TEXT,
  name_english              TEXT,
  nickname                  TEXT,
  ig_handle                 TEXT,
  ig_url                    TEXT,
  ig_followers              INTEGER,
  ig_engagement_rate        DOUBLE PRECISION,
  tiktok_handle             TEXT,
  tiktok_url                TEXT,
  tiktok_followers          INTEGER,
  tiktok_engagement_rate    DOUBLE PRECISION,
  snap_handle               TEXT,
  snap_url                  TEXT,
  snap_followers            INTEGER,
  snap_engagement_rate      DOUBLE PRECISION,
  fb_handle                 TEXT,
  fb_url                    TEXT,
  fb_followers              INTEGER,
  fb_engagement_rate        DOUBLE PRECISION,
  youtube_handle            TEXT,
  youtube_url               TEXT,
  youtube_followers         INTEGER,
  youtube_engagement_rate   DOUBLE PRECISION,
  youtube_rate              DOUBLE PRECISION,
  twitter_handle            TEXT,
  twitter_url               TEXT,
  twitter_followers         INTEGER,
  twitter_engagement_rate   DOUBLE PRECISION,
  twitter_rate              DOUBLE PRECISION,
  main_category             TEXT,
  sub_category_1            TEXT,
  sub_category_2            TEXT,
  ig_rate                   DOUBLE PRECISION,
  tiktok_rate               DOUBLE PRECISION,
  snapchat_rate             DOUBLE PRECISION,
  facebook_rate             DOUBLE PRECISION,
  package_rate              DOUBLE PRECISION,
  rate_per_deliverable      DOUBLE PRECISION,
  last_known_rate_date      TEXT,
  currency                  TEXT DEFAULT 'SAR',
  phone_number              TEXT,
  way_of_contact            TEXT,
  email                     TEXT,
  nationality               TEXT,
  country                   TEXT,
  city                      TEXT,
  address                   TEXT,
  mawthouq_certificate      INTEGER DEFAULT 0,
  mawthouq_link             TEXT,
  national_id               TEXT,
  verified_status           TEXT DEFAULT 'unverified',
  profile_photo_url         TEXT,
  media_kit_link            TEXT,
  internal_notes            TEXT,
  tags                      TEXT,
  supplier_source           TEXT,
  account_tier              TEXT,
  language                  TEXT,
  advertising_license_number TEXT,
  license_issuing_authority TEXT,
  license_expiry            TEXT,
  license_verified          INTEGER DEFAULT 0,
  trust_score               DOUBLE PRECISION,
  trust_tier                TEXT,
  invite_token              TEXT,
  fan_shoutout_price        DOUBLE PRECISION,
  fan_video_price           DOUBLE PRECISION,
  fan_photo_price           DOUBLE PRECISION,
  fan_meetup_price          DOUBLE PRECISION,
  fan_live_chat_price       DOUBLE PRECISION,
  fan_custom_price          DOUBLE PRECISION,
  fan_response_time         TEXT,
  fan_bio                   TEXT,
  fan_requests_enabled      INTEGER DEFAULT 1,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW(),
  is_archived               INTEGER DEFAULT 0,
  last_enriched_at          TIMESTAMPTZ,
  enrichment_status         TEXT DEFAULT 'pending',
  is_demo                   INTEGER DEFAULT 0,
  -- Full-text search vector (replaces FTS5 virtual table)
  search_vector             TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('simple',
      COALESCE(name_arabic,     '') || ' ' ||
      COALESCE(name_english,    '') || ' ' ||
      COALESCE(nickname,        '') || ' ' ||
      COALESCE(ig_handle,       '') || ' ' ||
      COALESCE(tiktok_handle,   '') || ' ' ||
      COALESCE(snap_handle,     '') || ' ' ||
      COALESCE(fb_handle,       '') || ' ' ||
      COALESCE(youtube_handle,  '') || ' ' ||
      COALESCE(twitter_handle,  '') || ' ' ||
      COALESCE(main_category,   '') || ' ' ||
      COALESCE(sub_category_1,  '') || ' ' ||
      COALESCE(tags,            '') || ' ' ||
      COALESCE(internal_notes,  '')
    )
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_influencers_name_english  ON influencers(name_english);
CREATE INDEX IF NOT EXISTS idx_influencers_name_arabic   ON influencers(name_arabic);
CREATE INDEX IF NOT EXISTS idx_influencers_ig_handle     ON influencers(ig_handle);
CREATE INDEX IF NOT EXISTS idx_influencers_tiktok_handle ON influencers(tiktok_handle);
CREATE INDEX IF NOT EXISTS idx_influencers_main_category ON influencers(main_category);
CREATE INDEX IF NOT EXISTS idx_influencers_country       ON influencers(country);
CREATE INDEX IF NOT EXISTS idx_influencers_ig_followers  ON influencers(ig_followers);
CREATE INDEX IF NOT EXISTS idx_influencers_archived      ON influencers(is_archived);
-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_influencers_search ON influencers USING GIN(search_vector);

-- ── Audit log ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS edit_log (
  id            TEXT PRIMARY KEY,
  influencer_id TEXT NOT NULL,
  field_name    TEXT NOT NULL,
  old_value     TEXT,
  new_value     TEXT,
  edited_by     TEXT DEFAULT 'system',
  edited_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Campaigns ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS campaigns (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  client_name           TEXT,
  start_date            TEXT,
  end_date              TEXT,
  budget                DOUBLE PRECISION,
  brief                 TEXT,
  platform_focus        TEXT,
  status                TEXT DEFAULT 'draft',
  created_by            TEXT DEFAULT 'admin',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  is_archived           INTEGER DEFAULT 0,
  is_demo               INTEGER DEFAULT 0,
  -- AI matching columns
  target_gender         TEXT,
  target_age_min        INTEGER,
  target_age_max        INTEGER,
  target_countries      TEXT,
  target_interests      TEXT,
  campaign_objective    TEXT,
  budget_per_influencer DOUBLE PRECISION,
  ai_match_cache        TEXT,
  ai_match_generated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS campaign_influencers (
  id             TEXT PRIMARY KEY,
  campaign_id    TEXT NOT NULL,
  influencer_id  TEXT NOT NULL,
  platform       TEXT,
  num_posts      INTEGER DEFAULT 1,
  rate           DOUBLE PRECISION,
  deliverables   TEXT,
  notes          TEXT,
  status         TEXT DEFAULT 'pending',
  added_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Settings ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO settings (key, value) VALUES
  ('company_name',                      'iConnect Agency'),
  ('default_currency',                  'SAR'),
  ('pdf_primary_color',                 '#2563eb'),
  ('pdf_secondary_color',               '#1e40af'),
  ('pdf_font',                          'Arial'),
  ('rapidapi_key',                      ''),
  ('logo_url',                          ''),
  ('platform_commission_pct',           '10'),
  ('subscription_free_max_influencers', '50'),
  ('subscription_free_max_campaigns',   '3'),
  ('subscription_growth_price_sar',     '1499'),
  ('subscription_pro_price_sar',        '2999'),
  ('subscription_enterprise_price_sar', '5999')
ON CONFLICT (key) DO NOTHING;

-- ── Influencer portal ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS portal_users (
  id               TEXT PRIMARY KEY,
  email            TEXT UNIQUE NOT NULL,
  password_hash    TEXT,
  name             TEXT,
  handle           TEXT,
  phone            TEXT,
  bio              TEXT,
  platforms        TEXT,
  profile_pic      TEXT,
  status           TEXT DEFAULT 'active',
  influencer_id    TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  last_login_at    TIMESTAMPTZ,
  oauth_provider   TEXT,
  oauth_id         TEXT,
  oauth_name       TEXT,
  oauth_picture    TEXT,
  password_hash_bak TEXT,
  is_demo           INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS portal_offers (
  id                  TEXT PRIMARY KEY,
  campaign_id         TEXT,
  influencer_id       TEXT,
  portal_user_id      TEXT,
  title               TEXT NOT NULL,
  brief               TEXT,
  platform            TEXT,
  deliverables        TEXT,
  rate                DOUBLE PRECISION,
  currency            TEXT DEFAULT 'SAR',
  deadline            TEXT,
  status              TEXT DEFAULT 'pending',
  agency_notes        TEXT,
  influencer_notes    TEXT,
  sent_at             TIMESTAMPTZ,
  responded_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  -- Payment tracking
  payment_status      TEXT DEFAULT 'unpaid',
  paid_at             TIMESTAMPTZ,
  payment_reference   TEXT,
  payment_notes       TEXT,
  -- Counter-offer
  counter_rate        DOUBLE PRECISION,
  counter_currency    TEXT,
  counter_notes       TEXT,
  counter_by          TEXT,
  counter_at          TIMESTAMPTZ,
  -- Revenue
  platform_fee_pct    DOUBLE PRECISION,
  platform_fee_amount DOUBLE PRECISION,
  net_amount          DOUBLE PRECISION,
  -- Expiry
  expiry_warned_at    TIMESTAMPTZ,
  is_demo             INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_portal_offers_status      ON portal_offers(status);
CREATE INDEX IF NOT EXISTS idx_portal_offers_portal_user ON portal_offers(portal_user_id);
CREATE INDEX IF NOT EXISTS idx_portal_offers_influencer  ON portal_offers(influencer_id);

CREATE TABLE IF NOT EXISTS portal_deliverables (
  id               TEXT PRIMARY KEY,
  offer_id         TEXT NOT NULL,
  portal_user_id   TEXT NOT NULL,
  submission_type  TEXT DEFAULT 'link',
  content_url      TEXT,
  file_path        TEXT,
  caption          TEXT,
  notes            TEXT,
  status           TEXT DEFAULT 'submitted',
  feedback         TEXT,
  submitted_at     TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at      TIMESTAMPTZ,
  reviewed_by      TEXT DEFAULT 'agency',
  live_at          TIMESTAMPTZ,
  live_url         TEXT,
  file_name        TEXT,
  file_size        INTEGER,
  mime_type        TEXT
);

CREATE INDEX IF NOT EXISTS idx_portal_deliverables_offer ON portal_deliverables(offer_id);

-- ── Import sessions ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS import_sessions (
  id           TEXT PRIMARY KEY,
  filename     TEXT,
  status       TEXT DEFAULT 'pending',
  total_rows   INTEGER DEFAULT 0,
  added        INTEGER DEFAULT 0,
  updated      INTEGER DEFAULT 0,
  duplicates   INTEGER DEFAULT 0,
  errors       INTEGER DEFAULT 0,
  error_details TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ── Unified user accounts ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id                    TEXT PRIMARY KEY,
  email                 TEXT UNIQUE NOT NULL,
  password_hash         TEXT NOT NULL,
  role                  TEXT NOT NULL DEFAULT 'public',
  display_name          TEXT,
  avatar_url            TEXT,
  linked_influencer_id  TEXT,
  linked_agency_id      TEXT,
  linked_brand_id       TEXT,
  status                TEXT DEFAULT 'active',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  last_login_at         TIMESTAMPTZ,
  is_demo               INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);

-- ── Agencies & brands ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agencies (
  id                      TEXT PRIMARY KEY,
  name                    TEXT NOT NULL,
  logo_url                TEXT,
  contact_email           TEXT,
  commission_override_pct DOUBLE PRECISION DEFAULT 15,
  verified                INTEGER DEFAULT 0,
  subscription_tier       TEXT DEFAULT 'basic',
  website                 TEXT,
  country                 TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brands (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  logo_url      TEXT,
  category      TEXT,
  contact_email TEXT,
  country       TEXT,
  website       TEXT,
  industry      TEXT,
  budget_range  TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Notifications ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  link       TEXT,
  is_read    INTEGER DEFAULT 0,
  email_sent INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, is_read);

-- ── Campaign notes ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS campaign_notes (
  id          TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  author      TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_notes ON campaign_notes(campaign_id);

-- ── Social accounts (OAuth connections) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS social_accounts (
  id                TEXT PRIMARY KEY,
  influencer_id     TEXT NOT NULL,
  platform          TEXT NOT NULL,
  access_token      TEXT,
  refresh_token     TEXT,
  token_expiry      TEXT,
  platform_user_id  TEXT,
  platform_username TEXT,
  connected_at      TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at    TIMESTAMPTZ,
  sync_status       TEXT DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_influencer ON social_accounts(influencer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_accounts_unique ON social_accounts(influencer_id, platform);

-- ── Platform stats snapshots ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_stats (
  id                        TEXT PRIMARY KEY,
  influencer_id             TEXT NOT NULL,
  platform                  TEXT NOT NULL,
  follower_count            INTEGER,
  following_count           INTEGER,
  post_count                INTEGER,
  avg_engagement_rate       DOUBLE PRECISION,
  avg_views                 DOUBLE PRECISION,
  avg_likes                 DOUBLE PRECISION,
  avg_comments              DOUBLE PRECISION,
  audience_age_13_17_pct    DOUBLE PRECISION,
  audience_age_18_24_pct    DOUBLE PRECISION,
  audience_age_25_34_pct    DOUBLE PRECISION,
  audience_age_35_44_pct    DOUBLE PRECISION,
  audience_age_45_plus_pct  DOUBLE PRECISION,
  audience_gender_male_pct  DOUBLE PRECISION,
  audience_gender_female_pct DOUBLE PRECISION,
  audience_top_country_1    TEXT,
  audience_top_country_2    TEXT,
  audience_top_city_1       TEXT,
  audience_top_city_2       TEXT,
  data_source               TEXT DEFAULT 'manual',
  captured_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_stats_influencer ON platform_stats(influencer_id, platform);

-- ── Influencer posts ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS influencer_posts (
  id              TEXT PRIMARY KEY,
  influencer_id   TEXT NOT NULL REFERENCES influencers(id),
  platform        TEXT NOT NULL,
  post_id         TEXT,
  post_url        TEXT,
  thumbnail_url   TEXT,
  caption         TEXT,
  media_type      TEXT DEFAULT 'IMAGE',
  likes           INTEGER DEFAULT 0,
  comments        INTEGER DEFAULT 0,
  views           INTEGER DEFAULT 0,
  shares          INTEGER DEFAULT 0,
  engagement_rate DOUBLE PRECISION,
  posted_at       TIMESTAMPTZ,
  is_pinned       INTEGER DEFAULT 0,
  source          TEXT DEFAULT 'oauth',
  synced_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_influencer_posts_influencer ON influencer_posts(influencer_id, platform);
CREATE UNIQUE INDEX IF NOT EXISTS idx_influencer_posts_unique ON influencer_posts(influencer_id, platform, post_id);

-- ── Trust scores ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trust_scores (
  id                       TEXT PRIMARY KEY,
  influencer_id            TEXT UNIQUE NOT NULL,
  score                    DOUBLE PRECISION DEFAULT 0,
  tier                     TEXT DEFAULT 'CAUTION',
  engagement_ratio_score   DOUBLE PRECISION,
  growth_pattern_score     DOUBLE PRECISION,
  account_age_score        DOUBLE PRECISION,
  consistency_score        DOUBLE PRECISION,
  platform_verified_score  DOUBLE PRECISION,
  mawthouq_score           DOUBLE PRECISION,
  calculated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── Proposals ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proposals (
  id                    TEXT PRIMARY KEY,
  agency_id             TEXT,
  brand_client_id       TEXT,
  campaign_name         TEXT NOT NULL,
  campaign_type         TEXT,
  objective             TEXT,
  target_market         TEXT,
  target_audience_desc  TEXT,
  start_date            TEXT,
  end_date              TEXT,
  brief_text            TEXT,
  total_budget          DOUBLE PRECISION,
  currency              TEXT DEFAULT 'SAR',
  status                TEXT DEFAULT 'DRAFT',
  created_by_user_id    TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposals_agency  ON proposals(agency_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status  ON proposals(status);

CREATE TABLE IF NOT EXISTS proposal_influencers (
  id               TEXT PRIMARY KEY,
  proposal_id      TEXT NOT NULL,
  influencer_id    TEXT NOT NULL,
  platform         TEXT,
  content_type     TEXT,
  num_posts        INTEGER DEFAULT 1,
  rate             DOUBLE PRECISION,
  currency         TEXT DEFAULT 'SAR',
  status           TEXT DEFAULT 'PENDING',
  accepted_at      TIMESTAMPTZ,
  declined_reason  TEXT
);

CREATE INDEX IF NOT EXISTS idx_proposal_influencers_proposal ON proposal_influencers(proposal_id);

CREATE TABLE IF NOT EXISTS proposal_comments (
  id                TEXT PRIMARY KEY,
  proposal_id       TEXT NOT NULL,
  user_id           TEXT,
  influencer_id_ref TEXT,
  comment           TEXT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Campaign messaging ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS campaign_messages (
  id             TEXT PRIMARY KEY,
  campaign_id    TEXT NOT NULL,
  influencer_id  TEXT,
  sender_user_id TEXT,
  message        TEXT NOT NULL,
  attachment_url TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  read_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_campaign_messages_campaign ON campaign_messages(campaign_id);

-- ── Deliverables ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deliverables (
  id                      TEXT PRIMARY KEY,
  proposal_influencer_id  TEXT NOT NULL,
  type                    TEXT,
  status                  TEXT DEFAULT 'PENDING',
  draft_url               TEXT,
  draft_file_path         TEXT,
  live_url                TEXT,
  agency_feedback         TEXT,
  submitted_at            TIMESTAMPTZ,
  approved_at             TIMESTAMPTZ,
  revision_count          INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS post_metrics (
  id               TEXT PRIMARY KEY,
  deliverable_id   TEXT NOT NULL,
  checked_at       TIMESTAMPTZ DEFAULT NOW(),
  likes            INTEGER,
  comments         INTEGER,
  views            INTEGER,
  shares           INTEGER,
  saves            INTEGER,
  reach            INTEGER,
  impressions      INTEGER,
  data_source      TEXT,
  raw_response_json TEXT
);

-- ── Direct brand marketplace ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS direct_requests (
  id              TEXT PRIMARY KEY,
  brand_user_id   TEXT NOT NULL,
  influencer_id   TEXT NOT NULL,
  status          TEXT DEFAULT 'PENDING',
  platform        TEXT,
  content_type    TEXT,
  brief           TEXT,
  rate_offered    DOUBLE PRECISION,
  rate_final      DOUBLE PRECISION,
  currency        TEXT DEFAULT 'SAR',
  deadline        TEXT,
  round_number    INTEGER DEFAULT 1,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  agreed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_direct_requests_influencer ON direct_requests(influencer_id);
CREATE INDEX IF NOT EXISTS idx_direct_requests_brand      ON direct_requests(brand_user_id);

CREATE TABLE IF NOT EXISTS direct_request_messages (
  id                TEXT PRIMARY KEY,
  direct_request_id TEXT NOT NULL,
  sender_user_id    TEXT,
  message_type      TEXT,
  rate              DOUBLE PRECISION,
  deliverables      TEXT,
  deadline          TEXT,
  note              TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Fan services & bookings ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fan_services (
  id                      TEXT PRIMARY KEY,
  influencer_id           TEXT NOT NULL,
  service_type            TEXT NOT NULL,
  price                   DOUBLE PRECISION,
  currency                TEXT DEFAULT 'SAR',
  turnaround_days         INTEGER DEFAULT 3,
  is_active               INTEGER DEFAULT 1,
  max_per_week            INTEGER,
  description             TEXT,
  seasonal_service_start  TEXT,
  seasonal_service_end    TEXT
);

CREATE INDEX IF NOT EXISTS idx_fan_services_influencer ON fan_services(influencer_id);

CREATE TABLE IF NOT EXISTS fan_bookings (
  id                       TEXT PRIMARY KEY,
  service_id               TEXT NOT NULL,
  influencer_id            TEXT NOT NULL,
  public_user_id           TEXT,
  recipient_name           TEXT,
  occasion_message         TEXT,
  special_instructions     TEXT,
  contact_email            TEXT NOT NULL,
  status                   TEXT DEFAULT 'PENDING',
  fulfillment_url          TEXT,
  fulfillment_type         TEXT DEFAULT 'link',
  payment_amount           DOUBLE PRECISION,
  commission_amount        DOUBLE PRECISION,
  net_amount               DOUBLE PRECISION,
  stripe_payment_intent_id TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  fulfilled_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fan_bookings_influencer ON fan_bookings(influencer_id);

CREATE TABLE IF NOT EXISTS fan_ratings (
  id              TEXT PRIMARY KEY,
  fan_booking_id  TEXT UNIQUE NOT NULL,
  rating          INTEGER NOT NULL,
  review_text     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Creator store ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS store_products (
  id               TEXT PRIMARY KEY,
  influencer_id    TEXT NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  product_type     TEXT,
  price            DOUBLE PRECISION,
  currency         TEXT DEFAULT 'SAR',
  cover_image_url  TEXT,
  digital_file_url TEXT,
  external_link    TEXT,
  affiliate_code   TEXT,
  stock_qty        INTEGER,
  is_active        INTEGER DEFAULT 1,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_products_influencer ON store_products(influencer_id);

CREATE TABLE IF NOT EXISTS store_orders (
  id                       TEXT PRIMARY KEY,
  product_id               TEXT NOT NULL,
  influencer_id            TEXT NOT NULL,
  buyer_user_id            TEXT,
  buyer_email              TEXT NOT NULL,
  buyer_name               TEXT,
  status                   TEXT DEFAULT 'PENDING',
  payment_amount           DOUBLE PRECISION,
  commission_amount        DOUBLE PRECISION,
  net_amount               DOUBLE PRECISION,
  stripe_payment_intent_id TEXT,
  fulfillment_url          TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  fulfilled_at             TIMESTAMPTZ
);

-- ── Talent Academy ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS academy_courses (
  id               TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  description      TEXT,
  level            TEXT DEFAULT 'BEGINNER',
  language         TEXT DEFAULT 'AR',
  duration_minutes INTEGER,
  price            DOUBLE PRECISION DEFAULT 0,
  currency         TEXT DEFAULT 'SAR',
  is_free          INTEGER DEFAULT 1,
  video_url        TEXT,
  thumbnail_url    TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS academy_enrollments (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL,
  course_id          TEXT NOT NULL,
  status             TEXT DEFAULT 'ENROLLED',
  enrolled_at        TIMESTAMPTZ DEFAULT NOW(),
  completed_at       TIMESTAMPTZ,
  certificate_issued INTEGER DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_academy_enrollment_unique ON academy_enrollments(user_id, course_id);

CREATE TABLE IF NOT EXISTS academy_certifications (
  id                   TEXT PRIMARY KEY,
  user_id              TEXT NOT NULL,
  certification_name   TEXT NOT NULL,
  issued_at            TIMESTAMPTZ DEFAULT NOW(),
  badge_url            TEXT
);

-- ── Trending topics ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trending_topics (
  id               TEXT PRIMARY KEY,
  platform         TEXT NOT NULL,
  market           TEXT NOT NULL,
  topic            TEXT,
  hashtag          TEXT,
  volume_estimate  INTEGER,
  captured_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trending_platform ON trending_topics(platform, market);

-- ── Talent manager relationships ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS talent_manager_relationships (
  id                       TEXT PRIMARY KEY,
  talent_manager_user_id   TEXT NOT NULL,
  influencer_id            TEXT NOT NULL,
  commission_split_pct     DOUBLE PRECISION DEFAULT 10,
  contract_start           TEXT,
  contract_end             TEXT,
  status                   TEXT DEFAULT 'ACTIVE',
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

-- ── Brand collaborations ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brand_collaborations (
  id                TEXT PRIMARY KEY,
  influencer_id     TEXT NOT NULL,
  brand_name        TEXT NOT NULL,
  brand_logo_url    TEXT,
  campaign_type     TEXT,
  period_start      TEXT,
  period_end        TEXT,
  verified          INTEGER DEFAULT 0,
  added_by_user_id  TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_collaborations_influencer ON brand_collaborations(influencer_id);

-- ── Commissions ledger ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS commissions (
  id                TEXT PRIMARY KEY,
  transaction_type  TEXT NOT NULL,
  reference_id      TEXT NOT NULL,
  gross_amount      DOUBLE PRECISION,
  commission_rate   DOUBLE PRECISION,
  commission_amount DOUBLE PRECISION,
  net_amount        DOUBLE PRECISION,
  status            TEXT DEFAULT 'PENDING',
  currency          TEXT DEFAULT 'SAR',
  offer_title       TEXT,
  influencer_id     TEXT,
  agency_id         TEXT,
  collected_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Escrow transactions ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS escrow_transactions (
  id                TEXT PRIMARY KEY,
  proposal_id       TEXT NOT NULL,
  influencer_id     TEXT,
  amount            DOUBLE PRECISION NOT NULL,
  currency          TEXT DEFAULT 'SAR',
  status            TEXT DEFAULT 'HELD',
  held_at           TIMESTAMPTZ DEFAULT NOW(),
  released_at       TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,
  payment_reference TEXT,
  notes             TEXT
);

CREATE INDEX IF NOT EXISTS idx_escrow_proposal ON escrow_transactions(proposal_id);

-- ── Studio tools ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS studio_tool_usage (
  id             TEXT PRIMARY KEY,
  influencer_id  TEXT NOT NULL,
  tool_name      TEXT NOT NULL,
  used_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Content calendar ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS content_calendar (
  id             TEXT PRIMARY KEY,
  influencer_id  TEXT NOT NULL,
  planned_date   TEXT NOT NULL,
  platform       TEXT,
  content_type   TEXT,
  title          TEXT,
  notes          TEXT,
  status         TEXT DEFAULT 'PLANNED',
  campaign_ref_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_content_calendar_influencer ON content_calendar(influencer_id, planned_date);

-- ── Profile views ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profile_views (
  id              TEXT PRIMARY KEY,
  influencer_id   TEXT NOT NULL,
  viewer_user_id  TEXT,
  viewer_ip_hash  TEXT,
  viewed_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_views_influencer ON profile_views(influencer_id);

-- ── Shortlists ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shortlists (
  id         TEXT PRIMARY KEY,
  agency_id  TEXT NOT NULL,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shortlist_influencers (
  id            TEXT PRIMARY KEY,
  shortlist_id  TEXT NOT NULL,
  influencer_id TEXT NOT NULL,
  added_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shortlist_influencer_unique ON shortlist_influencers(shortlist_id, influencer_id);

-- ── Creator presets ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS creator_presets (
  id                    TEXT PRIMARY KEY,
  influencer_id         TEXT NOT NULL,
  preset_name           TEXT NOT NULL,
  preset_settings_json  TEXT,
  is_for_sale           INTEGER DEFAULT 0,
  price                 DOUBLE PRECISION,
  currency              TEXT DEFAULT 'SAR',
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── Offer templates ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS offer_templates (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  title         TEXT,
  platform      TEXT,
  content_type  TEXT,
  brief         TEXT,
  deliverables  TEXT,
  rate          DOUBLE PRECISION,
  currency      TEXT DEFAULT 'SAR',
  agency_notes  TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Fan users & requests ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fan_users (
  id         TEXT PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  password   TEXT NOT NULL,
  name       TEXT,
  username   TEXT,
  bio        TEXT,
  country    TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_demo    INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_fan_users_email ON fan_users(email);

CREATE TABLE IF NOT EXISTS fan_requests (
  id              TEXT PRIMARY KEY,
  fan_user_id     TEXT NOT NULL REFERENCES fan_users(id),
  influencer_id   TEXT NOT NULL REFERENCES influencers(id),
  request_type    TEXT NOT NULL,
  title           TEXT NOT NULL,
  message         TEXT,
  budget          DOUBLE PRECISION,
  currency        TEXT DEFAULT 'SAR',
  platform        TEXT,
  deadline        TEXT,
  status          TEXT DEFAULT 'pending',
  influencer_note TEXT,
  delivery_url    TEXT,
  delivery_note   TEXT,
  share_token     TEXT,
  fan_email       TEXT,
  submitted_at    TIMESTAMPTZ DEFAULT NOW(),
  responded_at    TIMESTAMPTZ,
  fulfilled_at    TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fan_requests_fan         ON fan_requests(fan_user_id);
CREATE INDEX IF NOT EXISTS idx_fan_requests_influencer  ON fan_requests(influencer_id);
CREATE INDEX IF NOT EXISTS idx_fan_requests_status      ON fan_requests(status);

-- ── Loyalty points ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS loyalty_points (
  id           TEXT PRIMARY KEY,
  user_type    TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  action       TEXT NOT NULL,
  points       INTEGER NOT NULL DEFAULT 0,
  reference_id TEXT,
  note         TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_user   ON loyalty_points(user_type, user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_action ON loyalty_points(action);

-- ── Offer messages ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS offer_messages (
  id          TEXT PRIMARY KEY,
  offer_id    TEXT NOT NULL,
  sender_type TEXT NOT NULL,
  sender_id   TEXT NOT NULL,
  body        TEXT NOT NULL,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offer_messages_offer    ON offer_messages(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_messages_created  ON offer_messages(created_at);

-- ── Post-campaign ratings ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS offer_ratings (
  id         TEXT PRIMARY KEY,
  offer_id   TEXT NOT NULL UNIQUE,
  rater_type TEXT NOT NULL,
  rater_id   TEXT NOT NULL,
  rating     INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  review     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offer_ratings_offer ON offer_ratings(offer_id);

-- ── Audience Intelligence (Phyllo) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS phyllo_users (
  id             TEXT PRIMARY KEY,
  influencer_id  TEXT NOT NULL UNIQUE,
  phyllo_user_id TEXT UNIQUE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audience_demographics (
  id            TEXT PRIMARY KEY,
  influencer_id TEXT NOT NULL,
  platform      TEXT NOT NULL,
  age_13_17     DOUBLE PRECISION DEFAULT 0,
  age_18_24     DOUBLE PRECISION DEFAULT 0,
  age_25_34     DOUBLE PRECISION DEFAULT 0,
  age_35_44     DOUBLE PRECISION DEFAULT 0,
  age_45_plus   DOUBLE PRECISION DEFAULT 0,
  gender_male   DOUBLE PRECISION DEFAULT 0,
  gender_female DOUBLE PRECISION DEFAULT 0,
  top_countries TEXT,
  top_cities    TEXT,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_audience_demo_unique ON audience_demographics(influencer_id, platform);

CREATE TABLE IF NOT EXISTS audience_quality (
  id                       TEXT PRIMARY KEY,
  influencer_id            TEXT NOT NULL,
  platform                 TEXT NOT NULL,
  real_followers_pct       DOUBLE PRECISION DEFAULT 0,
  suspicious_followers_pct DOUBLE PRECISION DEFAULT 0,
  mass_followers_pct       DOUBLE PRECISION DEFAULT 0,
  bot_score                DOUBLE PRECISION DEFAULT 0,
  credibility_score        DOUBLE PRECISION DEFAULT 0,
  audience_type            TEXT,
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_audience_quality_unique ON audience_quality(influencer_id, platform);

CREATE TABLE IF NOT EXISTS audience_interests (
  id               TEXT PRIMARY KEY,
  influencer_id    TEXT NOT NULL,
  platform         TEXT NOT NULL,
  interests        TEXT,
  brand_affinities TEXT,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_audience_interests_unique ON audience_interests(influencer_id, platform);

CREATE TABLE IF NOT EXISTS content_performance (
  id              TEXT PRIMARY KEY,
  influencer_id   TEXT NOT NULL,
  platform        TEXT NOT NULL,
  avg_likes       DOUBLE PRECISION DEFAULT 0,
  avg_comments    DOUBLE PRECISION DEFAULT 0,
  avg_views       DOUBLE PRECISION DEFAULT 0,
  avg_shares      DOUBLE PRECISION DEFAULT 0,
  avg_saves       DOUBLE PRECISION DEFAULT 0,
  avg_reach       DOUBLE PRECISION DEFAULT 0,
  avg_impressions DOUBLE PRECISION DEFAULT 0,
  engagement_rate DOUBLE PRECISION DEFAULT 0,
  top_posts       TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_content_perf_unique ON content_performance(influencer_id, platform);

CREATE TABLE IF NOT EXISTS sentiment_analysis (
  id                    TEXT PRIMARY KEY,
  influencer_id         TEXT NOT NULL,
  platform              TEXT NOT NULL,
  post_id               TEXT,
  positive_pct          DOUBLE PRECISION DEFAULT 0,
  neutral_pct           DOUBLE PRECISION DEFAULT 0,
  negative_pct          DOUBLE PRECISION DEFAULT 0,
  troll_count           INTEGER DEFAULT 0,
  spam_count            INTEGER DEFAULT 0,
  genuine_fan_count     INTEGER DEFAULT 0,
  top_positive_keywords TEXT,
  top_negative_keywords TEXT,
  analyzed_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sentiment_influencer ON sentiment_analysis(influencer_id, platform);

-- ── AI Agent tables ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_briefings (
  id            TEXT PRIMARY KEY,
  influencer_id TEXT NOT NULL,
  briefing_type TEXT NOT NULL DEFAULT 'weekly',
  content       TEXT,
  data_snapshot TEXT,
  generated_at  TIMESTAMPTZ DEFAULT NOW(),
  read_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_briefings_influencer ON agent_briefings(influencer_id);

CREATE TABLE IF NOT EXISTS shadow_profiles (
  id                TEXT PRIMARY KEY,
  name              TEXT,
  handle            TEXT,
  platform          TEXT,
  follower_count    INTEGER DEFAULT 0,
  category          TEXT,
  country           TEXT,
  profile_url       TEXT,
  email             TEXT,
  claim_status      TEXT DEFAULT 'unclaimed',
  contact_attempts  INTEGER DEFAULT 0,
  last_contacted_at TIMESTAMPTZ,
  claim_token       TEXT UNIQUE,
  influencer_id     TEXT REFERENCES influencers(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shadow_profiles_status   ON shadow_profiles(claim_status);
CREATE INDEX IF NOT EXISTS idx_shadow_profiles_platform ON shadow_profiles(platform);

CREATE TABLE IF NOT EXISTS outreach_log (
  id                TEXT PRIMARY KEY,
  shadow_profile_id TEXT NOT NULL REFERENCES shadow_profiles(id),
  channel           TEXT NOT NULL DEFAULT 'email',
  message_sent      TEXT,
  sent_at           TIMESTAMPTZ DEFAULT NOW(),
  response          TEXT,
  responded_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outreach_log_profile ON outreach_log(shadow_profile_id);

-- ── Ad Network tables ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS custom_audiences (
  id                   TEXT PRIMARY KEY,
  campaign_id          TEXT,
  agency_id            TEXT,
  brand_id             TEXT,
  audience_name        TEXT NOT NULL,
  platform             TEXT NOT NULL,
  audience_size        INTEGER DEFAULT 0,
  match_rate           DOUBLE PRECISION DEFAULT 0,
  status               TEXT DEFAULT 'building',
  external_audience_id TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  synced_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_custom_audiences_campaign ON custom_audiences(campaign_id);
CREATE INDEX IF NOT EXISTS idx_custom_audiences_agency   ON custom_audiences(agency_id);

CREATE TABLE IF NOT EXISTS audience_members (
  id                 TEXT PRIMARY KEY,
  custom_audience_id TEXT NOT NULL REFERENCES custom_audiences(id),
  identifier_type    TEXT NOT NULL DEFAULT 'hashed_email',
  identifier_value   TEXT NOT NULL,
  source             TEXT,
  added_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audience_members_audience ON audience_members(custom_audience_id);

-- ── Fraud detection ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fraud_alerts (
  id            TEXT PRIMARY KEY,
  influencer_id TEXT NOT NULL,
  alert_type    TEXT NOT NULL,
  severity      TEXT DEFAULT 'medium',
  details       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at   TIMESTAMPTZ,
  action_taken  TEXT
);

CREATE INDEX IF NOT EXISTS idx_fraud_alerts_influencer ON fraud_alerts(influencer_id);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_reviewed   ON fraud_alerts(reviewed_at);
