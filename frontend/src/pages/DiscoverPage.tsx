import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Instagram, Music2, Youtube, Twitter, CheckCircle, ExternalLink, Download, Loader2, AlertCircle, Users, KeyRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { discoverInfluencers, importDiscoveredInfluencer, importDiscoveredBulk, type DiscoveredInfluencer } from '../utils/api';
import { cn } from '../utils/helpers';

const PLATFORMS = [
  { value: 'all',       label: 'All Platforms' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok',    label: 'TikTok' },
  { value: 'youtube',   label: 'YouTube' },
  { value: 'snapchat',  label: 'Snapchat' },
  { value: 'twitter',   label: 'Twitter / X' },
  { value: 'facebook',  label: 'Facebook' },
];

const COUNTRIES = [
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
const CATEGORIES = [
  'Food','Lifestyle','Fashion','Beauty','Tech','Travel','Fitness','Comedy','Gaming',
  'Parenting','Business','Art','Music','Sports','Health','Education','Entertainment',
  'DIY & Crafts','Pets','Finance','Luxury','Cars','Photography','Dance','Motivation',
  'News & Politics','Real Estate','Cooking','Skincare','Hair & Makeup',
];
const SORT_OPTIONS = [
  { value: 'followers_desc',   label: 'Most Followers' },
  { value: 'followers_asc',    label: 'Least Followers' },
  { value: 'engagement_desc',  label: 'Best Engagement' },
];

function formatFollowers(n?: number): string {
  if (!n) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === 'instagram') return <Instagram className="w-3.5 h-3.5" />;
  if (platform === 'tiktok')    return <Music2 className="w-3.5 h-3.5" />;
  if (platform === 'youtube')   return <Youtube className="w-3.5 h-3.5" />;
  if (platform === 'twitter')   return <Twitter className="w-3.5 h-3.5" />;
  if (platform === 'snapchat')  return <span className="text-[10px] font-bold leading-none">👻</span>;
  if (platform === 'facebook')  return <span className="text-[10px] font-bold leading-none">f</span>;
  return null;
}

function platformColor(platform: string) {
  if (platform === 'instagram') return 'text-pink-400';
  if (platform === 'tiktok')    return 'text-slate-300';
  if (platform === 'youtube')   return 'text-red-400';
  if (platform === 'twitter')   return 'text-sky-400';
  if (platform === 'snapchat')  return 'text-yellow-400';
  if (platform === 'facebook')  return 'text-blue-400';
  return 'text-gray-400';
}

export default function DiscoverPage() {
  const [query, setQuery]         = useState('');
  const [platform, setPlatform]   = useState('all');
  const [country, setCountry]     = useState('');
  const [minFoll, setMinFoll]     = useState('');
  const [maxFoll, setMaxFoll]     = useState('');
  const [sortBy, setSortBy]       = useState('followers_desc');
  const [limit, setLimit]         = useState(20);
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);

  const qc = useQueryClient();

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['discover', query, platform, country, minFoll, maxFoll, sortBy, limit],
    queryFn: () => discoverInfluencers(query, platform, limit, {
      country:      country || undefined,
      min_followers: minFoll || undefined,
      max_followers: maxFoll || undefined,
      sort_by:      sortBy,
    }),
    enabled: false,
  });

  const handleSearch = useCallback(async () => {
    if (query.trim().length < 2) { toast.error('Enter at least 2 characters'); return; }
    setHasSearched(true);
    await refetch();
  }, [query, refetch]);

  const importMutation = useMutation({
    mutationFn: ({ platform, handle }: { platform: string; handle: string }) =>
      importDiscoveredInfluencer(platform, handle),
    onSuccess: (result, vars) => {
      toast.success(result.created ? `@${vars.handle} imported!` : `@${vars.handle} updated`);
      qc.invalidateQueries({ queryKey: ['influencers'] });
      qc.invalidateQueries({ queryKey: ['discover'] });
    },
    onError: (_e, vars) => toast.error(`Failed to import @${vars.handle}`),
  });

  const bulkImportMutation = useMutation({
    mutationFn: (items: { platform: string; handle: string }[]) => importDiscoveredBulk(items),
    onSuccess: (result) => {
      toast.success(`Imported ${result.created} new, updated ${result.total - result.created}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ['influencers'] });
      qc.invalidateQueries({ queryKey: ['discover'] });
    },
    onError: () => toast.error('Bulk import failed'),
  });

  const results: DiscoveredInfluencer[] = data?.results || [];
  const apiError = data?.error;

  const toggleSelect = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleBulkImport = () => {
    const items = results
      .filter(r => selected.has(`${r.platform}:${r.handle}`))
      .map(r => ({ platform: r.platform, handle: r.handle }));
    if (items.length === 0) return;
    bulkImportMutation.mutate(items);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Search bar */}
      <div className="card p-5 space-y-4">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              className="input pl-9"
              placeholder="Search by keyword, hashtag, or niche (e.g. 'food', 'سعودي', 'fitness')"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <select className="input w-44" value={platform} onChange={e => setPlatform(e.target.value)}>
            {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select className="input w-40" value={country} onChange={e => setCountry(e.target.value)}>
            <option value="">All Countries</option>
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input w-40" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div className="flex gap-1.5 items-center">
            <input className="input w-28 text-sm" type="number" placeholder="Min followers"
              value={minFoll} onChange={e => setMinFoll(e.target.value)} />
            <span className="text-gray-500 text-sm">–</span>
            <input className="input w-28 text-sm" type="number" placeholder="Max followers"
              value={maxFoll} onChange={e => setMaxFoll(e.target.value)} />
          </div>
          <select className="input w-24" value={limit} onChange={e => setLimit(Number(e.target.value))}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
          </select>
          <button
            onClick={handleSearch}
            disabled={isFetching || query.trim().length < 2}
            className="btn-primary"
          >
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {isFetching ? 'Searching...' : 'Discover'}
          </button>
        </div>

        {/* Quick category pills */}
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => { setQuery(cat); }}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                query === cat
                  ? 'bg-white text-[#1c1c1c] border-white'
                  : 'bg-surface-overlay text-gray-400 border-surface-border hover:border-white/20 hover:text-white'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* API error */}
      {apiError && (
        typeof apiError === 'string' && apiError.toLowerCase().includes('no rapidapi key') ? (
          <div className="card p-8 flex flex-col items-center text-center gap-4 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center">
              <KeyRound className="w-7 h-7 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white mb-1">Setup Required</h3>
              <p className="text-sm text-gray-400">
                To use Discover, add your RapidAPI key in Settings.
              </p>
            </div>
            <Link to="/settings" className="btn-primary">
              Go to Settings
            </Link>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-4 bg-amber-900/20 border border-amber-700/40 rounded-xl">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-300">{apiError}</p>
              <p className="text-xs text-amber-400/70 mt-1">Add your RapidAPI key in Settings to enable discovery.</p>
            </div>
          </div>
        )
      )}

      {/* Results header */}
      {results.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            {results.length} influencers found
            {selected.size > 0 && ` · ${selected.size} selected`}
          </p>
          {selected.size > 0 && (
            <button
              onClick={handleBulkImport}
              disabled={bulkImportMutation.isPending}
              className="btn-primary btn-sm"
            >
              <Download className="w-4 h-4" />
              {bulkImportMutation.isPending ? 'Importing...' : `Import ${selected.size} Selected`}
            </button>
          )}
        </div>
      )}

      {/* Results grid */}
      {isFetching ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-3">
              <div className="flex gap-3">
                <div className="skeleton w-12 h-12 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-24" />
                  <div className="skeleton h-3 w-16" />
                </div>
              </div>
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-7 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : results.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {results.map(inf => {
            const key = `${inf.platform}:${inf.handle}`;
            const isSelected = selected.has(key);
            const isImporting = importMutation.isPending && importMutation.variables?.handle === inf.handle;

            return (
              <div
                key={key}
                className={cn(
                  'card p-4 flex flex-col gap-3 transition-all',
                  isSelected && 'ring-1 ring-white/30 border-white/20',
                  inf.already_imported && 'opacity-70'
                )}
              >
                {/* Header */}
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(key)}
                    className="w-4 h-4 rounded accent-white mt-0.5 shrink-0 cursor-pointer"
                  />
                  {inf.profile_pic ? (
                    <img
                      src={inf.profile_pic}
                      alt={inf.handle}
                      className="w-10 h-10 rounded-full object-cover shrink-0 border border-surface-border"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-surface-subtle border border-surface-border flex items-center justify-center text-gray-500 text-sm font-medium shrink-0">
                      {inf.handle[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium text-white truncate">
                        {inf.display_name || `@${inf.handle}`}
                      </span>
                      {inf.is_verified && (
                        <CheckCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={cn('text-xs', platformColor(inf.platform))}>
                        <PlatformIcon platform={inf.platform} />
                      </span>
                      <span className="text-xs text-gray-500">@{inf.handle}</span>
                    </div>
                  </div>
                </div>

                {/* Followers */}
                <div className="flex gap-3 text-xs">
                  {inf.followers !== undefined && (
                    <div>
                      <p className="text-gray-500">Followers</p>
                      <p className="font-semibold text-white">{formatFollowers(inf.followers)}</p>
                    </div>
                  )}
                  {inf.following !== undefined && (
                    <div>
                      <p className="text-gray-500">Following</p>
                      <p className="font-semibold text-gray-300">{formatFollowers(inf.following)}</p>
                    </div>
                  )}
                  {inf.posts_count !== undefined && (
                    <div>
                      <p className="text-gray-500">Posts</p>
                      <p className="font-semibold text-gray-300">{formatFollowers(inf.posts_count)}</p>
                    </div>
                  )}
                </div>

                {/* Bio */}
                {inf.bio && (
                  <p className="text-xs text-gray-500 line-clamp-2">{inf.bio}</p>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-auto">
                  {inf.already_imported ? (
                    <span className="flex-1 text-center text-xs text-emerald-400 py-1.5 border border-emerald-800/40 rounded-lg bg-emerald-900/20">
                      <CheckCircle className="w-3.5 h-3.5 inline mr-1" />
                      In Database
                    </span>
                  ) : (
                    <button
                      onClick={() => importMutation.mutate({ platform: inf.platform, handle: inf.handle })}
                      disabled={isImporting}
                      className="flex-1 btn-primary btn-sm"
                    >
                      {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      Import
                    </button>
                  )}
                  <a
                    href={inf.profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary btn-sm px-2"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      ) : hasSearched && !isFetching ? (
        <div className="card p-16 text-center">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No influencers found for "{query}"</p>
          <p className="text-xs text-gray-600 mt-1">Try a different keyword or category</p>
        </div>
      ) : !hasSearched ? (
        <div className="card p-16 text-center">
          <Search className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-300 font-medium mb-2">Discover Influencers</p>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            Search by keyword, hashtag, or niche to find influencers across Instagram, TikTok, YouTube, Snapchat, Twitter, and Facebook.
          </p>
        </div>
      ) : null}

      {/* Countries quick filter hint */}
      {!hasSearched && (
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Quick country searches</p>
          <div className="flex flex-wrap gap-1.5">
            {COUNTRIES.map(c => (
              <button
                key={c}
                onClick={() => { setQuery(c); }}
                className="px-2.5 py-1 rounded-full text-xs bg-surface-overlay text-gray-400 border border-surface-border hover:border-white/20 hover:text-white transition-all"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
