/**
 * AdminAnalyticsPage — Platform-wide analytics dashboard.
 * Pure CSS/Tailwind visualisations — no chart library needed.
 */
import { useQuery } from '@tanstack/react-query';
import { Users, Megaphone, TrendingUp, Radio } from 'lucide-react';
import { getAnalyticsOverview, getAnalyticsGrowth } from '../../utils/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OverviewData {
  total_influencers: number;
  total_campaigns: number;
  active_campaigns: number;
  total_offers: number;
  offers_accepted: number;
  offers_pending: number;
  offers_declined: number;
  total_reach: number;
  acceptance_rate: number;
  by_platform: { instagram: number; tiktok: number; youtube: number; snapchat: number };
  by_tier: { nano: number; micro: number; macro: number; mega: number };
  top_categories: { category: string; count: number }[];
  recent_signups: number;
}

interface GrowthDay {
  date: string;
  influencers: number;
  offers: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="card flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400 uppercase tracking-widest font-medium">{label}</span>
        <span className={`p-2 rounded-lg ${accent ?? 'bg-[#2a2a2a]'}`}>
          <Icon className="w-4 h-4 text-gray-300" />
        </span>
      </div>
      <div className="text-3xl font-bold text-white tracking-tight">{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

function DistBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-xs text-gray-400 capitalize shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-xs text-gray-300 text-right">{value}</span>
    </div>
  );
}

