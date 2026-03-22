/**
 * BrandInfluencersPage — browse and search influencers from the brand perspective.
 * Grid of influencer cards with platform icons, follower count, category, rate.
 * Search + filters (platform, category).
 * "Request Campaign" button on each card.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Instagram, Youtube, Users, Tag, DollarSign, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { getInfluencers } from '../../utils/api';
import type { Influencer } from '../../types';
import {
  formatFollowers, formatRate, getDisplayName,
  getPrimaryFollowers, getPrimaryPlatform, getPrimaryRate,
} from '../../utils/helpers';

const PLATFORM_OPTIONS = ['', 'instagram', 'tiktok', 'snapchat', 'facebook', 'youtube'];
const CATEGORY_OPTIONS = [
  '', 'Fashion', 'Beauty', 'Fitness', 'Food', 'Travel',
  'Tech', 'Gaming', 'Lifestyle', 'Business', 'Entertainment',
];

function PlatformIcon({ platform }: { platform: string }) {
  const cls = 'w-3.5 h-3.5';
  switch (platform.toLowerCase()) {
    case 'instagram': return <Instagram className={cls} />;
    case 'youtube':   return <Youtube className={cls} />;
    default:          return <span className="text-[10px] font-bold uppercase">{platform.slice(0, 2)}</span>;
  }
}

function InfluencerCard({ influencer, onRequest }: { influencer: Influencer; onRequest: (inf: Influencer) => void }) {
  const name      = getDisplayName(influencer);
  const platform  = getPrimaryPlatform(influencer);
  const followers = getPrimaryFollowers(influencer);
  const rate      = getPrimaryRate(influencer);

  const platforms: string[] = [];
  if (influencer.ig_handle)      platforms.push('instagram');
  if (influencer.tiktok_handle)  platforms.push('tiktok');
  if (influencer.snap_handle)    platforms.push('snapchat');
  if (influencer.fb_handle)      platforms.push('facebook');
  if (influencer.youtube_handle) platforms.push('youtube');

  return (
    <div className="card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      {/* Avatar row */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white truncate">{name}</p>
          {influencer.main_category && (
            <p className="text-xs text-gray-400 truncate">{influencer.main_category}</p>
          )}
        </div>
      </div>

      {/* Platform icons */}
      {platforms.length > 0 && (
        <div className="flex items-center gap-1.5">
          {platforms.map(p => (
            <span key={p} className="flex items-center justify-center w-6 h-6 rounded bg-[#2a2a2a] text-gray-300">
              <PlatformIcon platform={p} />
            </span>
          ))}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[#1c1c1c] rounded-lg p-2">
          <div className="flex items-center gap-1 text-gray-400 mb-0.5">
            <Users className="w-3 h-3" />
            <span className="text-[10px] uppercase tracking-wide">Followers</span>
          </div>
          <p className="text-sm font-bold text-white">{formatFollowers(followers)}</p>
        </div>
        <div className="bg-[#1c1c1c] rounded-lg p-2">
          <div className="flex items-center gap-1 text-gray-400 mb-0.5">
            <DollarSign className="w-3 h-3" />
            <span className="text-[10px] uppercase tracking-wide">Rate</span>
          </div>
          <p className="text-sm font-bold text-white">{rate ? formatRate(rate, influencer.currency || 'SAR') : '—'}</p>
        </div>
      </div>

      {/* Primary platform badge */}
      {platform !== '—' && (
        <div className="flex items-center gap-1">
          <Tag className="w-3 h-3 text-gray-500" />
          <span className="text-xs text-gray-400">{platform}</span>
        </div>
      )}

      {/* CTA */}
      <button
        onClick={() => onRequest(influencer)}
        className="btn-primary w-full justify-center mt-auto"
      >
        <Send className="w-3.5 h-3.5" />
        Request Campaign
      </button>
    </div>
  );
}

export default function BrandInfluencersPage() {
  const [search, setSearch]     = useState('');
  const [platform, setPlatform] = useState('');
  const [category, setCategory] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['brand-influencers', search, platform, category],
    queryFn: () =>
      getInfluencers({
        search:   search   || undefined,
        platform: platform || undefined,
        category: category || undefined,
        page: 1,
        limit: 48,
      }),
    placeholderData: prev => prev,
  });

  const influencers: Influencer[] = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  const handleRequest = (inf: Influencer) => {
    toast.success(`Request sent to ${getDisplayName(inf)}! (Feature coming soon)`);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Browse Influencers</h1>
        <p className="text-sm text-gray-500 mt-1">
          {total > 0 ? `${total.toLocaleString()} influencers available` : 'Find the right creators for your campaigns'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            className="input pl-9 w-full"
            placeholder="Search by name, handle…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Platform filter */}
        <select
          className="input w-40"
          value={platform}
          onChange={e => setPlatform(e.target.value)}
        >
          <option value="">All Platforms</option>
          {PLATFORM_OPTIONS.filter(Boolean).map(p => (
            <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
          ))}
        </select>

        {/* Category filter */}
        <select
          className="input w-44"
          value={category}
          onChange={e => setCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {CATEGORY_OPTIONS.filter(Boolean).map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="card p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="skeleton w-10 h-10 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <div className="skeleton h-4 w-28" />
                  <div className="skeleton h-3 w-20" />
                </div>
              </div>
              <div className="skeleton h-16 w-full rounded-lg" />
              <div className="skeleton h-8 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : influencers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="w-12 h-12 text-gray-600 mb-4" />
          <p className="text-lg font-semibold text-white">No influencers found</p>
          <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {influencers.map(inf => (
            <InfluencerCard key={inf.id} influencer={inf} onRequest={handleRequest} />
          ))}
        </div>
      )}
    </div>
  );
}
