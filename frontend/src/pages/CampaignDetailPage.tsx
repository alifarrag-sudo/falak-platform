import { useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, Download, Edit2, Save, X, Search, Users, Send, BarChart2, SendHorizonal, MessageSquare, GitBranch, CheckCircle2, XCircle, Clock, Star, FileText, Instagram, Music2, CheckCircle, ExternalLink, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getCampaign, updateCampaign, removeCampaignInfluencer,
  updateCampaignInfluencer, getInfluencers, addInfluencerToCampaign,
  downloadCampaignPdf, getCampaignStats, bulkSendOffers,
  getCampaignNotes, addCampaignNote, deleteCampaignNote, getCampaignTimeline,
  discoverInfluencers, importDiscoveredInfluencer, importDiscoveredBulk,
} from '../utils/api';
import type { CampaignStats, BulkOfferPayload, CampaignNote, TimelineEvent, DiscoveredInfluencer } from '../utils/api';
import type { CampaignInfluencer } from '../types';
import Avatar from '../components/ui/Avatar';
import PlatformBadge from '../components/ui/PlatformBadge';
import Modal from '../components/ui/Modal';
import SendOfferModal from '../components/offers/SendOfferModal';
import { formatRate, formatDate, getDisplayName, cn } from '../utils/helpers';

