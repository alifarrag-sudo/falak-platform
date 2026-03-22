import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Instagram, CheckCircle } from 'lucide-react';
import { getPublicCreators } from '../utils/api';
import { cn, formatFollowers } from '../utils/helpers';
import type { Influencer } from '../types';

// TikTok icon (lucide-react doesn't have one)
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z" />
    </svg>
  );
}

const PLATFORM_TABS = [
  { value: '', label: 'All' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
];

const CATEGORIES = [
  'All', 'Fashion', 'Beauty', 'Food', 'Tech', 'Travel',
  'Gaming', 'Fitness', 'Lifestyle', 'Entertainment',
];

const CATEGORY_COLORS: Record<string, string> = {
  Fashion: 'bg-purple-900/40 text-purple-300 border-purple-800/40',
  Beauty: 'bg-pink-900/40 text-pink-300 border-pink-800/40',
  Food: 'bg-orange-900/40 text-orange-300 border-orange-800/40',
  Tech: 'bg-indigo-900/40 text-indigo-300 border-indigo-800/40',
  Travel: 'bg-blue-900/40 text-blue-300 border-blue-800/40',
  Gaming: 'bg-violet-900/40 text-violet-300 border-violet-800/40',
  Fitness: 'bg-green-900/40 text-green-300 border-green-800/40',
  Lifestyle: 'bg-teal-900/40 text-teal-300 border-teal-800/40',
  Entertainment: 'bg-yellow-900/40 text-yellow-300 border-yellow-800/40',
};

function getCategoryStyle(cat?: string): string {
  if (!cat) return 'bg-surface-subtle text-gray-400 border-surface-border';
  for (const [key, style] of Object.entries(CATEGORY_COLORS)) {
    if (cat.toLowerCase().includes(key.toLowerCase())) return style;
  }
  return 'bg-surface-subtle text-gray-400 border-surface-border';
}

function CreatorCard({ creator }: { creator: Influencer }) {
  const name = creator.name_english || creator.name_arabic || 'Unknown';
  const handle = creator.ig_handle || creator.tiktok_handle || creator.snap_handle;
  const followers = creator.ig_followers || creator.tiktok_followers || creator.snap_followers;
  const hasTikTok = !!creator.tiktok_handle;
  const hasIG = !!creator.ig_handle;

  return (
    <Link
      to={`/p/${creator.id}`}
      className="card p-5 flex flex-col gap-3 hover:border-white/20 hover:bg-white/[0.03] transition-all duration-200 group"
    >
      {/* Avatar + name row */}
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          {creator.profile_photo_url ? (
            <img
              src={creator.profile_photo_url}
              alt={name}
              className="w-14 h-14 rounded-full object-cover border-2 border-surface-border group-hover:border-white/30 transition-colors"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-surface-subtle border-2 border-surface-border flex items-center justify-center text-xl font-bold text-gray-500 group-hover:border-white/30 transition-colors">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          {!!creator.mawthouq_certificate && (
            <span className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-0.5">
              <CheckCircle className="w-3 h-3 text-white" />
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm truncate leading-tight">{name}</p>
          {handle && (
            <p className="text-gray-500 text-xs truncate mt-0.5">@{handle}</p>
          )}
        </div>
      </div>

      {/* Category badge */}
      {creator.main_category && (
        <span className={cn(
          'self-start inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
          getCategoryStyle(creator.main_category)
        )}>
          {creator.main_category}
        </span>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-3 mt-auto pt-2 border-t border-surface-border">
        {followers && (
          <span className="text-sm font-bold text-white">{formatFollowers(followers)}</span>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          {hasIG && <Instagram className="w-3.5 h-3.5 text-pink-400" />}
          {hasTikTok && <TikTokIcon className="w-3.5 h-3.5 text-cyan-400" />}
        </div>
      </div>

      {/* Mawthouq label */}
      {!!creator.mawthouq_certificate && (
        <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium -mt-1">
          <CheckCircle className="w-3 h-3" />
          Mawthouq Certified
        </div>
      )}
    </Link>
  );
}

export default function PublicCreatorsPage() {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [platform, setPlatform] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 24;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [platform, category]);

  const queryParams = {
    search: debouncedSearch || undefined,
    category: category || undefined,
    platform: platform || undefined,
    page,
    limit: LIMIT,
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['public-creators', queryParams],
    queryFn: () => getPublicCreators(queryParams),
    staleTime: 60_000,
  });

  const creators = data?.data ?? [];
  const total = data?.total ?? 0;
  const hasMore = page * LIMIT < total;

  return (
    <div className="min-h-screen bg-[#1c1c1c]">
      {/* Hero header */}
      <div className="border-b border-surface-border bg-[#1c1c1c]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold text-white tracking-tight">Discover Creators</h1>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">
              Explore our roster of talented content creators across all platforms and categories.
            </p>
          </div>

          {/* Search bar */}
          <div className="max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <input
              type="text"
              className="w-full bg-[#252525] border border-surface-border rounded-xl pl-11 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white/30 transition-colors text-sm"
              placeholder="Search by name or handle..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </div>

          {/* Platform tabs */}
          <div className="flex justify-center gap-2 flex-wrap">
            {PLATFORM_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setPlatform(tab.value)}
                className={cn(
                  'px-4 py-1.5 rounded-full text-sm font-medium border transition-all',
                  platform === tab.value
                    ? 'bg-white text-[#1c1c1c] border-white'
                    : 'border-surface-border text-gray-400 hover:border-white/30 hover:text-white'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Category filter pills */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(cat => {
            const val = cat === 'All' ? '' : cat;
            return (
              <button
                key={cat}
                onClick={() => setCategory(val)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                  category === val
                    ? 'bg-white/10 border-white/30 text-white'
                    : 'border-surface-border text-gray-500 hover:border-white/20 hover:text-gray-300'
                )}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Results count */}
        {!isLoading && (
          <p className="text-sm text-gray-500">
            {total.toLocaleString()} creator{total !== 1 ? 's' : ''} found
          </p>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="card p-5 space-y-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-surface-subtle" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-surface-subtle rounded w-3/4" />
                    <div className="h-3 bg-surface-subtle rounded w-1/2" />
                  </div>
                </div>
                <div className="h-5 bg-surface-subtle rounded w-1/3" />
                <div className="h-4 bg-surface-subtle rounded w-full" />
              </div>
            ))}
          </div>
        ) : creators.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg font-medium">No creators found</p>
            <p className="text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {creators.map(creator => (
              <CreatorCard key={creator.id} creator={creator} />
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && !isLoading && (
          <div className="flex justify-center pt-4">
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={isFetching}
              className="px-8 py-2.5 rounded-xl border border-surface-border text-gray-300 text-sm font-medium hover:border-white/30 hover:text-white transition-all disabled:opacity-50"
            >
              {isFetching ? 'Loading...' : `Load more (${total - page * LIMIT} remaining)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
