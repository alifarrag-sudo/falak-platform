/**
 * Agency Home Dashboard — KPI overview, recent campaigns, offer status breakdown, quick actions.
 */
import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users, Megaphone, FileText, Compass, Upload, DollarSign,
  TrendingUp, Clock, CheckCircle, XCircle, ArrowRight,
  LayoutDashboard, AlertCircle, Handshake, CalendarDays, X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getCampaigns, getOfferStats, getPaymentSummary, getInfluencers, getOffers } from '../utils/api';
import { cn, formatDate } from '../utils/helpers';
import type { Campaign } from '../types';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: React.ElementType; color: string; sub?: string;
}) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  pending:     'bg-surface-subtle text-gray-400 border border-surface-border',
  sent:        'bg-blue-900/40 text-blue-300 border border-blue-800/40',
  accepted:    'bg-emerald-900/40 text-emerald-300 border border-emerald-800/40',
  declined:    'bg-red-900/40 text-red-300 border border-red-800/40',
  in_progress: 'bg-amber-900/40 text-amber-300 border border-amber-800/40',
  submitted:   'bg-purple-900/40 text-purple-300 border border-purple-800/40',
  approved:    'bg-emerald-900/60 text-emerald-200 border border-emerald-700/40',
  completed:   'bg-gray-700 text-gray-300 border border-gray-600',
};

const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  active:    'bg-emerald-900/40 text-emerald-300 border border-emerald-800/40',
  completed: 'bg-purple-900/40 text-purple-300 border border-purple-800/40',
  draft:     'bg-surface-overlay text-gray-400 border border-surface-border',
  paused:    'bg-amber-900/40 text-amber-300 border border-amber-800/40',
};

const ONBOARDING_DISMISSED_KEY = 'falak_onboarding_dismissed';