const DISCOVER_PLATFORMS = [
  { value: 'all',       label: 'All Platforms' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok',    label: 'TikTok' },
  { value: 'youtube',   label: 'YouTube' },
  { value: 'snapchat',  label: 'Snapchat' },
  { value: 'twitter',   label: 'Twitter / X' },
  { value: 'facebook',  label: 'Facebook' },
];
const DISCOVER_CATEGORIES = [
  'Food','Lifestyle','Fashion','Beauty','Tech','Travel','Fitness','Comedy','Gaming',
  'Parenting','Business','Art','Music','Sports','Health','Education','Entertainment',
  'DIY & Crafts','Pets','Finance','Luxury','Cars','Photography','Dance','Motivation',
  'News & Politics','Real Estate','Cooking','Skincare','Hair & Makeup',
];
const DISCOVER_COUNTRIES = [
  // MENA
  'Egypt','Saudi Arabia','UAE','Kuwait','Qatar','Bahrain','Oman','Jordan','Lebanon',
  'Morocco','Tunisia','Algeria','Libya','Iraq','Sudan','Yemen','Palestine','Syria',
  // Europe
  'UK','France','Germany','Spain','Italy','Netherlands','Sweden','Belgium',
  'Switzerland','Poland','Portugal','Greece','Turkey','Denmark','Norway','Finland',
  // Americas
  'US','Canada','Brazil','Mexico','Argentina','Colombia','Chile','Peru','Venezuela',
  // Asia-Pacific
  'India','Pakistan','Indonesia','Malaysia','Singapore','Philippines','Thailand',
  'Vietnam','South Korea','Japan','China','Australia','New Zealand','Bangladesh',
  // Africa
  'Nigeria','South Africa','Kenya','Ghana','Tanzania','Ethiopia','Ivory Coast','Senegal',
  // Global
  'Global / Worldwide','Other',
];

function DiscoverPlatformIcon({ platform }: { platform: string }) {
  if (platform === 'instagram') return <Instagram className="w-3 h-3" />;
  if (platform === 'tiktok') return <Music2 className="w-3 h-3" />;
  return null;
}

function formatFollowers(n?: number): string {
  if (!n) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

function formatReach(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-gray-500',
  sent:       'bg-blue-500',
  accepted:   'bg-green-500',
  declined:   'bg-red-500',
  in_progress:'bg-amber-500',
  submitted:  'bg-purple-500',
  completed:  'bg-emerald-500',
};

function AnalyticsTab({ stats, budgetFromCampaign }: { stats: CampaignStats; budgetFromCampaign: number }) {
  const budget = budgetFromCampaign || stats.total_budget;
  const spent = stats.total_spent;
  const remaining = budget - spent;
  const spentPct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;

  const totalOffers = Object.values(stats.offers_by_status).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Budget vs Spend */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Budget vs Spend</h3>
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Spent</p>
            <p className="text-xl font-bold text-white">{formatRate(spent)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-0.5">Budget</p>
            <p className="text-xl font-bold text-gray-300">{formatRate(budget)}</p>
          </div>
        </div>
        <div className="h-3 rounded-full bg-surface-overlay overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', spent > budget ? 'bg-red-500' : 'bg-blue-500')}
            style={{ width: `${spentPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-gray-500">{spentPct.toFixed(0)}% used</p>
          <p className={cn('text-xs font-medium', remaining >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {remaining >= 0 ? `${formatRate(remaining)} remaining` : `${formatRate(Math.abs(remaining))} over budget`}
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-xs text-gray-500 mb-1">Influencers</p>
          <p className="text-3xl font-bold text-white">{stats.influencer_count}</p>
          <p className="text-xs text-gray-500 mt-1">in campaign</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-gray-500 mb-1">Total Reach</p>
          <p className="text-3xl font-bold text-white">{formatReach(stats.total_followers_reach)}</p>
          <p className="text-xs text-gray-500 mt-1">combined followers</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-gray-500 mb-1">Deliverables</p>
          <p className="text-3xl font-bold text-white">
            {stats.deliverables_approved}
            <span className="text-lg font-normal text-gray-500"> / {stats.deliverables_count}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">approved</p>
        </div>
      </div>

      {/* Offer status breakdown */}
      {totalOffers > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Offer Status Breakdown</h3>
          <div className="space-y-2.5">
            {Object.entries(stats.offers_by_status).map(([status, count]) => (
              <div key={status} className="flex items-center gap-3">
                <span className={cn('w-2 h-2 rounded-full shrink-0', STATUS_COLORS[status] ?? 'bg-gray-500')} />
                <span className="text-sm text-gray-300 capitalize w-28">{status.replace('_', ' ')}</span>
                <div className="flex-1 h-1.5 rounded-full bg-surface-overlay overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', STATUS_COLORS[status] ?? 'bg-gray-500')}
                    style={{ width: `${(count / totalOffers) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-white w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deliverables progress */}
      {stats.deliverables_count > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Deliverables Progress</h3>
          <p className="text-sm text-gray-400 mb-2">
            {stats.deliverables_approved} of {stats.deliverables_count} deliverables approved
          </p>
          <div className="h-2 rounded-full bg-surface-overlay overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${(stats.deliverables_approved / stats.deliverables_count) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="card p-5 space-y-3">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-3 w-full rounded-full" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="card p-5 space-y-2">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="card p-5 space-y-3">
        <div className="skeleton h-4 w-40" />
        {[0, 1, 2].map(i => <div key={i} className="skeleton h-3 w-full" />)}
      </div>
    </div>
  );
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showAddInfluencer, setShowAddInfluencer] = useState(false);
  const [addModalTab, setAddModalTab] = useState<'database' | 'discover'>('database');
  const [influencerSearch, setInfluencerSearch] = useState('');
  const [dbSelected, setDbSelected] = useState<Set<string>>(new Set());
  const [discoverQuery, setDiscoverQuery] = useState('');
  const [discoverPlatform, setDiscoverPlatform] = useState('all');
  const [discoverCountry, setDiscoverCountry] = useState('');
  const [discoverMinFoll, setDiscoverMinFoll] = useState('');
  const [discoverMaxFoll, setDiscoverMaxFoll] = useState('');
  const [discoverSortBy, setDiscoverSortBy] = useState('followers_desc');
  const [discoverSelected, setDiscoverSelected] = useState<Set<string>>(new Set());
  const [discoverHasSearched, setDiscoverHasSearched] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Record<string, unknown>>({});
  const [pdfLoading, setPdfLoading] = useState(false);
  const [sendOfferTarget, setSendOfferTarget] = useState<{ influencerId: string; influencerName: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'influencers' | 'analytics' | 'notes' | 'timeline'>('influencers');
  const [showBulkSend, setShowBulkSend] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [bulkForm, setBulkForm] = useState<Partial<BulkOfferPayload>>({});
  const [bulkSending, setBulkSending] = useState(false);

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => getCampaign(id!),
    enabled: !!id,
  });

  const { data: searchResults } = useQuery({
    queryKey: ['influencer-search', influencerSearch],
    queryFn: () => getInfluencers({ search: influencerSearch, page: 1, limit: 20 }),
    enabled: influencerSearch.length >= 2 && showAddInfluencer,
  });

  const { data: discoverData, isFetching: discoverFetching, refetch: refetchDiscover } = useQuery({
    queryKey: ['campaign-discover', discoverQuery, discoverPlatform, discoverCountry, discoverMinFoll, discoverMaxFoll, discoverSortBy],
    queryFn: () => discoverInfluencers(discoverQuery, discoverPlatform, 20, {
      country: discoverCountry || undefined,
      min_followers: discoverMinFoll || undefined,
      max_followers: discoverMaxFoll || undefined,
      sort_by: discoverSortBy,
    }),
    enabled: false,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['campaign-stats', id],
    queryFn: () => getCampaignStats(id!),
    enabled: !!id && activeTab === 'analytics',
  });

  const { data: notes, refetch: refetchNotes } = useQuery({
    queryKey: ['campaign-notes', id],
    queryFn: () => getCampaignNotes(id!),
    enabled: !!id,
  });

  const { data: timeline, isLoading: timelineLoading } = useQuery({
    queryKey: ['campaign-timeline', id],
    queryFn: () => getCampaignTimeline(id!),
    enabled: !!id && activeTab === 'timeline',
    staleTime: 30000,
  });

  const updateMutation = useMutation({
    mutationFn: (updates: Record<string, unknown>) => updateCampaign(id!, updates as never),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign', id] });
      setEditMode(false);
      toast.success('Saved');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (ciId: string) => removeCampaignInfluencer(id!, ciId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign', id] });
      toast.success('Removed');
    },
  });

  const updateCIMutation = useMutation({
    mutationFn: ({ ciId, updates }: { ciId: string; updates: Partial<CampaignInfluencer> }) =>
      updateCampaignInfluencer(id!, ciId, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign', id] }),
  });

  const addMutation = useMutation({
    mutationFn: (influencerId: string) => addInfluencerToCampaign(id!, {
      influencer_id: influencerId,
      num_posts: 1,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign', id] });
      toast.success('Added to campaign');
    },
  });

  const bulkAddDbMutation = useMutation({
    mutationFn: (ids: string[]) =>
      Promise.all(ids.map(influencer_id => addInfluencerToCampaign(id!, { influencer_id, num_posts: 1 }))),
    onSuccess: (_, ids) => {
      qc.invalidateQueries({ queryKey: ['campaign', id] });
      setDbSelected(new Set());
      toast.success(`${ids.length} influencer${ids.length !== 1 ? 's' : ''} added`);
    },
  });

  const importAndAddMutation = useMutation({
    mutationFn: async (item: { platform: string; handle: string }) => {
      const imported = await importDiscoveredInfluencer(item.platform, item.handle);
      await addInfluencerToCampaign(id!, { influencer_id: imported.id, num_posts: 1 });
      return imported;
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['campaign', id] });
      qc.invalidateQueries({ queryKey: ['campaign-discover'] });
      toast.success(result.created ? 'Imported & added to campaign' : 'Added to campaign');
    },
    onError: () => toast.error('Failed to add influencer'),
  });

  const bulkImportAddMutation = useMutation({
    mutationFn: async (items: { platform: string; handle: string }[]) => {
      const bulkResult = await importDiscoveredBulk(items);
      await Promise.all(bulkResult.results.map(r =>
        addInfluencerToCampaign(id!, { influencer_id: r.id, num_posts: 1 })
      ));
      return bulkResult;
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['campaign', id] });
      qc.invalidateQueries({ queryKey: ['campaign-discover'] });
      setDiscoverSelected(new Set());
      toast.success(`${result.total} influencer${result.total !== 1 ? 's' : ''} added to campaign`);
    },
    onError: () => toast.error('Bulk add failed'),
  });

  const handleDiscoverSearch = useCallback(async () => {
    if (discoverQuery.trim().length < 2) { toast.error('Enter at least 2 characters'); return; }
    setDiscoverHasSearched(true);
    await refetchDiscover();
  }, [discoverQuery, refetchDiscover]);

  const handleCloseAddModal = () => {
    setShowAddInfluencer(false);
    setAddModalTab('database');
    setDbSelected(new Set());
    setDiscoverSelected(new Set());
    setDiscoverHasSearched(false);
  };

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      await downloadCampaignPdf(id!);
      toast.success('PDF downloaded');
    } catch {
      toast.error('PDF generation failed');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleBulkSend = async () => {
    if (!bulkForm.title) { toast.error('Title is required'); return; }
    const influencer_ids = (campaign?.influencers || []).map(ci => ci.influencer_id);
    if (influencer_ids.length === 0) { toast.error('No influencers in campaign'); return; }
    setBulkSending(true);
    try {
      const result = await bulkSendOffers({ ...bulkForm as BulkOfferPayload, influencer_ids, campaign_id: id });
      toast.success(`${result.count} offers sent!`);
      if (result.errors.length > 0) toast.error(`${result.errors.length} failed`);
      setShowBulkSend(false);
      setBulkForm({});
    } catch {
      toast.error('Failed to send offers');
    } finally {
      setBulkSending(false);
    }
  };

  if (isLoading) return (
    <div className="max-w-5xl mx-auto">
      <div className="skeleton h-8 w-32 mb-6" />
      <div className="card p-6 space-y-3">
        <div className="skeleton h-7 w-64" />
        <div className="skeleton h-4 w-40" />
      </div>
    </div>
  );

  if (!campaign) return <div className="text-gray-400">Campaign not found</div>;

  const influencers = campaign.influencers || [];
  const totalCost = influencers.reduce((sum, ci) => sum + (Number(ci.rate) || 0), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/campaigns')} className="btn-ghost btn-sm">
          <ArrowLeft className="w-4 h-4" /> Campaigns
        </button>
        <div className="flex gap-2">
          <button onClick={() => setShowAddInfluencer(true)} className="btn-secondary btn-sm">
            <Plus className="w-4 h-4" /> Add Influencer
          </button>
          {influencers.length > 0 && (
            <button onClick={() => setShowBulkSend(true)} className="btn-secondary btn-sm">
              <SendHorizonal className="w-4 h-4" /> Send to All ({influencers.length})
            </button>
          )}
          <Link to={`/campaigns/${id}/report`} className="btn-secondary btn-sm">
            <FileText className="w-4 h-4" /> Report
          </Link>
          <button onClick={handleDownloadPdf} disabled={pdfLoading} className="btn-secondary btn-sm">
            <Download className={cn('w-4 h-4', pdfLoading && 'animate-bounce')} />
            {pdfLoading ? 'Generating...' : 'PDF'}
          </button>
          {editMode ? (
            <>
              <button onClick={() => setEditMode(false)} className="btn-secondary btn-sm"><X className="w-4 h-4" /></button>
              <button onClick={() => updateMutation.mutate(editData)} className="btn-primary btn-sm">
                <Save className="w-4 h-4" /> Save
              </button>
            </>
          ) : (
            <button onClick={() => setEditMode(true)} className="btn-primary btn-sm">
              <Edit2 className="w-4 h-4" /> Edit
            </button>
          )}
        </div>
      </div>

      {/* Campaign header */}
      <div className="card p-6">
        {editMode ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="label">Campaign Name</label>
              <input className="input" defaultValue={campaign.name}
                onChange={e => setEditData(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" defaultValue={campaign.status}
                onChange={e => setEditData(p => ({ ...p, status: e.target.value }))}>
                {['draft', 'sent', 'approved', 'active', 'completed'].map(s =>
                  <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Client</label>
              <input className="input" defaultValue={campaign.client_name || ''}
                onChange={e => setEditData(p => ({ ...p, client_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Budget</label>
              <input type="number" className="input" defaultValue={campaign.budget || ''}
                onChange={e => setEditData(p => ({ ...p, budget: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Platform</label>
              <input className="input" defaultValue={campaign.platform_focus || ''}
                onChange={e => setEditData(p => ({ ...p, platform_focus: e.target.value }))} />
            </div>
            <div className="col-span-3">
              <label className="label">Brief</label>
              <textarea className="input h-20 resize-none" defaultValue={campaign.brief || ''}
                onChange={e => setEditData(p => ({ ...p, brief: e.target.value }))} />
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-white">{campaign.name}</h1>
                <span className={cn('badge',
                  campaign.status === 'active' ? 'badge-green' :
                    campaign.status === 'completed' ? 'badge-purple' :
                      campaign.status === 'approved' ? 'badge-blue' : 'badge-gray'
                )}>
                  {campaign.status}
                </span>
              </div>
              {campaign.client_name && <p className="text-gray-400">{campaign.client_name}</p>}
              {campaign.platform_focus && <span className="badge badge-blue mt-1">{campaign.platform_focus}</span>}
              {campaign.brief && <p className="text-sm text-gray-400 mt-3 max-w-2xl">{campaign.brief}</p>}
            </div>
            <div className="text-right shrink-0">
              <div className="text-3xl font-bold text-white">{formatRate(totalCost)}</div>
              <div className="text-sm text-gray-500">total cost</div>
              {campaign.budget && (
                <div className="text-sm text-gray-500 mt-1">
                  Budget: {formatRate(campaign.budget)}
                  <span className={cn('ml-1', totalCost > campaign.budget ? 'text-red-400' : 'text-emerald-400')}>
                    ({totalCost > campaign.budget ? 'over' : 'under'} by {formatRate(Math.abs(totalCost - campaign.budget))})
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-surface-border">
        <button
          onClick={() => setActiveTab('influencers')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'influencers'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          )}
        >
          <Users className="w-4 h-4" />
          Influencers
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'analytics'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          )}
        >
          <BarChart2 className="w-4 h-4" />
          Analytics
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'notes'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          )}
        >
          <MessageSquare className="w-4 h-4" />
          Notes {notes && notes.length > 0 && <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded-full">{notes.length}</span>}
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'timeline'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          )}
        >
          <GitBranch className="w-4 h-4" />
          Timeline
        </button>
      </div>

      {/* Analytics tab */}
      {activeTab === 'analytics' && (
        statsLoading
          ? <AnalyticsSkeleton />
          : stats
            ? <AnalyticsTab stats={stats} budgetFromCampaign={campaign.budget || 0} />
            : <p className="text-sm text-gray-400 py-8 text-center">No stats available yet.</p>
      )}

      {/* Notes tab */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          {/* Add note */}
          <div className="card p-4 space-y-3">
            <textarea
              className="input resize-none h-20 text-sm"
              placeholder="Add an internal note about this campaign..."
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
            />
            <div className="flex justify-end">
              <button
                className="btn-primary btn-sm"
                disabled={!newNote.trim() || addingNote}
                onClick={async () => {
                  if (!newNote.trim()) return;
                  setAddingNote(true);
                  try {
                    await addCampaignNote(id!, newNote.trim());
                    setNewNote('');
                    refetchNotes();
                  } catch {
                    toast.error('Failed to add note');
                  } finally {
                    setAddingNote(false);
                  }
                }}
              >
                {addingNote ? 'Adding...' : 'Add Note'}
              </button>
            </div>
          </div>

          {/* Notes list */}
          {!notes || notes.length === 0 ? (
            <div className="card p-8 text-center">
              <MessageSquare className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No notes yet. Add the first one above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(notes as CampaignNote[]).map(note => (
                <div key={note.id} className="card p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white shrink-0">
                    {note.author[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-gray-300">{note.author}</p>
                      <p className="text-xs text-gray-600">{formatDate(note.created_at)}</p>
                    </div>
                    <p className="text-sm text-gray-200 whitespace-pre-wrap">{note.content}</p>
                  </div>
                  <button
                    onClick={async () => {
                      await deleteCampaignNote(id!, note.id);
                      refetchNotes();
                    }}
                    className="btn-ghost btn-sm p-1 text-gray-600 hover:text-red-400"
                    title="Delete note"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Timeline tab */}
      {activeTab === 'timeline' && (
        <div className="space-y-1">
          {timelineLoading ? (
            <div className="card p-8 text-center text-sm text-gray-500">Loading timeline...</div>
          ) : !timeline || timeline.length === 0 ? (
            <div className="card p-8 text-center">
              <GitBranch className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No events yet. Events appear as the campaign progresses.</p>
            </div>
          ) : (
            <div className="relative pl-6">
              {/* Vertical line */}
              <div className="absolute left-2 top-2 bottom-2 w-px bg-surface-border" />
              {(timeline as TimelineEvent[]).map((ev, i) => {
                const iconMap: Record<string, { icon: React.ElementType; color: string }> = {
                  campaign_created:      { icon: Star,          color: 'text-blue-400' },
                  campaign_start:        { icon: Clock,         color: 'text-emerald-400' },
                  campaign_end:          { icon: Clock,         color: 'text-gray-400' },
                  influencer_added:      { icon: Users,         color: 'text-purple-400' },
                  offer_sent:            { icon: Send,          color: 'text-blue-400' },
                  offer_accepted:        { icon: CheckCircle2,  color: 'text-emerald-400' },
                  offer_declined:        { icon: XCircle,       color: 'text-red-400' },
                  offer_completed:       { icon: CheckCircle2,  color: 'text-emerald-500' },
                  deliverable_submitted: { icon: FileText,      color: 'text-amber-400' },
                  deliverable_approved:  { icon: CheckCircle2,  color: 'text-emerald-400' },
                  revision_requested:    { icon: GitBranch,     color: 'text-orange-400' },
                  note_added:            { icon: MessageSquare, color: 'text-gray-400' },
                };
                const { icon: EvIcon, color } = iconMap[ev.type] || { icon: Clock, color: 'text-gray-400' };
                return (
                  <div key={i} className="relative flex items-start gap-3 pb-5">
                    {/* Dot on line */}
                    <div className={cn('absolute -left-4 w-5 h-5 rounded-full bg-[#1a1a1a] border border-surface-border flex items-center justify-center shrink-0', color)}>
                      <EvIcon className="w-2.5 h-2.5" />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-sm text-white">{ev.label}</p>
                      {ev.sub && <p className="text-xs text-gray-500 mt-0.5 truncate">{ev.sub}</p>}
                      <p className="text-[10px] text-gray-600 mt-1">{formatDate(ev.ts)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Influencer list */}
      {activeTab === 'influencers' && (
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-surface-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-300">Influencers ({influencers.length})</h2>
        </div>

        {influencers.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-400 mb-4">No influencers added yet</p>
            <button onClick={() => setShowAddInfluencer(true)} className="btn-primary btn-sm">
              <Plus className="w-4 h-4" /> Add Influencers
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border bg-surface-overlay/40">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 w-64">Influencer</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500">Platform</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 w-20">Posts</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500">Deliverables</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 w-32">Rate</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500">Notes</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/50">
              {influencers.map((ci: CampaignInfluencer) => (
                <tr key={ci.id} className="hover:bg-surface-overlay/60">
                  <td className="px-5 py-3">
                    <Link to={`/influencers/${ci.influencer_id}`} className="flex items-center gap-2.5 hover:text-white group">
                      <Avatar src={ci.profile_photo_url} name={getDisplayName(ci)} size="sm" />
                      <div>
                        <p className="font-medium text-gray-200 group-hover:text-white transition-colors">{ci.name_english || ci.name_arabic}</p>
                        {ci.main_category && <p className="text-xs text-gray-500">{ci.main_category}</p>}
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className="input text-xs py-1"
                      value={ci.platform || ''}
                      onChange={e => updateCIMutation.mutate({ ciId: ci.id, updates: { platform: e.target.value } })}
                    >
                      <option value="">Select...</option>
                      <option>Instagram</option>
                      <option>TikTok</option>
                      <option>Snapchat</option>
                      <option>Facebook</option>
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      className="input text-xs py-1 w-16"
                      value={ci.num_posts || 1}
                      min={1}
                      onChange={e => updateCIMutation.mutate({ ciId: ci.id, updates: { num_posts: Number(e.target.value) } })}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      className="input text-xs py-1"
                      value={ci.deliverables || ''}
                      placeholder="e.g. 1 Reel + 3 Stories"
                      onChange={e => updateCIMutation.mutate({ ciId: ci.id, updates: { deliverables: e.target.value } })}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      className="input text-xs py-1 w-28"
                      value={ci.rate || ''}
                      placeholder="Rate"
                      onChange={e => updateCIMutation.mutate({ ciId: ci.id, updates: { rate: Number(e.target.value) } })}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      className="input text-xs py-1"
                      value={ci.notes || ''}
                      placeholder="Notes"
                      onChange={e => updateCIMutation.mutate({ ciId: ci.id, updates: { notes: e.target.value } })}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSendOfferTarget({
                          influencerId: ci.influencer_id,
                          influencerName: ci.name_english || ci.name_arabic || 'Influencer',
                        })}
                        className="btn-ghost btn-sm text-blue-400 hover:bg-blue-900/20 p-1"
                        title="Send Offer"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeMutation.mutate(ci.id)}
                        className="btn-ghost btn-sm text-red-400 hover:bg-red-900/20 p-1"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-surface-border bg-surface-overlay/40">
                <td colSpan={4} className="px-5 py-3 text-sm font-semibold text-gray-300">Total</td>
                <td className="px-3 py-3 text-base font-bold text-white">{formatRate(totalCost)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
      )}

      {/* Send Offer Modal */}
      <SendOfferModal
        open={!!sendOfferTarget}
        onClose={() => setSendOfferTarget(null)}
        influencerId={sendOfferTarget?.influencerId}
        influencerName={sendOfferTarget?.influencerName}
        campaignId={id}
      />

      {/* Bulk Send Offer Modal */}
      <Modal open={showBulkSend} onClose={() => setShowBulkSend(false)} title={`Send Offer to All ${influencers.length} Influencers`} size="lg">
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-400">This will send one offer to each influencer in this campaign.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Offer Title *</label>
              <input className="input" placeholder="e.g. Ramadan Campaign 2025"
                value={bulkForm.title || ''}
                onChange={e => setBulkForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label className="label">Platform</label>
              <select className="input" value={bulkForm.platform || ''}
                onChange={e => setBulkForm(p => ({ ...p, platform: e.target.value }))}>
                <option value="">Any</option>
                <option>Instagram</option>
                <option>TikTok</option>
                <option>Snapchat</option>
                <option>YouTube</option>
                <option>Twitter</option>
              </select>
            </div>
            <div>
              <label className="label">Deadline</label>
              <input type="date" className="input" value={bulkForm.deadline || ''}
                onChange={e => setBulkForm(p => ({ ...p, deadline: e.target.value }))} />
            </div>
            <div>
              <label className="label">Rate (per influencer)</label>
              <input type="number" className="input" placeholder="0"
                value={bulkForm.rate || ''}
                onChange={e => setBulkForm(p => ({ ...p, rate: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Currency</label>
              <select className="input" value={bulkForm.currency || 'SAR'}
                onChange={e => setBulkForm(p => ({ ...p, currency: e.target.value }))}>
                <option>SAR</option>
                <option>USD</option>
                <option>AED</option>
                <option>KWD</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Deliverables</label>
              <input className="input" placeholder="e.g. 1 Reel + 3 Stories"
                value={bulkForm.deliverables || ''}
                onChange={e => setBulkForm(p => ({ ...p, deliverables: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">Brief</label>
              <textarea className="input h-24 resize-none" placeholder="Campaign brief..."
                value={bulkForm.brief || ''}
                onChange={e => setBulkForm(p => ({ ...p, brief: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-surface-border">
            <button className="btn-secondary" onClick={() => setShowBulkSend(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleBulkSend} disabled={bulkSending}>
              <Send className="w-4 h-4" />
              {bulkSending ? 'Sending...' : `Send to ${influencers.length} Influencers`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Influencer Modal */}
      <Modal open={showAddInfluencer} onClose={handleCloseAddModal} title="Add Influencer to Campaign" size="2xl" className="max-w-4xl">
        {/* Tabs */}
        <div className="flex border-b border-surface-border px-5">
          <button
            onClick={() => setAddModalTab('database')}
            className={cn(
              'py-3 px-4 text-sm font-medium border-b-2 -mb-px transition-colors',
              addModalTab === 'database'
                ? 'border-white text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            )}
          >
            <Users className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            From Database
          </button>
          <button
            onClick={() => setAddModalTab('discover')}
            className={cn(
              'py-3 px-4 text-sm font-medium border-b-2 -mb-px transition-colors',
              addModalTab === 'discover'
                ? 'border-white text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            )}
          >
            <Search className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            Discover
          </button>
        </div>

        {/* Database Tab */}
        {addModalTab === 'database' && (
          <div className="p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                className="input pl-9"
                placeholder="Search by name, handle..."
                value={influencerSearch}
                onChange={e => setInfluencerSearch(e.target.value)}
                autoFocus
              />
            </div>

            {dbSelected.size > 0 && (
              <div className="flex items-center justify-between bg-surface-overlay rounded-lg px-3 py-2">
                <span className="text-sm text-gray-300">{dbSelected.size} selected</span>
                <button
                  onClick={() => bulkAddDbMutation.mutate([...dbSelected])}
                  disabled={bulkAddDbMutation.isPending}
                  className="btn-primary btn-sm"
                >
                  {bulkAddDbMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Add {dbSelected.size} Selected
                </button>
              </div>
            )}

            <div className="space-y-1 max-h-96 overflow-y-auto">
              {searchResults?.data.map(inf => {
                const alreadyAdded = influencers.some(ci => ci.influencer_id === inf.id);
                const isChecked = dbSelected.has(inf.id);
                return (
                  <div
                    key={inf.id}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg',
                      alreadyAdded ? 'opacity-40' : 'hover:bg-surface-overlay cursor-pointer'
                    )}
                    onClick={() => {
                      if (alreadyAdded) return;
                      setDbSelected(prev => {
                        const next = new Set(prev);
                        next.has(inf.id) ? next.delete(inf.id) : next.add(inf.id);
                        return next;
                      });
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      {!alreadyAdded && (
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-4 h-4 rounded accent-white shrink-0 cursor-pointer"
                          onClick={e => e.stopPropagation()}
                        />
                      )}
                      <Avatar src={inf.profile_photo_url} name={getDisplayName(inf)} size="sm" />
                      <div>
                        <p className="font-medium text-sm text-white">{getDisplayName(inf)}</p>
                        <div className="flex gap-1 mt-0.5">
                          {inf.ig_handle && <PlatformBadge platform="instagram" followers={inf.ig_followers} showHandle={false} />}
                          {inf.tiktok_handle && <PlatformBadge platform="tiktok" followers={inf.tiktok_followers} showHandle={false} />}
                        </div>
                      </div>
                    </div>
                    {alreadyAdded ? (
                      <span className="text-xs text-gray-500">Added</span>
                    ) : (
                      <button
                        onClick={e => { e.stopPropagation(); addMutation.mutate(inf.id); }}
                        disabled={addMutation.isPending}
                        className="btn-primary btn-sm shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add
                      </button>
                    )}
                  </div>
                );
              })}
              {influencerSearch.length < 2 && (
                <p className="text-sm text-gray-500 text-center py-8">Type at least 2 characters to search</p>
              )}
              {influencerSearch.length >= 2 && searchResults?.data.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">No influencers found</p>
              )}
            </div>
          </div>
        )}

        {/* Discover Tab */}
        {addModalTab === 'discover' && (
          <div className="p-4 space-y-4">
            {/* Search controls */}
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    className="input pl-9"
                    placeholder="Keyword, hashtag, niche..."
                    value={discoverQuery}
                    onChange={e => setDiscoverQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleDiscoverSearch()}
                    autoFocus
                  />
                </div>
                <select className="input w-36" value={discoverPlatform} onChange={e => setDiscoverPlatform(e.target.value)}>
                  {DISCOVER_PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <select className="input w-36" value={discoverCountry} onChange={e => setDiscoverCountry(e.target.value)}>
                  <option value="">All Countries</option>
                  {DISCOVER_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="input w-40" value={discoverSortBy} onChange={e => setDiscoverSortBy(e.target.value)}>
                  <option value="followers_desc">Most Followers</option>
                  <option value="followers_asc">Least Followers</option>
                  <option value="engagement_desc">Best Engagement</option>
                </select>
                <button
                  onClick={handleDiscoverSearch}
                  disabled={discoverFetching || discoverQuery.trim().length < 2}
                  className="btn-primary"
                >
                  {discoverFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  {discoverFetching ? 'Searching...' : 'Search'}
                </button>
              </div>
              {/* Follower range */}
              <div className="flex items-center gap-2">
                <input className="input w-32 text-sm" type="number" placeholder="Min followers"
                  value={discoverMinFoll} onChange={e => setDiscoverMinFoll(e.target.value)} />
                <span className="text-gray-500 text-sm">–</span>
                <input className="input w-32 text-sm" type="number" placeholder="Max followers"
                  value={discoverMaxFoll} onChange={e => setDiscoverMaxFoll(e.target.value)} />
              </div>
              {/* Category pills */}
              <div className="flex flex-wrap gap-1.5">
                {DISCOVER_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setDiscoverQuery(cat)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                      discoverQuery === cat
                        ? 'bg-white text-[#1c1c1c] border-white'
                        : 'bg-surface-overlay text-gray-400 border-surface-border hover:border-white/20 hover:text-white'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Bulk action bar */}
            {discoverSelected.size > 0 && (
              <div className="flex items-center justify-between bg-surface-overlay rounded-lg px-3 py-2">
                <span className="text-sm text-gray-300">{discoverSelected.size} selected</span>
                <button
                  onClick={() => {
                    const items = (discoverData?.results || [])
                      .filter(r => discoverSelected.has(`${r.platform}:${r.handle}`))
                      .map(r => ({ platform: r.platform, handle: r.handle }));
                    bulkImportAddMutation.mutate(items);
                  }}
                  disabled={bulkImportAddMutation.isPending}
                  className="btn-primary btn-sm"
                >
                  {bulkImportAddMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  {bulkImportAddMutation.isPending ? 'Adding...' : `Import & Add ${discoverSelected.size}`}
                </button>
              </div>
            )}

            {/* Results */}
            {discoverFetching ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-80 overflow-y-auto">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="card p-3 space-y-2">
                    <div className="flex gap-2"><div className="skeleton w-9 h-9 rounded-full" /><div className="flex-1 space-y-1.5"><div className="skeleton h-3.5 w-20" /><div className="skeleton h-3 w-12" /></div></div>
                    <div className="skeleton h-6 w-full rounded-lg" />
                  </div>
                ))}
              </div>
            ) : (discoverData?.results || []).length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-1">
                {(discoverData!.results).map((inf: DiscoveredInfluencer) => {
                  const key = `${inf.platform}:${inf.handle}`;
                  const isSelected = discoverSelected.has(key);
                  const alreadyInCampaign = false; // discover results don't have DB IDs yet
                  const isAdding = importAndAddMutation.isPending && importAndAddMutation.variables?.handle === inf.handle;

                  return (
                    <div
                      key={key}
                      className={cn(
                        'card p-3 flex flex-col gap-2 transition-all cursor-pointer',
                        isSelected && 'ring-1 ring-white/30 border-white/20'
                      )}
                      onClick={() => setDiscoverSelected(prev => {
                        const next = new Set(prev);
                        next.has(key) ? next.delete(key) : next.add(key);
                        return next;
                      })}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded accent-white mt-0.5 shrink-0 cursor-pointer"
                          onClick={e => e.stopPropagation()}
                        />
                        {inf.profile_pic ? (
                          <img src={inf.profile_pic} alt={inf.handle}
                            className="w-9 h-9 rounded-full object-cover shrink-0 border border-surface-border"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-surface-subtle border border-surface-border flex items-center justify-center text-gray-500 text-sm font-medium shrink-0">
                            {inf.handle[0]?.toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-medium text-white truncate">{inf.display_name || `@${inf.handle}`}</span>
                            {inf.is_verified && <CheckCircle className="w-3 h-3 text-blue-400 shrink-0" />}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-gray-500"><DiscoverPlatformIcon platform={inf.platform} /></span>
                            <span className="text-xs text-gray-500 truncate">@{inf.handle}</span>
                          </div>
                          {inf.followers !== undefined && (
                            <p className="text-xs font-semibold text-white mt-0.5">{formatFollowers(inf.followers)}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-1.5 mt-auto" onClick={e => e.stopPropagation()}>
                        {inf.already_imported ? (
                          <button
                            onClick={() => importAndAddMutation.mutate({ platform: inf.platform, handle: inf.handle })}
                            disabled={isAdding}
                            className="flex-1 btn-primary btn-sm"
                          >
                            {isAdding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                            Add
                          </button>
                        ) : (
                          <button
                            onClick={() => importAndAddMutation.mutate({ platform: inf.platform, handle: inf.handle })}
                            disabled={isAdding}
                            className="flex-1 btn-primary btn-sm"
                          >
                            {isAdding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                            Import & Add
                          </button>
                        )}
                        <a href={inf.profile_url} target="_blank" rel="noopener noreferrer"
                          className="btn-secondary btn-sm px-1.5" onClick={e => e.stopPropagation()}>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : discoverHasSearched && !discoverFetching ? (
              <div className="text-center py-12">
                <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No results for "{discoverQuery}"</p>
              </div>
            ) : !discoverHasSearched ? (
              <div className="text-center py-12">
                <Search className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-300 font-medium mb-1">Find New Influencers</p>
                <p className="text-xs text-gray-500">Search by keyword, niche, or select a category above</p>
              </div>
            ) : null}

            {discoverData?.error && (
              <p className="text-xs text-amber-400 bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-2">
                {discoverData.error}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