function GrowthChart({ days }: { days: GrowthDay[] }) {
  const maxInfluencers = Math.max(...days.map((d) => d.influencers), 1);
  const maxOffers = Math.max(...days.map((d) => d.offers), 1);
  const overallMax = Math.max(maxInfluencers, maxOffers, 1);

  // Show every 5th date label to avoid crowding
  return (
    <div className="flex items-end gap-[3px] h-36 w-full">
      {days.map((day, i) => (
        <div key={day.date} className="flex-1 flex flex-col items-center gap-[2px] group relative">
          {/* Tooltip */}
          <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-10 hidden group-hover:flex flex-col items-center pointer-events-none">
            <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded px-2 py-1 text-[10px] text-white whitespace-nowrap shadow-lg">
              <div className="font-semibold">{day.date}</div>
              <div className="text-blue-400">+{day.influencers} signups</div>
              <div className="text-violet-400">+{day.offers} offers</div>
            </div>
          </div>

          {/* Influencer bar */}
          <div
            className="w-full bg-blue-500/70 rounded-sm transition-all duration-300"
            style={{ height: `${Math.max((day.influencers / overallMax) * 128, day.influencers > 0 ? 3 : 0)}px` }}
          />
          {/* Offer bar */}
          <div
            className="w-full bg-violet-500/60 rounded-sm transition-all duration-300"
            style={{ height: `${Math.max((day.offers / overallMax) * 128, day.offers > 0 ? 3 : 0)}px` }}
          />

          {/* Date label every 5 days */}
          {i % 5 === 0 && (
            <span className="text-[9px] text-gray-600 mt-1 rotate-0 whitespace-nowrap">
              {shortDate(day.date)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const {
    data: overview,
    isLoading: loadingOverview,
    isError: errorOverview,
  } = useQuery<OverviewData>({
    queryKey: ['analytics-overview'],
    queryFn: getAnalyticsOverview,
    staleTime: 60_000,
  });

  const {
    data: growthData,
    isLoading: loadingGrowth,
  } = useQuery<{ growth: GrowthDay[] }>({
    queryKey: ['analytics-growth'],
    queryFn: getAnalyticsGrowth,
    staleTime: 60_000,
  });

  const isLoading = loadingOverview || loadingGrowth;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (errorOverview || !overview) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-400 text-sm">Failed to load analytics data.</p>
      </div>
    );
  }

  const platformMax = Math.max(
    overview.by_platform.instagram,
    overview.by_platform.tiktok,
    overview.by_platform.youtube,
    overview.by_platform.snapchat,
    1
  );

  const tierMax = Math.max(
    overview.by_tier.nano,
    overview.by_tier.micro,
    overview.by_tier.macro,
    overview.by_tier.mega,
    1
  );

  const growth = growthData?.growth ?? [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Page title ─────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-white">Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">Platform-wide overview · last 30 days</p>
      </div>

      {/* ── Row 1: Stat cards ───────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Influencers"
          value={formatNumber(overview.total_influencers)}
          sub={`+${overview.recent_signups} last 30 days`}
          accent="bg-blue-500/15"
        />
        <StatCard
          icon={Megaphone}
          label="Active Campaigns"
          value={overview.active_campaigns}
          sub={`${overview.total_campaigns} total campaigns`}
          accent="bg-green-500/15"
        />
        <StatCard
          icon={TrendingUp}
          label="Acceptance Rate"
          value={`${overview.acceptance_rate}%`}
          sub={`${overview.offers_accepted} of ${overview.total_offers} offers`}
          accent="bg-violet-500/15"
        />
        <StatCard
          icon={Radio}
          label="Total Reach"
          value={formatNumber(overview.total_reach)}
          sub="Cumulative followers across platforms"
          accent="bg-orange-500/15"
        />
      </div>

      {/* ── Row 2: Platform + Tier distribution ─────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Platform distribution */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Platform Distribution</h2>
          <div className="space-y-3">
            <DistBar label="Instagram" value={overview.by_platform.instagram} max={platformMax} color="bg-pink-500" />
            <DistBar label="TikTok"    value={overview.by_platform.tiktok}    max={platformMax} color="bg-cyan-400" />
            <DistBar label="YouTube"   value={overview.by_platform.youtube}   max={platformMax} color="bg-red-500" />
            <DistBar label="Snapchat"  value={overview.by_platform.snapchat}  max={platformMax} color="bg-yellow-400" />
          </div>
        </div>

        {/* Tier distribution */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Tier Distribution</h2>
          <div className="space-y-3">
            <DistBar label="Nano"  value={overview.by_tier.nano}  max={tierMax} color="bg-emerald-400" />
            <DistBar label="Micro" value={overview.by_tier.micro} max={tierMax} color="bg-blue-400" />
            <DistBar label="Macro" value={overview.by_tier.macro} max={tierMax} color="bg-violet-400" />
            <DistBar label="Mega"  value={overview.by_tier.mega}  max={tierMax} color="bg-orange-400" />
          </div>
          <div className="pt-2 border-t border-[#2a2a2a] grid grid-cols-2 gap-2 text-xs text-gray-400">
            <span>Offers pending: <span className="text-white">{overview.offers_pending}</span></span>
            <span>Offers declined: <span className="text-white">{overview.offers_declined}</span></span>
          </div>
        </div>
      </div>

      {/* ── Row 3: Growth chart ──────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">30-Day Growth</h2>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500/70 inline-block" />
              Signups
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-violet-500/60 inline-block" />
              Offers
            </span>
          </div>
        </div>

        {growth.length > 0 ? (
          <GrowthChart days={growth} />
        ) : (
          <div className="h-36 flex items-center justify-center text-gray-600 text-sm">
            No growth data available yet
          </div>
        )}
      </div>

      {/* ── Row 4: Top categories + Recent offer breakdown ───── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Top categories table */}
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">Top Categories</h2>
          {overview.top_categories.length === 0 ? (
            <p className="text-sm text-gray-500">No category data yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-[#2a2a2a]">
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 font-medium text-right">Influencers</th>
                  <th className="pb-2 font-medium text-right w-24">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {overview.top_categories.map((cat) => {
                  const pct =
                    overview.total_influencers > 0
                      ? Math.round((cat.count / overview.total_influencers) * 100)
                      : 0;
                  return (
                    <tr key={cat.category} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 text-gray-200">{cat.category}</td>
                      <td className="py-2.5 text-right text-gray-300">{cat.count}</td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-12 h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Offer funnel breakdown */}
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">Offer Funnel</h2>
          <div className="space-y-4">

            {/* Total */}
            <div className="flex items-center justify-between py-2 border-b border-[#2a2a2a]">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Total Offers</span>
              <span className="text-xl font-bold text-white">{overview.total_offers}</span>
            </div>

            {/* Status rows */}
            {[
              { label: 'Accepted', value: overview.offers_accepted, color: 'bg-green-500' },
              { label: 'Pending',  value: overview.offers_pending,  color: 'bg-yellow-400' },
              { label: 'Declined', value: overview.offers_declined, color: 'bg-red-500'   },
            ].map(({ label, value, color }) => {
              const pct =
                overview.total_offers > 0
                  ? Math.round((value / overview.total_offers) * 100)
                  : 0;
              return (
                <div key={label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">{label}</span>
                    <span className="text-white">
                      {value} <span className="text-gray-500">({pct}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Acceptance rate highlight */}
            <div className="mt-4 p-3 rounded-lg bg-[#1c1c1c] border border-[#2a2a2a] text-center">
              <div className="text-2xl font-bold text-white">{overview.acceptance_rate}%</div>
              <div className="text-xs text-gray-500 mt-0.5">Acceptance Rate</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
