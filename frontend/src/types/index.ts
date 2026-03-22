export interface PlatformStat {
  platform: string;
  follower_count?: number;
  avg_engagement_rate?: number;
  avg_views?: number;
  avg_likes?: number;
  data_source?: string;
  captured_at?: string;
}

export interface InfluencerPost {
  id: string;
  platform: string;
  post_url?: string;
  thumbnail_url?: string;
  caption?: string;
  media_type?: string;
  likes?: number;
  comments?: number;
  views?: number;
  shares?: number;
  posted_at?: string;
  is_pinned?: number;
  source?: string;
}

export interface Influencer {
  id: string;
  serial?: number;
  name_arabic?: string;
  name_english?: string;
  nickname?: string;

  ig_handle?: string;
  ig_url?: string;
  ig_followers?: number;
  ig_engagement_rate?: number;
  ig_rate?: number;

  tiktok_handle?: string;
  tiktok_url?: string;
  tiktok_followers?: number;
  tiktok_engagement_rate?: number;
  tiktok_rate?: number;

  snap_handle?: string;
  snap_url?: string;
  snap_followers?: number;
  snap_engagement_rate?: number;
  snapchat_rate?: number;

  fb_handle?: string;
  fb_url?: string;
  fb_followers?: number;
  fb_engagement_rate?: number;
  facebook_rate?: number;

  youtube_handle?: string;
  youtube_url?: string;
  youtube_followers?: number;

  twitter_handle?: string;

  language?: string;

  trust_score?: number;
  trust_tier?: string;

  main_category?: string;
  sub_category_1?: string;
  sub_category_2?: string;
  account_tier?: string;

  package_rate?: number;
  rate_per_deliverable?: number;
  last_known_rate_date?: string;
  currency?: string;

  phone_number?: string;
  way_of_contact?: string;
  email?: string;

  nationality?: string;
  country?: string;
  city?: string;
  address?: string;

  mawthouq_certificate?: number;
  mawthouq_link?: string;
  national_id?: string;
  verified_status?: string;
  advertising_license_number?: string;

  profile_photo_url?: string;
  media_kit_link?: string;

  internal_notes?: string;
  tags?: string;
  supplier_source?: string;

  created_at?: string;
  updated_at?: string;
  is_archived?: number;
  last_enriched_at?: string;
  enrichment_status?: string;

  platform_stats?: PlatformStat[];
  top_posts?: InfluencerPost[];
}

export interface Campaign {
  id: string;
  name: string;
  client_name?: string;
  start_date?: string;
  end_date?: string;
  budget?: number;
  brief?: string;
  platform_focus?: string;
  status: 'draft' | 'sent' | 'approved' | 'active' | 'completed';
  created_at?: string;
  updated_at?: string;
  influencer_count?: number;
  total_cost?: number;
  influencers?: CampaignInfluencer[];
}

export interface CampaignInfluencer {
  id: string;
  campaign_id: string;
  influencer_id: string;
  platform?: string;
  num_posts?: number;
  rate?: number;
  deliverables?: string;
  notes?: string;
  status?: string;
  offer_status?: string;   // latest offer status from portal_offers
  added_at?: string;
  // Joined from influencers
  name_english?: string;
  name_arabic?: string;
  ig_handle?: string;
  tiktok_handle?: string;
  snap_handle?: string;
  fb_handle?: string;
  ig_followers?: number;
  tiktok_followers?: number;
  snap_followers?: number;
  fb_followers?: number;
  profile_photo_url?: string;
  main_category?: string;
  account_tier?: string;
  ig_rate?: number;
  tiktok_rate?: number;
  snapchat_rate?: number;
  package_rate?: number;
  nationality?: string;
  country?: string;
  city?: string;
  mawthouq_certificate?: number;
}

export interface ColumnMapping {
  rawName: string;
  mappedField: string | null;
  confidence: number;
  index: number;
}

export interface ImportPreviewSheet {
  sheetName: string;
  headers: ColumnMapping[];
  rows: Record<string, unknown>[];
  totalRows: number;
}

export interface ImportResult {
  sessionId: string;
  filename: string;
  added: number;
  updated: number;
  duplicates: number;
  errors: number;
  errorDetails: string[];
}

export interface FilterState {
  search: string;
  category: string;
  platform: string;
  tier: string;
  country: string;
  mawthouq: boolean | null;
  hasPhone: boolean | null;
  supplierSource: string;
  tags: string;
  minFollowers: number | null;
  maxFollowers: number | null;
  minRate: number | null;
  maxRate: number | null;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  page: number;
  limit: number;
  enrichmentStatus: '' | 'pending' | 'enriched' | 'failed';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface Settings {
  company_name: string;
  default_currency: string;
  pdf_primary_color: string;
  pdf_secondary_color: string;
  pdf_font: string;
  rapidapi_key: string;
  logo_url: string;
}

export interface OfferTemplate {
  id: string;
  name: string;
  title?: string;
  platform?: string;
  content_type?: string;
  brief?: string;
  deliverables?: string;
  rate?: number;
  currency?: string;
  agency_notes?: string;
  created_at?: string;
}

export interface FilterMeta {
  categories: string[];
  countries: string[];
  sources: string[];
  tiers: string[];
  stats: {
    total: number;
    mawthouq_count: number;
    max_followers: number;
    max_rate: number;
  };
}