export default function AgencyDashboard() {
  const { user } = useAuth();
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(ONBOARDING_DISMISSED_KEY) === 'true') {
      setOnboardingDismissed(true);
    }
  }, []);

  const { data: influencerData } = useQuery({
    queryKey: ['agency-dash-influencers'],
    queryFn: () => getInfluencers({ page: 1, limit: 1 }),
  });

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ['agency-dash-campaigns'],
    queryFn: getCampaigns,
  });

  const { data: offerStats } = useQuery({
    queryKey: ['agency-dash-offer-stats'],
    queryFn: getOfferStats,
  });

  const { data: paymentSummary } = useQuery({
    queryKey: ['agency-dash-payments'],
    queryFn: getPaymentSummary,
  });

  const { data: sentOffersData } = useQuery({
    queryKey: ['agency-dash-sent-offers'],
    queryFn: () => getOffers({ status: 'sent', limit: '20' }),
    staleTime: 60000,
  });

  const { data: onboardingInfluencerData } = useQuery({
    queryKey: ['influencers', { limit: 1 }],
    queryFn: () => getInfluencers({ page: 1, limit: 1 }),
  });

  const { data: onboardingCampaigns = [] } = useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: getCampaigns,
  });

  // Computed values
  const rosterSize     = influencerData?.pagination?.total ?? 0;
  const activeCampaigns = campaigns.filter((c: Campaign) => c.status === 'active').length;
  const openOffers     = useMemo(() => {
    if (!offerStats) return 0;
    return (offerStats['pending'] || 0) + (offerStats['sent'] || 0) + (offerStats['accepted'] || 0);
  }, [offerStats]);

  const outstanding = paymentSummary?.total_unpaid ?? 0;
  const currency = 'SAR';

  const recentCampaigns = campaigns.slice(0, 5);

  const onboardingInfluencerCount = onboardingInfluencerData?.pagination?.total ?? 0;
  const onboardingCampaignCount = onboardingCampaigns.length;
  const showOnboarding =
    !onboardingDismissed &&
    onboardingInfluencerCount < 5 &&
    onboardingCampaignCount < 2;

  const onboardingItems = [
    { label: 'Add your first influencer', link: '/influencers', done: onboardingInfluencerCount >= 1 },
    { label: 'Create your first campaign', link: '/campaigns',  done: onboardingCampaignCount >= 1 },
    { label: 'Send your first offer',      link: '/offers',     done: (offerStats ? Object.values(offerStats).reduce((a, b) => a + b, 0) : 0) >= 1 },
    { label: 'Connect social accounts',    link: '/settings',   done: false },
    { label: 'Try Discover',               link: '/discover',   done: false },
  ];

  const onboardingComplete = onboardingItems.filter(i => i.done).length;

  const staleOffers = useMemo(() => {
    const offers: Record<string, unknown>[] = sentOffersData?.data || [];
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    return offers.filter((o) => {
      const sent = o.created_at ? new Date(o.created_at as string).getTime() : 0;
      return sent < threeDaysAgo;
    }).slice(0, 5);
  }, [sentOffersData]);

  const offerStatusEntries = useMemo(() => {
    if (!offerStats) return [];
    return Object.entries(offerStats)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a);
  }, [offerStats]);

  const handleDismissOnboarding = () => {
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, 'true');
    setOnboardingDismissed(true);
  };

  const quickActions = [
    { to: '/influencers', icon: Users,          label: 'Influencers',  desc: 'Browse & manage roster' },
    { to: '/campaigns',   icon: Megaphone,      label: 'Campaigns',    desc: 'View all campaigns' },
    { to: '/deals',       icon: Handshake,      label: 'Deals',        desc: 'Active deal tracker' },
    { to: '/calendar',    icon: CalendarDays,   label: 'Calendar',     desc: 'Campaign calendar' },
    { to: '/offers',      icon: FileText,       label: 'Offers',       desc: 'Track sent offers' },
    { to: '/discover',    icon: Compass,        label: 'Discover',     desc: 'Find new creators' },
    { to: '/payments',    icon: DollarSign,     label: 'Payments',     desc: 'Payment tracker' },
    { to: '/import',      icon: Upload,         label: 'Import',       desc: 'Bulk import influencers' },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          {greeting()}, {user?.display_name || user?.email?.split('@')[0] || 'Agency'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">Here's your agency overview for today.</p>
      </div>

      {/* Onboarding checklist */}
      {showOnboarding && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Getting started</p>
              <p className="text-xs text-gray-500 mt-0.5">{onboardingComplete}/5 steps complete</p>
            </div>
            <button
              onClick={handleDismissOnboarding}
              className="text-gray-600 hover:text-gray-300 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 bg-surface-overlay rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${(onboardingComplete / onboardingItems.length) * 100}%` }}
            />
          </div>
          {/* Checklist items */}
          <div className="space-y-1.5 pt-1">
            {onboardingItems.map(item => (
              <Link
                key={item.link}
                to={item.link}
                className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-surface-overlay transition-colors group"
              >
                <div className={cn(
                  'w-5 h-5 rounded-full border flex items-center justify-center shrink-0',
                  item.done
                    ? 'bg-emerald-500 border-emerald-500'
                    : 'border-surface-border bg-surface-overlay'
                )}>
                  {item.done && <CheckCircle className="w-3 h-3 text-white" />}
                </div>
                <span className={cn(
                  'text-sm',
                  item.done ? 'line-through text-gray-500' : 'text-gray-300 group-hover:text-white'
                )}>
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Influencers in Roster"
          value={rosterSize}
          icon={Users}
          color="bg-blue-900/40 text-blue-400"
        />
        <StatCard
          label="Active Campaigns"
          value={activeCampaigns}
          icon={Megaphone}
          color="bg-emerald-900/40 text-emerald-400"
          sub={`${campaigns.length} total`}
        />
        <StatCard
          label="Open Offers"
          value={openOffers}
          icon={TrendingUp}
          color="bg-purple-900/40 text-purple-400"
        />
        <StatCard
          label="Outstanding"
          value={outstanding > 0 ? `${currency} ${outstanding.toLocaleString()}` : '—'}
          icon={DollarSign}
          color="bg-amber-900/40 text-amber-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent campaigns */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-surface-border">
            <p className="text-sm font-semibold text-gray-300">Recent Campaigns</p>
            <Link to="/campaigns" className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {recentCampaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Megaphone className="w-8 h-8 text-gray-600 mb-2" />
              <p className="text-sm text-gray-500">No campaigns yet</p>
              <Link to="/campaigns" className="text-xs text-blue-400 hover:underline mt-1">Create one →</Link>
            </div>
          ) : (
            <div className="divide-y divide-surface-border/50">
              {recentCampaigns.map((c: Campaign) => (
                <Link
                  key={c.id}
                  to={`/campaigns/${c.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-surface-overlay transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-surface-overlay flex items-center justify-center text-gray-400 shrink-0">
                    {c.status === 'completed'
                      ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      : c.status === 'active'
                      ? <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                      : <Clock className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.platform_focus || 'Multi-platform'} · {formatDate(c.created_at)}</p>
                  </div>
                  <span className={cn('badge text-xs capitalize shrink-0', CAMPAIGN_STATUS_COLORS[c.status] || CAMPAIGN_STATUS_COLORS.draft)}>
                    {c.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Offer status breakdown */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-surface-border">
            <p className="text-sm font-semibold text-gray-300">Offer Status Breakdown</p>
            <Link to="/offers" className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {offerStatusEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <FileText className="w-8 h-8 text-gray-600 mb-2" />
              <p className="text-sm text-gray-500">No offers yet</p>
            </div>
          ) : (
            <div className="px-5 py-4 space-y-3">
              {offerStatusEntries.map(([status, count]) => (
                <div key={status} className="flex items-center gap-3">
                  <span className={cn('badge text-xs capitalize w-24 text-center shrink-0', STATUS_COLORS[status] || STATUS_COLORS.pending)}>
                    {status.replace('_', ' ')}
                  </span>
                  <div className="flex-1 h-2 bg-surface-overlay rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-white/20"
                      style={{ width: `${Math.min(100, (count / Math.max(...Object.values(offerStats || {}))) * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-300 w-6 text-right shrink-0">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stale offers — needs follow-up */}
      {staleOffers.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-surface-border">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <p className="text-sm font-semibold text-gray-300">Awaiting Response</p>
              <span className="badge bg-amber-900/40 text-amber-300 border border-amber-800/40 text-xs">
                {staleOffers.length}
              </span>
            </div>
            <Link to="/offers" className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-surface-border/50">
            {staleOffers.map((o) => (
              <Link
                key={String(o.id)}
                to="/offers"
                className="flex items-center gap-3 px-5 py-3 hover:bg-surface-overlay transition-colors"
              >
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{String(o.title || 'Untitled Offer')}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {String(o.influencer_name || '')} · Sent {formatDate(String(o.created_at || ''))}
                  </p>
                </div>
                <span className="text-xs text-amber-400 shrink-0">Follow up →</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <p className="text-sm font-semibold text-gray-400 mb-3">Quick Actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {quickActions.map(({ to, icon: Icon, label, desc }) => (
            <Link
              key={to}
              to={to}
              className="card p-4 hover:bg-surface-overlay transition-colors group flex flex-col items-center text-center gap-2"
            >
              <div className="w-9 h-9 rounded-xl bg-surface-overlay border border-surface-border flex items-center justify-center text-gray-400 group-hover:text-white transition-colors">
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-white">{label}</p>
                <p className="text-[10px] text-gray-600 mt-0.5 hidden sm:block">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
