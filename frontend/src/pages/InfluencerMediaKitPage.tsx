/**
 * Influencer Media Kit — printable/shareable one-pager for brands.
 * Accessed via /influencers/:id/mediakit
 * Shows: profile photo, bio, platform stats, rate card, top content.
 * Print button triggers window.print() for PDF export.
 */
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer, Globe, MapPin, Star, CheckCircle, Copy, Mail, Phone, Shield } from 'lucide-react';
import QRCodeSVG from 'react-qr-code';
import toast from 'react-hot-toast';
import { getInfluencer, getInfluencerPosts } from '../utils/api';
import { formatFollowers, formatRate, cn } from '../utils/helpers';
import type { Influencer, PlatformStat, InfluencerPost } from '../types';

/* ── Platform metadata ─────────────────────────────────────────────────── */

const PLATFORM_META: Record<string, { label: string; color: string; emoji: string }> = {
  instagram: { label: 'Instagram', color: 'bg-pink-900/40 text-pink-300 border border-pink-800/40', emoji: '📸' },
  tiktok:    { label: 'TikTok',    color: 'bg-cyan-900/40 text-cyan-300 border border-cyan-800/40',   emoji: '🎵' },
  youtube:   { label: 'YouTube',   color: 'bg-red-900/40 text-red-300 border border-red-800/40',     emoji: '▶️' },
  snapchat:  { label: 'Snapchat',  color: 'bg-yellow-900/40 text-yellow-300 border border-yellow-800/40', emoji: '👻' },
  facebook:  { label: 'Facebook',  color: 'bg-blue-900/40 text-blue-300 border border-blue-800/40',   emoji: '👤' },
  twitter:   { label: 'Twitter/X', color: 'bg-sky-900/40 text-sky-300 border border-sky-800/40',      emoji: '𝕏' },
};

const RATE_PLATFORMS = [
  { key: 'ig_rate',       label: 'Instagram',  icon: '📸' },
  { key: 'tiktok_rate',   label: 'TikTok',     icon: '🎵' },
  { key: 'snapchat_rate', label: 'Snapchat',   icon: '👻' },
  { key: 'facebook_rate', label: 'Facebook',   icon: '👤' },
  { key: 'package_rate',  label: 'Package',    icon: '📦' },
];

/* ── Tier badge ─────────────────────────────────────────────────────────── */

const TIER_COLORS: Record<string, string> = {
  nano:   'bg-gray-700 text-gray-300',
  micro:  'bg-blue-900/50 text-blue-300',
  macro:  'bg-purple-900/50 text-purple-300',
  mega:   'bg-amber-900/50 text-amber-300',
};

/* ── Stat pill ──────────────────────────────────────────────────────────── */

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center px-4 py-3 bg-surface-overlay rounded-xl border border-surface-border print:border-gray-200 print:rounded-xl">
      <p className="text-lg font-bold text-white print:text-black">{value}</p>
      <p className="text-[11px] text-gray-500 print:text-gray-600 mt-0.5">{label}</p>
    </div>
  );
}

/* ── Post thumbnail ─────────────────────────────────────────────────────── */

