/**
 * Talent Manager Dashboard — overview of the manager's roster and offer activity.
 * Stat cards: Roster size, Active Offers, Pending Offers, Completed This Month.
 * Recent offers table (last 10).
 * Quick action links.
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users, Send, Clock, CheckCircle, ArrowRight,
  Briefcase, DollarSign, BarChart2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getInfluencers, getOffers, getOfferStats } from '../../utils/api';
import { cn, formatDate, formatRate } from '../../utils/helpers';

/* ── Status badge colours ────────────────────────────────────────────── */
const STATUS_STYLES: Record<string, string> = {
  pending:     'bg-surface-subtle text-gray-300 border border-surface-border',
  sent:        'bg-blue-900/40 text-blue-300 border border-blue-800/40',
  accepted:    'bg-emerald-900/40 text-emerald-300 border border-emerald-800/40',
  declined:    'bg-red-900/40 text-red-300 border border-red-800/40',
  completed:   'bg-emerald-800/60 text-emerald-200 border border-emerald-700/40',
  in_progress: 'bg-amber-900/40 text-amber-300 border border-amber-800/40',
  submitted:   'bg-purple-900/40 text-purple-300 border border-purple-800/40',
  approved:    'bg-emerald-900/60 text-emerald-200 border border-emerald-700/40',
};

/* ── Stat card ───────────────────────────────────────────────────────── */
function StatCard({
  label, value, icon: Icon, color, loading,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  loading?: boolean;
}) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        {loading ? (
          <div className="skeleton h-7 w-12 mb-1" />
        ) : (
          <p className="text-2xl font-bold text-white">{value}</p>
        )}
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

/* ── Dashboard ───────────────────────────────────────────────────────── */
export default function ManagerDashboard() {
  const { user } = useAuth();

  /* Roster count */
  const { data: rosterData, isLoading: rosterLoading } = useQuery({
    queryKey: ['manager-roster-count'],
    queryFn: () => getInfluencers({ page: 1, limit: 1 }),
    refetchInterval: 60_000,
  });

  /* Offer stats (per-status counts) */
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['manager-offer-stats'],
    queryFn: getOfferStats,
    refetchInterval: 30_000,
  });

  /* Recent 10 offers for the table */
  const { data: recentOffersData, isLoading: offersLoading } = useQuery({
    queryKey: ['manager-recent-offers'],
    queryFn: () => getOffers({ limit: '10' }),
    refetchInterval: 30_000,
  });

  /* Normalise offers array */
  type Offer = Record<string, unknown>;
  const recentOffers: Offer[] = Array.isArray(recentOffersData)
    ? recentOffersData
    : (recentOffersData as { offers?: Offer[] } | undefined)?.offers
      ?? (recentOffersData as { data?: Offer[] } | undefined)?.data
      ?? [];

  const stats = statsData as Record<string, number> | undefined;

  /* Completed this month — derive from offer stats if available */
  const rosterCount   = rosterData?.pagination?.total ?? 0;
  const activeOffers  = (stats?.accepted ?? 0) + (stats?.in_progress ?? 0);
  const pendingOffers = stats?.pending ?? 0;
  const completedMTD  = stats?.completed ?? 0;

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Talent Manager Dashboard
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Welcome back, {user?.display_name || 'Manager'}. Here's your roster at a glance.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Roster"
          value={rosterCount}
          icon={Users}
          color="bg-blue-900/40 text-blue-400"
          loading={rosterLoading}
        />
        <StatCard
          label="Active Offers"
          value={activeOffers}
          icon={Send}
          color="bg-purple-900/40 text-purple-400"
          loading={statsLoading}
        />
        <StatCard
          label="Pending Offers"
          value={pendingOffers}
          icon={Clock}
          color="bg-amber-900/40 text-amber-400"
          loading={statsLoading}
        />
        <StatCard
          label="Completed This Month"
          value={completedMTD}
          icon={CheckCircle}
          color="bg-emerald-900/40 text-emerald-400"
          loading={statsLoading}
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            to: '/manager/roster',
            icon: Users,
            label: 'View Roster',
            desc: 'Browse and manage your talent list',
          },
          {
            to: '/manager/offers',
            icon: Briefcase,
            label: 'Browse Offers',
            desc: 'Track all influencer offers',
          },
          {
            to: '/manager/earnings',
            icon: DollarSign,
            label: 'View Earnings',
            desc: 'Earnings summary and deal history',
          },
        ].map(({ to, icon: Icon, label, desc }) => (
          <Link
            key={to}
            to={to}
            className="card p-4 hover:bg-surface-overlay transition-colors group flex items-start gap-3"
          >
            <div className="w-9 h-9 rounded-lg bg-surface-overlay border border-surface-border flex items-center justify-center text-gray-400 group-hover:text-white shrink-0 transition-colors">
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">{label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 shrink-0 ml-auto mt-0.5 transition-colors" />
          </Link>
        ))}
      </div>

      {/* Recent Offers table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-gray-500" />
            <p className="text-sm font-semibold text-gray-300">Recent Offers</p>
          </div>
          <Link
            to="/manager/offers"
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors"
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {offersLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-40" />
                  <div className="skeleton h-3 w-28" />
                </div>
                <div className="skeleton h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : recentOffers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Send className="w-8 h-8 text-gray-600 mb-3" />
            <p className="text-sm text-gray-400">No offers yet</p>
            <p className="text-xs text-gray-500 mt-1">
              Offers sent to your roster will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Influencer</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Campaign</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Title</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Status</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">Rate</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]/50">
                {recentOffers.map((offer) => {
                  const id             = String(offer.id ?? '');
                  const influencerName = String(offer.influencer_name ?? '—');
                  const campaignName   = String(offer.campaign_name ?? '—');
                  const title          = String(offer.title ?? '—');
                  const status         = String(offer.status ?? 'pending');
                  const rate           = offer.rate ? Number(offer.rate) : null;
                  const currency       = String(offer.currency ?? 'SAR');
                  const createdAt      = offer.created_at ? String(offer.created_at) : undefined;

                  return (
                    <tr key={id} className="hover:bg-surface-overlay transition-colors">
                      <td className="px-5 py-3 text-white font-medium whitespace-nowrap">{influencerName}</td>
                      <td className="px-5 py-3 text-gray-400 whitespace-nowrap">{campaignName}</td>
                      <td className="px-5 py-3 text-gray-300 max-w-[180px] truncate">{title}</td>
                      <td className="px-5 py-3">
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                          STATUS_STYLES[status] || STATUS_STYLES.pending
                        )}>
                          {status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-gray-300 whitespace-nowrap font-mono text-xs">
                        {rate ? formatRate(rate, currency) : '—'}
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {createdAt ? formatDate(createdAt) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
