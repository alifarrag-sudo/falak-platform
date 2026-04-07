/**
 * /p/:id — Public influencer profile (IMDB-style)
 * No auth required. Safe fields only (no contact/rates).
 * Shows: hero, platform stats, top posts grid, CTA.
 */
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Shield, MapPin, CheckCircle2, ExternalLink, Play, Heart,
  MessageCircle, Eye, Share2, Instagram, Youtube, Twitter,
  AlertCircle, Clock,
} from 'lucide-react';
import { getInfluencerPublic } from '../utils/api';
import Avatar from '../components/ui/Avatar';
import { formatFollowers, cn } from '../utils/helpers';
import type { PlatformStat, InfluencerPost } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function TrustBadge({ score, tier }: { score?: number; tier?: string }) {
  if (!score && !tier) return null;
  const cfg: Record<string, { bg: string; text: string; label: string }> = {
    TRUSTED:  { bg: 'bg-emerald-500/20 border-emerald-500/40', text: 'text-emerald-400', label: 'Trusted' },
    VERIFIED: { bg: 'bg-blue-500/20 border-blue-500/40',      text: 'text-blue-400',    label: 'Verified' },
    CAUTION:  { bg: 'bg-yellow-500/20 border-yellow-500/40',  text: 'text-yellow-400',  label: 'Caution'  },
    FLAGGED:  { bg: 'bg-red-500/20 border-red-500/40',        text: 'text-red-400',     label: 'Flagged'  },
  };
  const c = cfg[tier || ''] || cfg.CAUTION;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${c.bg} ${c.text}`}>
      <CheckCircle2 className="w-3.5 h-3.5" />
      {c.label} {score !== undefined ? `${score}/100` : ''}
    </span>
  );
}

function freshnessConfig(lastEnriched?: string) {
  if (!lastEnriched) return { icon: Clock, color: 'text-gray-500', label: 'Unverified data' };
  const days = (Date.now() - new Date(lastEnriched).getTime()) / 86400000;
  if (days < 7)   return { icon: CheckCircle2, color: 'text-emerald-400', label: 'Data verified recently' };
  if (days < 30)  return { icon: CheckCircle2, color: 'text-yellow-400',  label: 'Data verified this month' };
  return               { icon: AlertCircle,    color: 'text-orange-400',  label: 'Data may be outdated' };
}

function PlatformIcon({ platform }: { platform: string }) {
  const cls = 'w-5 h-5';
  if (platform === 'instagram') return <Instagram className={cls} />;
  if (platform === 'youtube')   return <Youtube className={cls} />;
  if (platform === 'twitter')   return <Twitter className={cls} />;
  if (platform === 'tiktok')    return <span className={`${cls} flex items-center justify-center text-xs font-bold`}>TT</span>;
  if (platform === 'snapchat')  return <span className={`${cls} flex items-center justify-center text-xs`}>👻</span>;
  return null;
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'from-pink-500/20 to-purple-500/20 border-pink-500/30',
  tiktok:    'from-cyan-500/20 to-slate-500/20 border-cyan-500/30',
  youtube:   'from-red-500/20 to-orange-500/20 border-red-500/30',
  snapchat:  'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30',
  twitter:   'from-sky-500/20 to-blue-500/20 border-sky-500/30',
};

function StatCard({ stat }: { stat: PlatformStat }) {
  const gradient = PLATFORM_COLORS[stat.platform] || 'from-gray-500/10 to-gray-600/10 border-gray-500/20';
  return (
    <div className={`bg-gradient-to-br ${gradient} border rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-3">
        <PlatformIcon platform={stat.platform} />
        <span className="font-semibold text-sm text-white capitalize">{stat.platform}</span>
        {stat.data_source === 'oauth' && (
          <span className="ml-auto text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded uppercase tracking-wide">Official</span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-bold text-white">{formatFollowers(stat.follower_count)}</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Followers</p>
        </div>
        {stat.avg_engagement_rate != null && stat.avg_engagement_rate > 0 && (
          <div>
            <p className="text-lg font-bold text-white">{stat.avg_engagement_rate.toFixed(1)}%</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Engagement</p>
          </div>
        )}
        {stat.avg_views != null && stat.avg_views > 0 && (
          <div>
            <p className="text-lg font-bold text-white">{formatFollowers(stat.avg_views)}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Avg Views</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PostCard({ post }: { post: InfluencerPost }) {
  const total = (post.likes || 0) + (post.comments || 0) + (post.views || 0);

  return (
    <a
      href={post.post_url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative aspect-square rounded-xl overflow-hidden bg-[#1c1c1c] border border-[#2a2a2a] hover:border-white/20 transition-all"
    >
      {post.thumbnail_url ? (
        <img
          src={post.thumbnail_url}
          alt={post.caption?.slice(0, 50) || 'Post'}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-600">
          <Play className="w-8 h-8" />
        </div>
      )}

      {/* Video indicator */}
      {post.media_type === 'VIDEO' && (
        <div className="absolute top-2 right-2 bg-black/60 rounded-full p-1">
          <Play className="w-3 h-3 text-white fill-white" />
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 gap-1">
        {post.caption && (
          <p className="text-xs text-white line-clamp-2 leading-snug">{post.caption}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-gray-300">
          {(post.likes || 0) > 0 && (
            <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-pink-400 fill-pink-400" />{formatFollowers(post.likes)}</span>
          )}
          {(post.comments || 0) > 0 && (
            <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{formatFollowers(post.comments)}</span>
          )}
          {(post.views || 0) > 0 && (
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{formatFollowers(post.views)}</span>
          )}
          {!total && <ExternalLink className="w-3 h-3 ml-auto" />}
        </div>
      </div>
    </a>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>();

  const { data: inf, isLoading, isError } = useQuery({
    queryKey: ['influencer-public', id],
    queryFn: () => getInfluencerPublic(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#111] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-24 h-24 rounded-full bg-[#222] animate-pulse mx-auto" />
          <div className="h-6 w-40 bg-[#222] animate-pulse rounded mx-auto" />
          <div className="h-4 w-24 bg-[#222] animate-pulse rounded mx-auto" />
        </div>
      </div>
    );
  }

  if (isError || !inf) {
    return (
      <div className="min-h-screen bg-[#111] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Profile not found</p>
          <Link to="/" className="text-sm text-gray-500 hover:text-white transition-colors">← Go back</Link>
        </div>
      </div>
    );
  }

  const name = inf.name_english || inf.name_arabic || 'Unknown';
  const freshness = freshnessConfig(inf.last_enriched_at);
  const FreshnessIcon = freshness.icon;
  const stats: PlatformStat[] = inf.platform_stats || [];
  const posts: InfluencerPost[] = inf.top_posts || [];

  // Build platform stats from influencer fields if no platform_stats
  const effectiveStats: PlatformStat[] = stats.length > 0 ? stats : [
    inf.ig_handle      ? { platform: 'instagram', follower_count: inf.ig_followers, avg_engagement_rate: inf.ig_engagement_rate } : null,
    inf.tiktok_handle  ? { platform: 'tiktok',    follower_count: inf.tiktok_followers, avg_engagement_rate: inf.tiktok_engagement_rate } : null,
    inf.snap_handle    ? { platform: 'snapchat',  follower_count: inf.snap_followers } : null,
    inf.youtube_handle ? { platform: 'youtube',   follower_count: inf.youtube_followers } : null,
    inf.twitter_handle ? { platform: 'twitter'  } : null,
  ].filter(Boolean) as PlatformStat[];

  return (
    <div className="min-h-screen bg-[#111] text-white">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a2e] via-[#111] to-[#111] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-6 pt-16 pb-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">

            {/* Avatar */}
            <div className={cn(
              'shrink-0 ring-4 rounded-full',
              inf.trust_tier === 'TRUSTED'  ? 'ring-emerald-500/50' :
              inf.trust_tier === 'VERIFIED' ? 'ring-blue-500/50' :
              'ring-white/10'
            )}>
              <Avatar src={inf.profile_photo_url} name={name} size="xl" className="w-28 h-28 text-3xl" />
            </div>

            {/* Name + badges */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start mb-1">
                <h1 className="text-3xl font-bold text-white">{name}</h1>
                {inf.mawthouq_certificate === 1 && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    <Shield className="w-3.5 h-3.5" /> Mawthouq
                  </span>
                )}
              </div>

              {inf.name_arabic && inf.name_english && (
                <p className="text-xl text-gray-400 mb-2" style={{ fontFamily: 'serif', direction: 'rtl' }}>{inf.name_arabic}</p>
              )}

              {inf.nickname && (
                <p className="text-sm text-gray-500 mb-3">@{inf.nickname}</p>
              )}

              {/* Badges row */}
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start mb-3">
                <TrustBadge score={inf.trust_score} tier={inf.trust_tier} />
                {inf.main_category && (
                  <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-white/10 text-gray-300">
                    {inf.main_category}
                  </span>
                )}
                {inf.sub_category_1 && (
                  <span className="inline-flex items-center text-xs px-2.5 py-1 rounded-full bg-white/5 text-gray-400">
                    {inf.sub_category_1}
                  </span>
                )}
                {inf.account_tier && (
                  <span className="inline-flex items-center text-xs px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300">
                    {inf.account_tier}
                  </span>
                )}
              </div>

              {/* Location + freshness */}
              <div className="flex flex-wrap gap-4 text-sm text-gray-500 justify-center sm:justify-start">
                {(inf.city || inf.country) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {[inf.city, inf.country].filter(Boolean).join(', ')}
                  </span>
                )}
                {!!inf.language && <span>{inf.language}</span>}
                <span className={`flex items-center gap-1 ${freshness.color}`}>
                  <FreshnessIcon className="w-3.5 h-3.5" />
                  {freshness.label}
                </span>
              </div>

              {/* Social handles row */}
              <div className="flex flex-wrap gap-3 mt-4 justify-center sm:justify-start">
                {inf.ig_handle && (
                  <a href={inf.ig_url || `https://instagram.com/${inf.ig_handle}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-pink-400 hover:text-pink-300 transition-colors">
                    <Instagram className="w-4 h-4" /> @{inf.ig_handle}
                  </a>
                )}
                {inf.tiktok_handle && (
                  <a href={inf.tiktok_url || `https://tiktok.com/@${inf.tiktok_handle}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
                    🎵 @{inf.tiktok_handle}
                  </a>
                )}
                {inf.youtube_handle && (
                  <a href={inf.youtube_url || `https://youtube.com/@${inf.youtube_handle}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors">
                    <Youtube className="w-4 h-4" /> {inf.youtube_handle}
                  </a>
                )}
                {inf.twitter_handle && (
                  <a href={`https://twitter.com/${inf.twitter_handle}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 transition-colors">
                    <Twitter className="w-4 h-4" /> @{inf.twitter_handle}
                  </a>
                )}
                {inf.snap_handle && (
                  <a href={inf.snap_url || `https://snapchat.com/add/${inf.snap_handle}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-yellow-400 hover:text-yellow-300 transition-colors">
                    👻 {inf.snap_handle}
                  </a>
                )}
                {inf.media_kit_link && (
                  <a href={inf.media_kit_link} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" /> Media Kit
                  </a>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-6 pb-16 space-y-10">

        {/* Platform stats */}
        {effectiveStats.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Platform Stats</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {effectiveStats.map(s => (
                <StatCard key={s.platform} stat={s} />
              ))}
            </div>
          </section>
        )}

        {/* Top posts */}
        {posts.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">
              Top Content
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {posts.map(p => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          </section>
        )}

        {/* Tags */}
        {inf.tags && (
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Content Niches</h2>
            <div className="flex flex-wrap gap-2">
              {inf.tags.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                <span key={t} className="px-3 py-1.5 text-sm rounded-full bg-white/5 border border-white/10 text-gray-300">
                  {t}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="bg-gradient-to-r from-[#1a1a2e] to-[#161626] border border-white/10 rounded-2xl p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Interested in working together?</h2>
          <p className="text-sm text-gray-400 mb-6 max-w-sm mx-auto">
            Send a collaboration request and our team will get back to you within 24 hours.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <a
              href={`mailto:hello@falak.io?subject=Collaboration%20Inquiry%20–%20${encodeURIComponent(name)}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#111] text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              Request Collaboration
            </a>
            <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 text-white text-sm font-medium rounded-xl hover:bg-white/15 transition-colors">
              Browse More Talent
            </Link>
          </div>
        </section>

        {/* Footer */}
        <p className="text-center text-xs text-gray-600">
          Powered by <span className="text-gray-400">FALAK · فلك</span>
        </p>

      </div>
    </div>
  );
}