function PostCard({ post }: { post: InfluencerPost }) {
  return (
    <div className="rounded-xl overflow-hidden bg-surface-overlay border border-surface-border print:border-gray-200 aspect-square relative group">
      {post.thumbnail_url ? (
        <img
          src={post.thumbnail_url}
          alt={post.caption || 'Post'}
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-3xl">
          {PLATFORM_META[post.platform?.toLowerCase() || '']?.emoji || '🖼️'}
        </div>
      )}
      {(post.likes || post.views) ? (
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-[10px] text-white flex gap-2">
          {!!post.likes && <span>♥ {formatFollowers(post.likes)}</span>}
          {!!post.views && <span>▶ {formatFollowers(post.views)}</span>}
        </div>
      ) : null}
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function InfluencerMediaKitPage() {
  const { id } = useParams<{ id: string }>();

  const { data: influencer, isLoading } = useQuery({
    queryKey: ['influencer', id],
    queryFn: () => getInfluencer(id!),
    enabled: !!id,
  });

  const { data: livePosts = [] } = useQuery({
    queryKey: ['influencer-posts', id],
    queryFn: () => getInfluencerPosts(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <div className="skeleton h-8 w-48" />
        <div className="card p-8 space-y-4">
          <div className="flex gap-6 items-start">
            <div className="skeleton w-24 h-24 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-7 w-48" />
              <div className="skeleton h-4 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[0,1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!influencer) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <p className="text-gray-400">Influencer not found.</p>
        <Link to="/influencers" className="btn-secondary btn-sm mt-4">Back to Roster</Link>
      </div>
    );
  }

  const inf = influencer as Influencer;
  const name = inf.name_english || inf.name_arabic || inf.ig_handle || 'Influencer';
  const platformStats = (inf.platform_stats || []) as PlatformStat[];
  // Prefer live API posts, fall back to cached top_posts on influencer record
  const topPosts = ((livePosts as InfluencerPost[]).length > 0
    ? (livePosts as InfluencerPost[])
    : (inf.top_posts || []) as InfluencerPost[]
  ).slice(0, 9);

  /* Build platform stat rows from platform_stats + fallback to legacy fields */
  const statsToShow: { platform: string; followers: number; engRate?: number; avgViews?: number }[] = [];

  if (platformStats.length > 0) {
    platformStats.forEach(s => {
      if (s.follower_count && s.follower_count > 0) {
        statsToShow.push({
          platform: s.platform,
          followers: s.follower_count,
          engRate: s.avg_engagement_rate,
          avgViews: s.avg_views,
        });
      }
    });
  } else {
    // Fallback to stored fields
    if (inf.ig_followers)       statsToShow.push({ platform: 'instagram', followers: inf.ig_followers, engRate: inf.ig_engagement_rate });
    if (inf.tiktok_followers)   statsToShow.push({ platform: 'tiktok',    followers: inf.tiktok_followers, engRate: inf.tiktok_engagement_rate });
    if (inf.snap_followers)     statsToShow.push({ platform: 'snapchat',  followers: inf.snap_followers, engRate: inf.snap_engagement_rate });
    if (inf.fb_followers)       statsToShow.push({ platform: 'facebook',  followers: inf.fb_followers, engRate: inf.fb_engagement_rate });
    if (inf.youtube_followers)  statsToShow.push({ platform: 'youtube',   followers: inf.youtube_followers });
  }

  const totalReach = statsToShow.reduce((acc, s) => acc + s.followers, 0);

  const infRecord = inf as unknown as Record<string, unknown>;
  const rateEntries = RATE_PLATFORMS
    .filter(r => !!infRecord[r.key])
    .map(r => ({ ...r, rate: infRecord[r.key] as number }));

  const hasRates = rateEntries.length > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-4 print:space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          to={`/influencers/${id}`}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Profile
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success('Link copied to clipboard');
            }}
            className="btn-secondary btn-sm flex items-center gap-2"
          >
            <Copy className="w-4 h-4" /> Copy Link
          </button>
          <button
            onClick={() => window.print()}
            className="btn-secondary btn-sm flex items-center gap-2"
          >
            <Printer className="w-4 h-4" /> Print / PDF
          </button>
        </div>
      </div>

      {/* Header card */}
      <div className="card p-8 print:border print:border-gray-200 print:rounded-2xl print:bg-white">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="shrink-0">
            {inf.profile_photo_url ? (
              <img
                src={inf.profile_photo_url}
                alt={name}
                className="w-24 h-24 rounded-2xl object-cover border-2 border-surface-border print:border-gray-200"
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-surface-overlay border-2 border-surface-border print:border-gray-200 flex items-center justify-center">
                <span className="text-3xl font-bold text-gray-500">
                  {name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Name / meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-white print:text-black">{name}</h1>
              {inf.mawthouq_certificate === 1 && (
                <span className="flex items-center gap-1 text-xs text-emerald-400 print:text-emerald-600 font-medium">
                  <CheckCircle className="w-3.5 h-3.5" /> Verified
                </span>
              )}
              {inf.account_tier && (
                <span className={cn('badge text-xs capitalize', TIER_COLORS[inf.account_tier.toLowerCase()] || TIER_COLORS.micro)}>
                  {inf.account_tier}
                </span>
              )}
            </div>

            {inf.name_arabic && inf.name_english && (
              <p className="text-sm text-gray-400 print:text-gray-600 mt-0.5" dir="rtl">{inf.name_arabic}</p>
            )}

            {/* Handles */}
            <div className="flex flex-wrap gap-3 mt-2">
              {inf.ig_handle && (
                <span className="text-sm text-gray-400 print:text-gray-600">📸 @{inf.ig_handle}</span>
              )}
              {inf.tiktok_handle && (
                <span className="text-sm text-gray-400 print:text-gray-600">🎵 @{inf.tiktok_handle}</span>
              )}
              {inf.snap_handle && (
                <span className="text-sm text-gray-400 print:text-gray-600">👻 @{inf.snap_handle}</span>
              )}
              {inf.youtube_handle && (
                <span className="text-sm text-gray-400 print:text-gray-600">▶️ @{inf.youtube_handle}</span>
              )}
            </div>

            {/* Location / language */}
            <div className="flex flex-wrap gap-4 mt-2">
              {(inf.country || inf.city) && (
                <span className="flex items-center gap-1 text-xs text-gray-500 print:text-gray-600">
                  <MapPin className="w-3 h-3" />
                  {[inf.city, inf.country].filter(Boolean).join(', ')}
                </span>
              )}
              {inf.nationality && (
                <span className="flex items-center gap-1 text-xs text-gray-500 print:text-gray-600">
                  <Globe className="w-3 h-3" /> {inf.nationality}
                </span>
              )}
              {inf.language && (
                <span className="text-xs text-gray-500 print:text-gray-600">🗣 {inf.language}</span>
              )}
            </div>

            {/* Categories */}
            <div className="flex flex-wrap gap-2 mt-3">
              {inf.main_category && (
                <span className="badge bg-surface-overlay border border-surface-border text-gray-300 text-xs print:border-gray-300 print:text-gray-700">
                  {inf.main_category}
                </span>
              )}
              {inf.sub_category_1 && (
                <span className="badge bg-surface-overlay border border-surface-border text-gray-400 text-xs print:border-gray-300 print:text-gray-600">
                  {inf.sub_category_1}
                </span>
              )}
              {inf.sub_category_2 && (
                <span className="badge bg-surface-overlay border border-surface-border text-gray-400 text-xs print:border-gray-300 print:text-gray-600">
                  {inf.sub_category_2}
                </span>
              )}
            </div>
          </div>

          {/* Trust score (screen) + QR code (always) */}
          <div className="shrink-0 flex flex-col items-center gap-3">
            {inf.trust_score != null && (
              <div className="text-center print:hidden">
                <div className="w-14 h-14 rounded-full border-2 border-amber-500/50 flex items-center justify-center bg-amber-900/20">
                  <span className="text-lg font-bold text-amber-400">{inf.trust_score}</span>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">Trust Score</p>
              </div>
            )}
            <div className="flex flex-col items-center gap-1">
              <div className="bg-white p-1.5 rounded-lg">
                <QRCodeSVG
                  value={`${window.location.origin}/p/${inf.id}`}
                  size={80}
                  level="M"
                />
              </div>
              <p className="text-[9px] text-gray-500 print:text-gray-500">Scan profile</p>
            </div>
          </div>
        </div>
      </div>

      {/* Reach summary pills */}
      {totalReach > 0 && (
        <div className={cn('grid gap-3', statsToShow.length === 1 ? 'grid-cols-2' : statsToShow.length === 2 ? 'grid-cols-3' : 'grid-cols-4')}>
          <StatPill label="Total Reach" value={formatFollowers(totalReach)} />
          {statsToShow.slice(0, 3).map(s => {
            const meta = PLATFORM_META[s.platform.toLowerCase()] || {};
            return (
              <StatPill
                key={s.platform}
                label={`${meta.emoji || ''} ${meta.label || s.platform} Followers`}
                value={formatFollowers(s.followers)}
              />
            );
          })}
        </div>
      )}

      {/* Platform breakdown */}
      {statsToShow.length > 0 && (
        <div className="card p-5 print:border print:border-gray-200 print:rounded-xl print:bg-white">
          <h2 className="text-sm font-semibold text-gray-300 print:text-black mb-4">Platform Stats</h2>
          <div className="space-y-3">
            {statsToShow.map(s => {
              const meta = PLATFORM_META[s.platform.toLowerCase()] || { label: s.platform, color: 'bg-surface-overlay text-gray-300 border border-surface-border', emoji: '📊' };
              return (
                <div key={s.platform} className="flex items-center gap-4">
                  <span className={cn('badge text-xs capitalize w-28 text-center shrink-0', meta.color)}>
                    {meta.emoji} {meta.label}
                  </span>
                  <div className="flex-1 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Followers</p>
                      <p className="font-semibold text-white print:text-black">{formatFollowers(s.followers)}</p>
                    </div>
                    {s.engRate != null && s.engRate > 0 && (
                      <div>
                        <p className="text-xs text-gray-500">Eng. Rate</p>
                        <p className="font-semibold text-white print:text-black">{s.engRate.toFixed(2)}%</p>
                      </div>
                    )}
                    {s.avgViews != null && s.avgViews > 0 && (
                      <div>
                        <p className="text-xs text-gray-500">Avg. Views</p>
                        <p className="font-semibold text-white print:text-black">{formatFollowers(s.avgViews)}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rate card */}
      {hasRates && (
        <div className="card p-5 print:border print:border-gray-200 print:rounded-xl print:bg-white">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-gray-300 print:text-black">Rate Card</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {rateEntries.map(r => (
              <div key={r.key} className="card p-4 bg-surface-overlay border border-surface-border print:border-gray-200 print:bg-white text-center">
                <p className="text-lg mb-1">{r.icon}</p>
                <p className="text-base font-bold text-white print:text-black">{formatRate(r.rate)}</p>
                <p className="text-xs text-gray-500 print:text-gray-600">{r.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-600 print:text-gray-500 mt-3">
            * Rates are indicative and may vary by campaign. Contact the agency for custom packages.
          </p>
        </div>
      )}

      {/* Top content */}
      {topPosts.length > 0 && (
        <div className="card p-5 print:border print:border-gray-200 print:rounded-xl print:bg-white">
          <h2 className="text-sm font-semibold text-gray-300 print:text-black mb-4">Top Content</h2>
          <div className="grid grid-cols-3 gap-3">
            {topPosts.map(post => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      )}

      {/* Bio / notes */}
      {inf.internal_notes && (
        <div className="card p-5 print:border print:border-gray-200 print:rounded-xl print:bg-white">
          <h2 className="text-sm font-semibold text-gray-300 print:text-black mb-3">About</h2>
          <p className="text-sm text-gray-300 print:text-black whitespace-pre-wrap leading-relaxed">
            {inf.internal_notes}
          </p>
        </div>
      )}

      {/* Contact & Verification */}
      {(inf.email || inf.phone_number || inf.mawthouq_certificate || inf.advertising_license_number) && (
        <div className="card p-5 print:border print:border-gray-200 print:rounded-xl print:bg-white">
          <h2 className="text-sm font-semibold text-gray-300 print:text-black mb-4">Contact &amp; Verification</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {inf.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-gray-500 shrink-0" />
                <a href={`mailto:${inf.email}`} className="text-blue-400 hover:text-blue-300 print:text-blue-700">
                  {inf.email}
                </a>
              </div>
            )}
            {inf.phone_number && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-gray-500 shrink-0" />
                <span className="text-gray-300 print:text-black">{inf.phone_number}</span>
              </div>
            )}
            {!!inf.mawthouq_certificate && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-emerald-400 print:text-emerald-700 font-medium">Mawthouq Certified</span>
              </div>
            )}
            {inf.advertising_license_number && (
              <div className="flex items-center gap-2 text-sm">
                <Shield className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-gray-400 print:text-gray-600">License: {inf.advertising_license_number}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Print footer */}
      <div className="hidden print:block text-center text-xs text-gray-500 border-t border-gray-200 pt-4 mt-8">
        Confidential — Media Kit generated by FALAK · {new Date().toLocaleDateString()}
      </div>
    </div>
  );
}
