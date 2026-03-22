import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Users, Star, Zap } from 'lucide-react';
import { fanGetInfluencers } from '../../utils/api';

const PLATFORMS = ['', 'instagram', 'tiktok', 'youtube', 'twitter', 'snapchat'];
const CATEGORIES = ['', 'lifestyle', 'fashion', 'beauty', 'fitness', 'food', 'travel', 'tech', 'gaming', 'sports'];

const REQUEST_TYPE_ICONS: Record<string, string> = {
  shoutout: '📣', video_message: '🎥', photo: '📸', meetup: '🤝', live_chat: '📹', custom: '✨',
};

function formatNum(n: number) {
  if (!n) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function getPriceLabel(inf: any) {
  const prices = [
    inf.fan_shoutout_price, inf.fan_video_price, inf.fan_photo_price,
    inf.fan_meetup_price, inf.fan_live_chat_price, inf.fan_custom_price,
  ].filter(Boolean);
  if (!prices.length) return null;
  const min = Math.min(...prices);
  return `From ${inf.currency || 'SAR'} ${min.toLocaleString()}`;
}

function InfluencerCard({ inf }: { inf: any }) {
  const navigate = useNavigate();
  const priceLabel = getPriceLabel(inf);

  const availableServices = [
    inf.fan_shoutout_price && 'shoutout',
    inf.fan_video_price && 'video_message',
    inf.fan_photo_price && 'photo',
    inf.fan_meetup_price && 'meetup',
    inf.fan_live_chat_price && 'live_chat',
    inf.fan_custom_price && 'custom',
  ].filter(Boolean) as string[];

  return (
    <div
      onClick={() => navigate(`/fan/influencers/${inf.id}`)}
      className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-5 hover:border-[#3a3a3a] hover:bg-[#222] transition-all cursor-pointer group"
    >
      {/* Avatar */}
      <div className="flex items-start gap-4 mb-4">
        <div className="w-14 h-14 bg-gradient-to-br from-purple-600/30 to-pink-500/30 border border-purple-500/20 rounded-full flex items-center justify-center shrink-0">
          {inf.profile_image_url ? (
            <img src={inf.profile_image_url} alt={inf.name} className="w-full h-full rounded-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-purple-300">
              {(inf.name || inf.handle || '?')[0].toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold truncate group-hover:text-purple-300 transition-colors">
            {inf.name || inf.handle}
          </h3>
          {inf.handle && <p className="text-gray-500 text-xs">@{inf.handle}</p>}
          <div className="flex items-center gap-2 mt-1">
            {inf.platform && (
              <span className="text-gray-600 text-xs capitalize">{inf.platform}</span>
            )}
            {inf.category && (
              <span className="text-gray-600 text-xs capitalize">· {inf.category}</span>
            )}
          </div>
        </div>
      </div>

      {/* Bio */}
      {inf.bio && (
        <p className="text-gray-500 text-sm mb-3 line-clamp-2">{inf.bio}</p>
      )}

      {/* Stats */}
      <div className="flex gap-4 mb-4">
        {inf.followers_count && (
          <div>
            <p className="text-white text-sm font-semibold">{formatNum(inf.followers_count)}</p>
            <p className="text-gray-600 text-xs">Followers</p>
          </div>
        )}
        {inf.engagement_rate && (
          <div>
            <p className="text-white text-sm font-semibold">{inf.engagement_rate}%</p>
            <p className="text-gray-600 text-xs">Engagement</p>
          </div>
        )}
        {inf.completed_requests > 0 && (
          <div>
            <p className="text-white text-sm font-semibold">{inf.completed_requests}</p>
            <p className="text-gray-600 text-xs">Fulfilled</p>
          </div>
        )}
      </div>

      {/* Services */}
      {availableServices.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {availableServices.map(svc => (
            <span key={svc} className="bg-[#252525] border border-[#2a2a2a] rounded-full px-2 py-0.5 text-xs text-gray-400">
              {REQUEST_TYPE_ICONS[svc]} {svc.replace('_', ' ')}
            </span>
          ))}
        </div>
      )}

      {/* Price */}
      <div className="flex items-center justify-between">
        {priceLabel ? (
          <span className="text-purple-400 text-sm font-semibold">{priceLabel}</span>
        ) : (
          <span className="text-gray-600 text-sm">Price on request</span>
        )}
        <span className="text-purple-400 text-xs group-hover:translate-x-1 transition-transform">Request →</span>
      </div>
    </div>
  );
}

export default function FanDiscoverPage() {
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['fan-influencers', search, platform, category, page],
    queryFn: () => fanGetInfluencers({ search: search || undefined, platform: platform || undefined, category: category || undefined, page, limit: 12 }),
  });

  const influencers = data?.influencers || [];
  const total = data?.total || 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Hero */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-1.5 mb-4">
          <Zap className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-purple-400 text-xs font-medium">Fan Access</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
          Connect with Your<br />
          <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Favorite Creators</span>
        </h1>
        <p className="text-gray-500 max-w-lg mx-auto">
          Request shoutouts, personalized videos, meet & greets and more from top influencers
        </p>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            className="w-full bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl pl-11 pr-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500"
            placeholder="Search influencers by name or handle..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl px-4 py-3 text-gray-400 text-sm focus:outline-none focus:border-purple-500"
          value={platform}
          onChange={e => { setPlatform(e.target.value); setPage(1); }}
        >
          <option value="">All Platforms</option>
          {PLATFORMS.filter(Boolean).map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
        </select>
        <select
          className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl px-4 py-3 text-gray-400 text-sm focus:outline-none focus:border-purple-500"
          value={category}
          onChange={e => { setCategory(e.target.value); setPage(1); }}
        >
          <option value="">All Categories</option>
          {CATEGORIES.filter(Boolean).map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
        </select>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-5 animate-pulse h-52" />
          ))}
        </div>
      ) : influencers.length === 0 ? (
        <div className="text-center py-20">
          <Users className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-white font-semibold">No creators found</p>
          <p className="text-gray-500 text-sm mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <>
          <p className="text-gray-500 text-sm mb-4">{total} creator{total !== 1 ? 's' : ''} available</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {influencers.map((inf: any) => <InfluencerCard key={inf.id} inf={inf} />)}
          </div>

          {/* Pagination */}
          {total > 12 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-[#1c1c1c] border border-[#2a2a2a] text-gray-400 rounded-xl text-sm hover:border-[#3a3a3a] disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="px-4 py-2 text-gray-500 text-sm">Page {page}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page * 12 >= total}
                className="px-4 py-2 bg-[#1c1c1c] border border-[#2a2a2a] text-gray-400 rounded-xl text-sm hover:border-[#3a3a3a] disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
