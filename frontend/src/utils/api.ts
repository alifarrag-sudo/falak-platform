import axios from 'axios';
import type {
  Influencer, Campaign, CampaignInfluencer, ImportResult,
  ImportPreviewSheet, FilterState, PaginatedResponse, Settings, FilterMeta,
  InfluencerPost,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// Attach unified auth token to every request if present (non-breaking — servers ignore unknown tokens)
api.interceptors.request.use(config => {
  const token = localStorage.getItem('cp_auth_token');
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Unified Auth ──────────────────────────────────────────────────────────────

export const authRegister = async (payload: {
  email: string;
  password: string;
  role: string;
  display_name?: string;
  agency_name?: string;
  brand_name?: string;
}) => {
  const { data } = await api.post('/auth/register', payload);
  if (data.token) localStorage.setItem('cp_auth_token', data.token);
  return data;
};

export const authLogin = async (email: string, password: string) => {
  const { data } = await api.post('/auth/login', { email, password });
  if (data.token) localStorage.setItem('cp_auth_token', data.token);
  return data;
};

export const authMe = async () => {
  const { data } = await api.get('/auth/me');
  return data;
};

// ─── Admin User Management ────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  display_name: string;
  status: string;
  created_at: string;
  last_login_at: string | null;
}

export interface GetUsersParams {
  search?: string;
  role?: string;
  page?: number;
  limit?: number;
}

export interface GetUsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export const getUsers = async (params?: GetUsersParams): Promise<GetUsersResponse> => {
  const { data } = await api.get<GetUsersResponse>('/auth/users', { params });
  return data;
};

export const createAdminUser = async (payload: {
  email: string;
  password: string;
  role: string;
  display_name?: string;
}): Promise<{ user: AdminUser }> => {
  const { data } = await api.post<{ user: AdminUser }>('/auth/users', payload);
  return data;
};

export const updateUser = async (
  id: string,
  updates: { status?: string; role?: string; display_name?: string }
): Promise<{ user: AdminUser }> => {
  const { data } = await api.put<{ user: AdminUser }>(`/auth/users/${id}`, updates);
  return data;
};

export const deleteUser = async (id: string): Promise<void> => {
  await api.delete(`/auth/users/${id}`);
};

// ─── Notifications ─────────────────────────────────────────────────────────────

export const getNotifications = async () => {
  const { data } = await api.get('/notifications');
  return data as { notifications: Record<string, unknown>[]; unread_count: number };
};

export const markNotificationRead = async (id: string) => {
  await api.put(`/notifications/${id}/read`);
};

export const markAllNotificationsRead = async () => {
  await api.put('/notifications/read-all');
};

export const deleteNotification = async (id: string) => {
  await api.delete(`/notifications/${id}`);
};

// ─── Influencers ──────────────────────────────────────────────────────────────

export const getInfluencers = async (filters: Partial<FilterState>): Promise<PaginatedResponse<Influencer>> => {
  const params: Record<string, unknown> = {};
  if (filters.search) params.search = filters.search;
  if (filters.category) params.category = filters.category;
  if (filters.platform) params.platform = filters.platform;
  if (filters.tier) params.tier = filters.tier;
  if (filters.country) params.country = filters.country;
  if (filters.mawthouq !== null && filters.mawthouq !== undefined) params.mawthouq = filters.mawthouq;
  if (filters.hasPhone !== null && filters.hasPhone !== undefined) params.hasPhone = filters.hasPhone;
  if (filters.supplierSource) params.supplierSource = filters.supplierSource;
  if (filters.tags) params.tags = filters.tags;
  if (filters.minFollowers) params.minFollowers = filters.minFollowers;
  if (filters.maxFollowers) params.maxFollowers = filters.maxFollowers;
  if (filters.minRate) params.minRate = filters.minRate;
  if (filters.maxRate) params.maxRate = filters.maxRate;
  if (filters.enrichmentStatus) params.enrichment_status = filters.enrichmentStatus;
  if (filters.sortBy) params.sortBy = filters.sortBy;
  if (filters.sortDir) params.sortDir = filters.sortDir;
  params.page = filters.page || 1;
  params.limit = filters.limit || 50;

  const { data } = await api.get<PaginatedResponse<Influencer>>('/influencers', { params });
  return data;
};

export const getInfluencer = async (id: string): Promise<Influencer> => {
  const { data } = await api.get<Influencer>(`/influencers/${id}`);
  return data;
};

export const getInfluencerPublic = async (id: string): Promise<Influencer> => {
  const { data } = await api.get<Influencer>(`/influencers/${id}/public`);
  return data;
};

export const getInfluencerPosts = async (id: string, platform?: string): Promise<{ posts: InfluencerPost[] }> => {
  const { data } = await api.get(`/influencers/${id}/posts`, { params: platform ? { platform } : {} });
  return data;
};

export const createInfluencer = async (influencer: Partial<Influencer>): Promise<Influencer> => {
  const { data } = await api.post<Influencer>('/influencers', influencer);
  return data;
};

export const updateInfluencer = async (id: string, updates: Partial<Influencer>): Promise<Influencer> => {
  const { data } = await api.put<Influencer>(`/influencers/${id}`, updates);
  return data;
};

export const deleteInfluencer = async (id: string): Promise<void> => {
  await api.delete(`/influencers/${id}`);
};

export const getInfluencerHistory = async (id: string) => {
  const { data } = await api.get(`/influencers/${id}/history`);
  return data;
};

export const getFilterMeta = async (): Promise<FilterMeta> => {
  const { data } = await api.get<FilterMeta>('/influencers/meta/filters');
  return data;
};

export const bulkDeleteInfluencers = async (ids: string[]): Promise<void> => {
  await api.post('/influencers/bulk-delete', { ids });
};

export const bulkInviteInfluencers = async (ids: string[]): Promise<{ results: { id: string; name: string; invite_url: string }[] }> => {
  const { data } = await api.post('/influencers/bulk-invite', { ids });
  return data;
};

export const exportContactsCSV = async (ids?: string[]): Promise<void> => {
  const params = ids?.length ? `?ids=${ids.join(',')}` : '';
  const response = await api.get(`/influencers/export/contacts${params}`, { responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `contacts-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export interface DuplicateGroup {
  reason: string;
  influencers: {
    id: string;
    name_english: string | null;
    name_arabic: string | null;
    ig_handle: string | null;
    tiktok_handle: string | null;
    ig_followers: number | null;
    tiktok_followers: number | null;
    created_at: string;
  }[];
}

export interface InfluencerPerformance {
  total_offers: number;
  accepted_offers: number;
  completed_offers: number;
  declined_offers: number;
  response_rate: number | null;
  completion_rate: number | null;
  deliverable_approval_rate: number | null;
  score: number | null;
}

export const getInfluencerPerformance = async (id: string): Promise<InfluencerPerformance> => {
  const { data } = await api.get(`/influencers/${id}/performance`);
  return data;
};

export const generateInviteLink = async (influencerId: string): Promise<{ token: string; invite_url: string }> => {
  const { data } = await api.post(`/influencers/${influencerId}/invite`);
  return data;
};

export const getDuplicates = async (): Promise<DuplicateGroup[]> => {
  const { data } = await api.get('/influencers/duplicates');
  return data;
};

export const mergeInfluencers = async (primary_id: string, duplicate_ids: string[]) => {
  const { data } = await api.post('/influencers/merge', { primary_id, duplicate_ids });
  return data as { success: boolean; primary: unknown; merged_count: number };
};

export const getPublicCreators = async (params?: {
  search?: string; category?: string; platform?: string; page?: number; limit?: number;
}) => {
  const { data } = await api.get('/influencers/public', { params });
  return data as { data: Influencer[]; total: number; page: number; limit: number };
};

export const exportInfluencersCSV = async (): Promise<void> => {
  const response = await api.get('/influencers/export/csv', { responseType: 'blob' });
  const blob = new Blob([response.data], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `influencers-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportCampaignsCSV = async (): Promise<void> => {
  const response = await api.get('/campaigns/export/csv', { responseType: 'blob' });
  const blob = new Blob([response.data], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `campaigns-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── Import ───────────────────────────────────────────────────────────────────

export const previewImport = async (file: File): Promise<{ filename: string; sheets: ImportPreviewSheet[] }> => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/import/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data;
};

export const processImport = async (
  file: File,
  columnOverrides?: Record<string, string>,
  skipDuplicates?: boolean
): Promise<ImportResult> => {
  const formData = new FormData();
  formData.append('file', file);
  if (columnOverrides) formData.append('columnOverrides', JSON.stringify(columnOverrides));
  if (skipDuplicates !== undefined) formData.append('skipDuplicates', String(skipDuplicates));
  const { data } = await api.post<ImportResult>('/import/process', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data;
};

export const getImportSessions = async () => {
  const { data } = await api.get('/import/sessions');
  return data;
};

// ─── Campaigns ───────────────────────────────────────────────────────────────

export const getCampaigns = async (): Promise<Campaign[]> => {
  const { data } = await api.get<Campaign[]>('/campaigns');
  return data;
};

export const getCampaign = async (id: string): Promise<Campaign> => {
  const { data } = await api.get<Campaign>(`/campaigns/${id}`);
  return data;
};

export const createCampaign = async (campaign: Partial<Campaign>): Promise<Campaign> => {
  const { data } = await api.post<Campaign>('/campaigns', campaign);
  return data;
};

export const updateCampaign = async (id: string, updates: Partial<Campaign>): Promise<Campaign> => {
  const { data } = await api.put<Campaign>(`/campaigns/${id}`, updates);
  return data;
};

export const deleteCampaign = async (id: string): Promise<void> => {
  await api.delete(`/campaigns/${id}`);
};

export const addInfluencerToCampaign = async (
  campaignId: string,
  payload: Partial<CampaignInfluencer>
): Promise<CampaignInfluencer> => {
  const { data } = await api.post<CampaignInfluencer>(`/campaigns/${campaignId}/influencers`, payload);
  return data;
};

export const updateCampaignInfluencer = async (
  campaignId: string,
  ciId: string,
  updates: Partial<CampaignInfluencer>
): Promise<CampaignInfluencer> => {
  const { data } = await api.put<CampaignInfluencer>(`/campaigns/${campaignId}/influencers/${ciId}`, updates);
  return data;
};

export const removeCampaignInfluencer = async (campaignId: string, ciId: string): Promise<void> => {
  await api.delete(`/campaigns/${campaignId}/influencers/${ciId}`);
};

// ─── PDF ─────────────────────────────────────────────────────────────────────

export const downloadCampaignPdf = async (campaignId: string): Promise<void> => {
  const response = await api.post(`/pdf/campaign/${campaignId}`, {}, { responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `proposal-${campaignId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};

export const downloadOfferContract = async (offerId: string): Promise<void> => {
  const response = await api.post(`/pdf/offer/${offerId}`, {}, { responseType: 'blob' });
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `contract-${offerId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── Settings ────────────────────────────────────────────────────────────────

export const getSettings = async (): Promise<Settings> => {
  const { data } = await api.get<Settings>('/settings');
  return data;
};

export const updateSettings = async (settings: Partial<Settings>): Promise<Settings> => {
  const { data } = await api.put<Settings>('/settings', settings);
  return data;
};

export const uploadLogo = async (file: File): Promise<{ logo_url: string }> => {
  const formData = new FormData();
  formData.append('logo', file);
  const { data } = await api.post('/settings/logo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data;
};

export const exportAllData = (): void => {
  window.open('/api/settings/export', '_blank');
};

// ─── Enrichment ───────────────────────────────────────────────────────────────

export const enrichInfluencer = async (id: string) => {
  const { data } = await api.post(`/enrichment/${id}`);
  return data;
};

export const bulkEnrich = async (ids?: string[]) => {
  const { data } = await api.post('/enrichment/bulk/start', { ids });
  return data;
};

export const getEnrichmentStatus = async () => {
  const { data } = await api.get('/enrichment/status');
  return data;
};

// ─── Discovery ────────────────────────────────────────────────────────────────

export const discoverInfluencers = async (
  q: string,
  platform: string,
  limit = 20,
  filters?: {
    country?: string;
    min_followers?: string | number;
    max_followers?: string | number;
    sort_by?: string;
    category?: string;
  }
) => {
  const params: Record<string, unknown> = { q, platform, limit };
  if (filters?.country)       params.country       = filters.country;
  if (filters?.min_followers) params.min_followers = filters.min_followers;
  if (filters?.max_followers) params.max_followers = filters.max_followers;
  if (filters?.sort_by)       params.sort_by       = filters.sort_by;
  if (filters?.category)      params.category      = filters.category;
  const { data } = await api.get('/discover', { params });
  return data as { results: DiscoveredInfluencer[]; error: string | null; query: string };
};

export const importDiscoveredInfluencer = async (platform: string, handle: string) => {
  const { data } = await api.post('/discover/import', { platform, handle });
  return data as { id: string; created: boolean };
};

export const importDiscoveredBulk = async (influencers: { platform: string; handle: string }[]) => {
  const { data } = await api.post('/discover/import-bulk', { influencers });
  return data as { results: Array<{ handle: string; id: string; created: boolean }>; total: number; created: number };
};

export interface DiscoveredInfluencer {
  platform: 'instagram' | 'tiktok';
  handle: string;
  display_name?: string;
  bio?: string;
  followers?: number;
  following?: number;
  posts_count?: number;
  profile_pic?: string;
  profile_url: string;
  is_verified?: boolean;
  already_imported: boolean;
}

// ─── Offers (Agency) ──────────────────────────────────────────────────────────

export const getOffers = async (params?: Record<string, string>) => {
  const { data } = await api.get('/offers', { params });
  return data;
};

export const getOffer = async (id: string) => {
  const { data } = await api.get(`/offers/${id}`);
  return data;
};

export const createOffer = async (offer: Record<string, unknown>) => {
  const { data } = await api.post('/offers', offer);
  return data;
};

export const updateOffer = async (id: string, updates: Record<string, unknown>) => {
  const { data } = await api.put(`/offers/${id}`, updates);
  return data;
};

export interface BulkOfferPayload {
  influencer_ids: string[];
  campaign_id?: string;
  title: string;
  brief?: string;
  platform?: string;
  deliverables?: string;
  rate?: number;
  currency?: string;
  deadline?: string;
  agency_notes?: string;
}

export const counterOffer = async (id: string, payload: {
  counter_rate: number;
  counter_currency?: string;
  counter_notes?: string;
  counter_by: 'influencer' | 'agency';
}) => {
  const { data } = await api.post(`/offers/${id}/counter`, payload);
  return data;
};

export const acceptCounterOffer = async (id: string) => {
  const { data } = await api.post(`/offers/${id}/accept-counter`);
  return data;
};

export const bulkSendOffers = async (payload: BulkOfferPayload) => {
  const { data } = await api.post('/offers/bulk', payload);
  return data as { created: unknown[]; errors: { influencer_id: string; error: string }[]; count: number };
};

export const reviewDeliverable = async (
  offerId: string,
  deliverableId: string,
  payload: { decision: string; feedback?: string; live_url?: string }
) => {
  const { data } = await api.put(`/offers/${offerId}/deliverables/${deliverableId}/review`, payload);
  return data;
};

export const getOfferStats = async (): Promise<Record<string, number>> => {
  const { data } = await api.get('/offers/stats/summary');
  // Backend returns [{status, count}] — normalize to {status: count}
  if (Array.isArray(data)) {
    return data.reduce((acc: Record<string, number>, row: { status: string; count: number }) => {
      acc[row.status] = row.count;
      return acc;
    }, {});
  }
  return data as Record<string, number>;
};

// ─── OAuth / Social Connections ───────────────────────────────────────────────

export interface SocialConnection {
  platform: string;
  platform_username: string | null;
  connected_at: string | null;
  last_synced_at: string | null;
  sync_status: string | null;
}

export const oauthGetAuthUrl = async (platform: string, userId: string): Promise<{ url: string; configured: boolean }> => {
  const { data } = await api.get(`/oauth/${platform}/authorize`, { params: { user_id: userId } });
  return data;
};

export const oauthGetConnections = async (userId: string): Promise<{ connections: SocialConnection[] }> => {
  const { data } = await api.get('/oauth/connections', { params: { user_id: userId } });
  return data;
};

export const oauthDisconnect = async (platform: string, userId: string): Promise<void> => {
  await api.delete(`/oauth/connections/${platform}`, { params: { user_id: userId } });
};

export const oauthSync = async (platform: string, userId: string): Promise<{ ok: boolean; message: string }> => {
  const { data } = await api.post(`/oauth/sync/${platform}`, { user_id: userId });
  return data;
};

export const oauthConfigStatus = async (): Promise<{ status: Record<string, boolean> }> => {
  const { data } = await api.get('/oauth/config-status');
  return data;
};

// ─── Portal (Influencer-facing) ───────────────────────────────────────────────

const PORTAL_TOKEN_KEY = 'cp_portal_token';

function getPortalToken(): string | null {
  return localStorage.getItem(PORTAL_TOKEN_KEY);
}

export function savePortalToken(token: string): void {
  localStorage.setItem(PORTAL_TOKEN_KEY, token);
}

export function clearPortalToken(): void {
  localStorage.removeItem(PORTAL_TOKEN_KEY);
}

const portalApi = axios.create({ baseURL: '/api/portal', timeout: 30000 });
portalApi.interceptors.request.use(cfg => {
  const token = getPortalToken();
  if (token && cfg.headers) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export const portalRegister = async (payload: Record<string, unknown>) => {
  const { data } = await portalApi.post('/auth/register', payload);
  if (data.token) savePortalToken(data.token);
  return data;
};

export const portalLogin = async (email: string, password: string) => {
  const { data } = await portalApi.post('/auth/login', { email, password });
  if (data.token) savePortalToken(data.token);
};

export const portalOAuthStart = async (provider: 'facebook' | 'google', invite_token?: string): Promise<{ url: string; configured: boolean }> => {
  const params = invite_token ? `?invite_token=${encodeURIComponent(invite_token)}` : '';
  const { data } = await portalApi.get(`/auth/oauth/start/${provider}${params}`);
  return data;
};

// Called after OAuth callback redirects back to frontend with ?oauth_token=xxx
export const portalOAuthComplete = (token: string): void => {
  savePortalToken(token);
};

export const portalGetProfile = async () => {
  const { data } = await portalApi.get('/profile');
  return data;
};

export const portalUpdateProfile = async (payload: {
  name?: string; handle?: string; phone?: string; bio?: string; platforms?: string[];
}) => {
  const { data } = await portalApi.put('/profile', payload);
  return data;
};

export const portalGetOffers = async () => {
  const { data } = await portalApi.get('/offers');
  return data;
};

export const portalGetOffer = async (id: string) => {
  const { data } = await portalApi.get(`/offers/${id}`);
  return data;
};

export const portalRespondToOffer = async (id: string, decision: 'accepted' | 'declined', notes?: string) => {
  const { data } = await portalApi.put(`/offers/${id}/respond`, { decision, influencer_notes: notes });
  return data;
};

export const portalSubmitDeliverable = async (offerId: string, payload: {
  content_url?: string;
  caption?: string;
  notes?: string;
  submission_type?: string;
}) => {
  const { data } = await portalApi.post(`/offers/${offerId}/deliverables`, payload);
  return data;
};

export { portalApi };

// ─── Agencies ─────────────────────────────────────────────────────────────────

export interface AdminAgency {
  id: string;
  name: string;
  contact_email: string | null;
  website: string | null;
  country: string | null;
  commission_override_pct: number;
  verified: number;
  subscription_tier: string;
  created_at: string;
  user_count: number;
}

export interface GetAgenciesParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface GetAgenciesResponse {
  agencies: AdminAgency[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export const getAgencies = async (params?: GetAgenciesParams): Promise<GetAgenciesResponse> => {
  const { data } = await api.get<GetAgenciesResponse>('/agencies', { params });
  return data;
};

export const createAgency = async (payload: {
  name: string;
  contact_email?: string;
  website?: string;
  country?: string;
  commission_rate?: number;
}): Promise<{ agency: AdminAgency }> => {
  const { data } = await api.post<{ agency: AdminAgency }>('/agencies', payload);
  return data;
};

export const updateAgency = async (
  id: string,
  updates: Partial<{ name: string; contact_email: string; website: string; country: string; commission_rate: number; verified: boolean; subscription_tier: string }>
): Promise<{ agency: AdminAgency }> => {
  const { data } = await api.put<{ agency: AdminAgency }>(`/agencies/${id}`, updates);
  return data;
};

export const deleteAgency = async (id: string): Promise<void> => {
  await api.delete(`/agencies/${id}`);
};

// ─── Brands ───────────────────────────────────────────────────────────────────

export interface AdminBrand {
  id: string;
  name: string;
  industry: string | null;
  contact_email: string | null;
  website: string | null;
  country: string | null;
  budget_range: string | null;
  logo_url: string | null;
  created_at: string;
}

export interface GetBrandsParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface GetBrandsResponse {
  brands: AdminBrand[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export const getBrands = async (params?: GetBrandsParams): Promise<GetBrandsResponse> => {
  const { data } = await api.get<GetBrandsResponse>('/brands', { params });
  return data;
};

export const createBrand = async (payload: {
  name: string;
  industry?: string;
  contact_email?: string;
  website?: string;
  country?: string;
  budget_range?: string;
}): Promise<{ brand: AdminBrand }> => {
  const { data } = await api.post<{ brand: AdminBrand }>('/brands', payload);
  return data;
};

export const updateBrand = async (
  id: string,
  updates: Partial<{ name: string; industry: string; contact_email: string; website: string; country: string; budget_range: string }>
): Promise<{ brand: AdminBrand }> => {
  const { data } = await api.put<{ brand: AdminBrand }>(`/brands/${id}`, updates);
  return data;
};

export const deleteBrand = async (id: string): Promise<void> => {
  await api.delete(`/brands/${id}`);
};

// ─── Campaign Stats ────────────────────────────────────────────────────────────

export interface CampaignStats {
  influencer_count: number;
  total_budget: number;
  total_spent: number;
  currency: string;
  offers_by_status: Record<string, number>;
  total_followers_reach: number;
  deliverables_count: number;
  deliverables_approved: number;
}

export const getCampaignStats = async (id: string): Promise<CampaignStats> => {
  const { data } = await api.get<CampaignStats>(`/campaigns/${id}/stats`);
  return data;
};

// ─── Campaign Notes ───────────────────────────────────────────────────────────

export interface CampaignNote {
  id: string;
  campaign_id: string;
  author: string;
  content: string;
  created_at: string;
}

export const getCampaignNotes = async (campaignId: string): Promise<CampaignNote[]> => {
  const { data } = await api.get(`/campaigns/${campaignId}/notes`);
  return data;
};

export const addCampaignNote = async (campaignId: string, content: string, author?: string): Promise<CampaignNote> => {
  const { data } = await api.post(`/campaigns/${campaignId}/notes`, { content, author });
  return data;
};

export const deleteCampaignNote = async (campaignId: string, noteId: string): Promise<void> => {
  await api.delete(`/campaigns/${campaignId}/notes/${noteId}`);
};

// ─── Campaign Timeline ─────────────────────────────────────────────────────────

export interface TimelineEvent {
  type: string;
  label: string;
  sub: string;
  ts: string;
}

export const getCampaignTimeline = async (campaignId: string): Promise<TimelineEvent[]> => {
  const { data } = await api.get(`/campaigns/${campaignId}/timeline`);
  return data;
};

// ─── Analytics ────────────────────────────────────────────────────────────────

export const getAnalyticsOverview = async () => {
  const { data } = await api.get('/analytics/overview');
  return data;
};

export const getAnalyticsGrowth = async () => {
  const { data } = await api.get('/analytics/growth');
  return data;
};

// ─── Payments ─────────────────────────────────────────────────────────────────

export interface PaymentOffer {
  id: string;
  title: string;
  rate: number;
  currency: string;
  status: string;
  payment_status: 'paid' | 'unpaid';
  paid_at?: string;
  payment_reference?: string;
  payment_notes?: string;
  created_at: string;
  campaign_name?: string;
  influencer_name?: string;
  ig_handle?: string;
  tiktok_handle?: string;
}

export interface PaymentSummary {
  total_earned: number;
  total_paid: number;
  total_unpaid: number;
  count_paid: number;
  count_unpaid: number;
}

export const getPayments = async (params?: {
  payment_status?: string;
  campaign_id?: string;
  page?: number;
  limit?: number;
}) => {
  const { data } = await api.get('/payments', { params });
  return data as { data: PaymentOffer[]; total: number; page: number; limit: number };
};

export const getPaymentSummary = async () => {
  const { data } = await api.get<PaymentSummary>('/payments/summary');
  return data;
};

export const markPaymentPaid = async (
  id: string,
  body?: { payment_reference?: string; payment_notes?: string }
) => {
  const { data } = await api.put(`/payments/${id}/mark-paid`, body || {});
  return data;
};

export const markPaymentUnpaid = async (id: string) => {
  const { data } = await api.put(`/payments/${id}/mark-unpaid`, {});
  return data;
};

// ─── Offer Templates ─────────────────────────────────────────────────────────

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

export const getOfferTemplates = async () => {
  const { data } = await api.get<OfferTemplate[]>('/offer-templates');
  return data;
};

export const createOfferTemplate = async (body: Omit<OfferTemplate, 'id' | 'created_at'>) => {
  const { data } = await api.post<OfferTemplate>('/offer-templates', body);
  return data;
};

export const deleteOfferTemplate = async (id: string) => {
  const { data } = await api.delete(`/offer-templates/${id}`);
  return data;
};

// ─── Billing ──────────────────────────────────────────────────────────────────

export interface BillingStatus {
  plan: string;
  status: string;
  period_end: string | null;
  has_customer: boolean;
}

export const getBillingStatus = async (): Promise<BillingStatus> => {
  const { data } = await api.get<BillingStatus>('/billing/status');
  return data;
};

export const createCheckoutSession = async (plan: 'starter' | 'pro' | 'enterprise'): Promise<{ url: string }> => {
  const { data } = await api.post<{ url: string }>('/billing/create-checkout', { plan });
  return data;
};

export const openBillingPortal = async (): Promise<{ url: string }> => {
  const { data } = await api.post<{ url: string }>('/billing/portal');
  return data;
};

// ─── Fan Access API ────────────────────────────────────────────────────────────

export const fanApi = axios.create({ baseURL: '/api/fan', timeout: 30000 });
fanApi.interceptors.request.use(config => {
  const token = localStorage.getItem('cp_fan_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const fanRegister = async (payload: { email: string; password: string; name?: string; username?: string }) => {
  const { data } = await fanApi.post('/auth/register', payload);
  if (data.token) localStorage.setItem('cp_fan_token', data.token);
  if (data.user) localStorage.setItem('cp_fan_user', JSON.stringify(data.user));
  return data;
};

export const fanLogin = async (email: string, password: string) => {
  const { data } = await fanApi.post('/auth/login', { email, password });
  if (data.token) localStorage.setItem('cp_fan_token', data.token);
  if (data.user) localStorage.setItem('cp_fan_user', JSON.stringify(data.user));
  return data;
};

export const fanLogout = () => {
  localStorage.removeItem('cp_fan_token');
  localStorage.removeItem('cp_fan_user');
};

export const fanGetMe = async () => { const { data } = await fanApi.get('/auth/me'); return data; };
export const fanUpdateMe = async (payload: Record<string, unknown>) => { const { data } = await fanApi.put('/auth/me', payload); return data; };

export const fanGetInfluencers = async (params?: Record<string, unknown>) => {
  const { data } = await fanApi.get('/influencers', { params });
  return data;
};

export const fanGetInfluencer = async (id: string) => {
  const { data } = await fanApi.get(`/influencers/${id}`);
  return data;
};

export const fanGetRequests = async () => { const { data } = await fanApi.get('/requests'); return data; };
export const fanGetRequest = async (id: string) => { const { data } = await fanApi.get(`/requests/${id}`); return data; };

export const fanSubmitRequest = async (payload: {
  influencer_id: string; request_type: string; title: string;
  message?: string; budget?: number; currency?: string; platform?: string; deadline?: string;
}) => {
  const { data } = await fanApi.post('/requests', payload);
  return data;
};

export const fanCancelRequest = async (id: string) => {
  const { data } = await fanApi.put(`/requests/${id}/cancel`);
  return data;
};

export const fanGetRequestTypes = async () => { const { data } = await fanApi.get('/request-types'); return data; };

// Portal fan-request management (influencer side)
export const portalGetFanRequests = async (status?: string) => {
  const { data } = await portalApi.get('/fan-requests', { params: status ? { status } : undefined });
  return data;
};
export const portalRespondToFanRequest = async (id: string, payload: {
  decision: 'accepted' | 'declined' | 'fulfilled';
  influencer_note?: string; delivery_url?: string; delivery_note?: string;
}) => {
  const { data } = await portalApi.put(`/fan-requests/${id}/respond`, payload);
  return data;
};
export const portalGetFanSettings = async () => { const { data } = await portalApi.get('/fan-settings'); return data; };
export const portalUpdateFanSettings = async (payload: Record<string, unknown>) => {
  const { data } = await portalApi.put('/fan-settings', payload);
  return data;
};

// ── Revenue (platform monetisation) ───────────────────────────────────────────
export const getRevenueSummary = async () => {
  const { data } = await api.get('/revenue/summary');
  return data;
};
export const getRevenueCommissions = async (params?: Record<string, unknown>) => {
  const { data } = await api.get('/revenue/commissions', { params });
  return data;
};
export const collectCommission = async (id: string) => {
  const { data } = await api.put(`/revenue/commissions/${id}/collect`);
  return data;
};
export const getRevenueSettings = async () => {
  const { data } = await api.get('/revenue/settings');
  return data;
};
export const updateRevenueSettings = async (payload: Record<string, unknown>) => {
  const { data } = await api.put('/revenue/settings', payload);
  return data;
};
export const getRevenueBreakdown = async () => {
  const { data } = await api.get('/revenue/offer-breakdown');
  return data;
};

// ── Loyalty programme ──────────────────────────────────────────────────────────
export const getMyLoyalty = async () => {
  const { data } = await api.get('/loyalty/me');
  return data;
};
export const getLoyaltyHistory = async () => {
  const { data } = await api.get('/loyalty/history');
  return data;
};
export const getLoyaltyLeaderboard = async (userType = 'influencer') => {
  const { data } = await api.get('/loyalty/leaderboard', { params: { user_type: userType } });
  return data;
};
export const getLoyaltyAll = async () => {
  const { data } = await api.get('/loyalty/all');
  return data;
};
export const awardLoyaltyPoints = async (payload: {
  user_type: string; user_id: string; action: string; points: number; note?: string;
}) => {
  const { data } = await api.post('/loyalty/award', payload);
  return data;
};

// Portal loyalty — hits /api/loyalty/* with the portal token (not /api/portal/loyalty)
const loyaltyPortalApi = axios.create({ baseURL: '/api', timeout: 30000 });
loyaltyPortalApi.interceptors.request.use(config => {
  const token = localStorage.getItem('cp_portal_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
export const portalGetMyLoyalty = async () => {
  const { data } = await loyaltyPortalApi.get('/loyalty/me');
  return data;
};
export const portalGetLoyaltyHistory = async () => {
  const { data } = await loyaltyPortalApi.get('/loyalty/history');
  return data;
};

export default api;
