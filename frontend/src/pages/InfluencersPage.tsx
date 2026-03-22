import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, LayoutGrid, List, Plus, Trash2, Megaphone, RefreshCw, ChevronLeft, ChevronRight, Download, Bookmark, BookmarkCheck, X as XIcon, UserPlus, Mail, Compass } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { getInfluencers, getFilterMeta, bulkDeleteInfluencers, bulkEnrich, exportInfluencersCSV, bulkInviteInfluencers, exportContactsCSV, createInfluencer, enrichInfluencer } from '../utils/api';
import type { FilterState } from '../types';
import InfluencerTable from '../components/influencers/InfluencerTable';
import InfluencerCard from '../components/influencers/InfluencerCard';
import FiltersPanel from '../components/influencers/FiltersPanel';
import { TableSkeleton, CardSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import { Users } from 'lucide-react';

const DEFAULT_FILTERS: FilterState = {
  search: '', category: '', platform: '', tier: '', country: '',
  mawthouq: null, hasPhone: null, supplierSource: '', tags: '',
  minFollowers: null, maxFollowers: null, minRate: null, maxRate: null,
  sortBy: 'created_at', sortDir: 'desc', page: 1, limit: 50,
  enrichmentStatus: '',
};

const ENRICHMENT_PILLS: { label: string; value: FilterState['enrichmentStatus'] }[] = [
  { label: 'All',               value: ''         },
  { label: 'Needs Enrichment',  value: 'pending'  },
  { label: 'Enriched',          value: 'enriched' },
  { label: 'Failed',            value: 'failed'   },
];

interface FilterPreset { name: string; filters: Partial<FilterState>; }

function useFilterPresets() {
  const STORAGE_KEY = 'cp_filter_presets';
  const load = (): FilterPreset[] => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  };
  const save = (presets: FilterPreset[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  const [presets, setPresets] = useState<FilterPreset[]>(load);

  const addPreset = (name: string, filters: Partial<FilterState>) => {
    const updated = [...presets.filter(p => p.name !== name), { name, filters }];
    setPresets(updated); save(updated);
  };
  const removePreset = (name: string) => {
    const updated = presets.filter(p => p.name !== name);
    setPresets(updated); save(updated);
  };
  return { presets, addPreset, removePreset };
}

const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'snapchat', 'twitter'] as const;

export default function InfluencersPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchInput, setSearchInput] = useState('');
  const { presets, addPreset, removePreset } = useFilterPresets();

  // Add Influencer modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addHandle, setAddHandle] = useState('');
  const [addPlatform, setAddPlatform] = useState<typeof PLATFORMS[number]>('instagram');
  const [addName, setAddName] = useState('');

  const addMutation = useMutation({
    mutationFn: async () => {
      const handle = addHandle.trim().replace(/^@/, '');
      if (!handle) throw new Error('Handle required');
      const handleKey = addPlatform === 'instagram' ? 'ig_handle'
        : addPlatform === 'tiktok' ? 'tiktok_handle'
        : addPlatform === 'youtube' ? 'youtube_handle'
        : addPlatform === 'snapchat' ? 'snap_handle'
        : 'twitter_handle';
      const inf = await createInfluencer({
        [handleKey]: handle,
        name_english: addName.trim() || undefined,
        supplier_source: 'manual',
      });
      // Fire-and-forget enrichment to fetch real-time data
      enrichInfluencer(inf.id).catch(() => {});
      return inf;
    },
    onSuccess: (inf) => {
      toast.success('Influencer added — fetching live data…');
      qc.invalidateQueries({ queryKey: ['influencers'] });
      setShowAddModal(false);
      setAddHandle('');
      setAddName('');
      navigate(`/influencers/${inf.id}`);
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to add influencer'),
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['influencers', filters],
    queryFn: () => getInfluencers(filters),
  });

  const { data: meta } = useQuery({
    queryKey: ['filter-meta'],
    queryFn: getFilterMeta,
    staleTime: 60000,
  });

  const updateFilters = useCallback((updates: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...updates }));
    setSelectedIds(new Set());
  }, []);

  const handleSearch = useCallback(() => {
    updateFilters({ search: searchInput, page: 1 });
  }, [searchInput, updateFilters]);

  const handleSortChange = useCallback((field: string) => {
    setFilters(prev => ({
      ...prev,
      sortBy: field,
      sortDir: prev.sortBy === field && prev.sortDir === 'asc' ? 'desc' : 'asc',
      page: 1
    }));
  }, []);

  const handleSelectAll = () => {
    if (data?.data.every(i => selectedIds.has(i.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data?.data.map(i => i.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} influencers? (They will be archived, not permanently deleted)`)) return;
    await bulkDeleteInfluencers([...selectedIds]);
    toast.success(`${selectedIds.size} influencers archived`);
    setSelectedIds(new Set());
    refetch();
  };

  const handleBulkEnrich = async () => {
    const ids = [...selectedIds];
    await bulkEnrich(ids.length > 0 ? ids : undefined);
    toast.success('Enrichment started in background');
  };

  const influencers = data?.data || [];
  const pagination = data?.pagination;

  return (
    <>
    <div className="flex gap-6 h-full">
      {/* Filters sidebar */}
      <FiltersPanel
        filters={filters}
        meta={meta}
        onChange={updateFilters}
        onClear={() => { setFilters(DEFAULT_FILTERS); setSearchInput(''); }}
      />

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="flex-1 min-w-60 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="input pl-9 pr-4"
                placeholder="Search names, handles, categories... (Arabic supported)"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <button onClick={handleSearch} className="btn-primary">Search</button>
          </div>

          {/* View toggle */}
          <div className="flex rounded-lg border border-surface-border overflow-hidden">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-2 text-sm transition-colors ${viewMode === 'table' ? 'bg-white text-[#1c1c1c]' : 'bg-surface-overlay text-gray-400 hover:bg-surface-subtle hover:text-white'}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-2 text-sm transition-colors ${viewMode === 'grid' ? 'bg-white text-[#1c1c1c]' : 'bg-surface-overlay text-gray-400 hover:bg-surface-subtle hover:text-white'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {/* Actions */}
          <button
            onClick={async () => {
              try { await exportInfluencersCSV(); toast.success('CSV downloaded'); }
              catch { toast.error('Export failed'); }
            }}
            className="btn-secondary"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          <button
            onClick={async () => {
              try { await exportContactsCSV(); toast.success('Contacts exported'); }
              catch { toast.error('Export failed'); }
            }}
            className="btn-secondary"
          >
            <Mail className="w-4 h-4" /> Contacts
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Influencer
          </button>

          {selectedIds.size > 0 && (
            <>
              <button onClick={handleBulkEnrich} className="btn-secondary">
                <RefreshCw className="w-4 h-4" /> Enrich ({selectedIds.size})
              </button>
              <button
                onClick={async () => {
                  try {
                    const { results } = await bulkInviteInfluencers([...selectedIds]);
                    const text = results.map(r => `${r.name}: ${r.invite_url}`).join('\n');
                    await navigator.clipboard.writeText(text);
                    toast.success(`${results.length} invite links copied to clipboard`);
                  } catch {
                    toast.error('Bulk invite failed');
                  }
                }}
                className="btn-secondary"
              >
                <UserPlus className="w-4 h-4" /> Invite ({selectedIds.size})
              </button>
              <button
                onClick={async () => {
                  try {
                    await exportContactsCSV([...selectedIds]);
                    toast.success('Contacts exported');
                  } catch {
                    toast.error('Export failed');
                  }
                }}
                className="btn-secondary"
              >
                <Mail className="w-4 h-4" /> Contacts
              </button>
              <button onClick={handleBulkDelete} className="btn-danger">
                <Trash2 className="w-4 h-4" /> Delete ({selectedIds.size})
              </button>
            </>
          )}
        </div>

        {/* Enrichment status quick filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {ENRICHMENT_PILLS.map(pill => (
            <button
              key={pill.value}
              onClick={() => updateFilters({ enrichmentStatus: pill.value, page: 1 })}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                filters.enrichmentStatus === pill.value
                  ? 'bg-white text-[#1c1c1c] border-white'
                  : 'bg-surface-overlay text-gray-400 border-surface-border hover:border-white/20 hover:text-white'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Saved presets bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-600 shrink-0">Presets:</span>
          {presets.map(preset => (
            <div key={preset.name} className="flex items-center gap-0.5">
              <button
                onClick={() => updateFilters(preset.filters)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-overlay text-gray-300 border border-surface-border hover:border-blue-500/50 hover:text-white transition-all"
              >
                <BookmarkCheck className="w-3 h-3 text-blue-400" />
                {preset.name}
              </button>
              <button
                onClick={() => removePreset(preset.name)}
                className="p-0.5 text-gray-600 hover:text-red-400 transition-colors"
              >
                <XIcon className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              const name = prompt('Save current filters as preset (name):');
              if (name?.trim()) {
                const { page, limit, sortBy, sortDir, ...rest } = filters;
                void page; void limit; void sortBy; void sortDir;
                addPreset(name.trim(), rest);
              }
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-gray-500 border border-dashed border-surface-border hover:border-white/30 hover:text-white transition-all"
          >
            <Bookmark className="w-3 h-3" /> Save current
          </button>
        </div>

        {/* Sort bar */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            {isLoading ? 'Loading...' : `${pagination?.total.toLocaleString() || 0} influencers`}
            {selectedIds.size > 0 && ` · ${selectedIds.size} selected`}
          </p>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Sort by</label>
            <select
              className="input text-sm py-1.5 w-36"
              value={filters.sortBy}
              onChange={e => updateFilters({ sortBy: e.target.value, page: 1 })}
            >
              <option value="created_at">Date Added</option>
              <option value="name">Name</option>
              <option value="followers">Followers</option>
              <option value="rate">Rate</option>
              <option value="updated_at">Last Updated</option>
            </select>
            <button
              className="btn-ghost btn-sm"
              onClick={() => updateFilters({ sortDir: filters.sortDir === 'asc' ? 'desc' : 'asc' })}
            >
              {filters.sortDir === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="card overflow-hidden flex-1">
          {isLoading ? (
            viewMode === 'table'
              ? <TableSkeleton rows={10} cols={7} />
              : <div className="p-4 grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 9 }).map((_, i) => <CardSkeleton key={i} />)}
                </div>
          ) : influencers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No influencers found"
              description="Add influencers by handle for live data, or discover new creators via the Discover page."
              action={
                <div className="flex gap-2">
                  <button onClick={() => setShowAddModal(true)} className="btn-primary">
                    <Plus className="w-4 h-4" /> Add by Handle
                  </button>
                  <button onClick={() => navigate('/discover')} className="btn-secondary">
                    <Compass className="w-4 h-4" /> Discover
                  </button>
                </div>
              }
            />
          ) : viewMode === 'table' ? (
            <InfluencerTable
              influencers={influencers}
              selectedIds={selectedIds}
              onToggleSelect={id => {
                setSelectedIds(prev => {
                  const next = new Set(prev);
                  next.has(id) ? next.delete(id) : next.add(id);
                  return next;
                });
              }}
              onSelectAll={handleSelectAll}
              filters={filters}
              onSortChange={handleSortChange}
            />
          ) : (
            <div className="p-4 grid grid-cols-2 lg:grid-cols-3 gap-4">
              {influencers.map(inf => (
                <InfluencerCard
                  key={inf.id}
                  influencer={inf}
                  selected={selectedIds.has(inf.id)}
                  onSelect={id => {
                    setSelectedIds(prev => {
                      const next = new Set(prev);
                      next.has(id) ? next.delete(id) : next.add(id);
                      return next;
                    });
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex gap-1">
              <button
                className="btn-secondary btn-sm"
                disabled={pagination.page <= 1}
                onClick={() => updateFilters({ page: pagination.page - 1 })}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(pagination.page - 2, pagination.totalPages - 4)) + i;
                return (
                  <button
                    key={p}
                    className={`btn-sm px-3 py-1.5 rounded-lg text-sm ${p === pagination.page ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => updateFilters({ page: p })}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                className="btn-secondary btn-sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => updateFilters({ page: pagination.page + 1 })}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Add Influencer Modal */}

    {showAddModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-md bg-[#1c1c1c] border border-surface-border rounded-2xl shadow-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
            <h2 className="text-base font-semibold text-white">Add Influencer</h2>
            <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-white">
              <XIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-400">
              Enter the influencer's handle — the platform will fetch their live follower count, engagement rate, and profile data automatically.
            </p>

            <div>
              <label className="label">Platform</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {PLATFORMS.map(p => (
                  <button
                    key={p}
                    onClick={() => setAddPlatform(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition-all ${
                      addPlatform === p
                        ? 'bg-white text-[#1c1c1c] border-white'
                        : 'bg-surface-overlay text-gray-400 border-surface-border hover:border-gray-400'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Handle *</label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">@</span>
                <input
                  className="input pl-7"
                  placeholder={`${addPlatform} username`}
                  value={addHandle}
                  onChange={e => setAddHandle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addMutation.mutate()}
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="label">Name (optional)</label>
              <input
                className="input mt-1"
                placeholder="Full name"
                value={addName}
                onChange={e => setAddName(e.target.value)}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => addMutation.mutate()}
                disabled={addMutation.isPending || !addHandle.trim()}
                className="btn-primary flex-1"
              >
                <RefreshCw className={`w-4 h-4 ${addMutation.isPending ? 'animate-spin' : ''}`} />
                {addMutation.isPending ? 'Fetching live data…' : 'Add & Fetch Live Data'}
              </button>
              <button onClick={() => setShowAddModal(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
