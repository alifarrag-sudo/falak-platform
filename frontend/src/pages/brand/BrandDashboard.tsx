/**
 * Brand Dashboard — overview stats, recent offers/requests, quick actions.
 * Stat cards: Total Campaigns, Active Offers, Influencers Worked With, Pending Responses
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Megaphone, Users, Send, Clock, Plus, ArrowRight,
  TrendingUp, CheckCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getCampaigns, getOffers } from '../../utils/api';
import type { Campaign } from '../../types';
import { cn, formatDate } from '../../utils/helpers';

/* ── Stat Card ──────────────────────────────────────────────────────── */
function StatCard({
  label, value, icon: Icon, color, sub,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  sub?: string;
}) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', color)}>
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

/* ── Status badge ───────────────────────────────────────────────────── */
const OFFER_STATUS_COLORS: Record<string, string> = {
  pending:     'bg-amber-900/40 text-amber-300 border border-amber-800/40',
  sent:        'bg-blue-900/40 text-blue-300 border border-blue-800/40',
  accepted:    'bg-emerald-900/40 text-emerald-300 border border-emerald-800/40',
  declined:    'bg-red-900/40 text-red-300 border border-red-800/40',
  in_progress: 'bg-purple-900/40 text-purple-300 border border-purple-800/40',
  completed:   'bg-gray-800 text-gray-300 border border-gray-700',
};

/* ── Dashboard ──────────────────────────────────────────────────────── */
export default function BrandDashboard() {
  const { user } = useAuth();

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ['brand-campaigns'],
    queryFn: getCampaigns,
  });

  const { data: offersData } = useQuery({
    queryKey: ['brand-offers'],
    queryFn: () => getOffers({ limit: '20' }),
  });

  // Normalise offers to an array
  const allOffers: Record<string, unknown>[] = Array.isArray(offersData)
    ? offersData
    : (offersData as { offers?: Record<string, unknown>[] })?.offers ?? [];

  // Computed stats
  const totalCampaigns   = campaigns.length;
  const activeCampaigns  = campaigns.filter((c: Campaign) => c.status === 'active').length;
  const activeOffers     = allOffers.filter(o => ['sent', 'in_progress'].includes(String(o.status))).length;
  const pendingOffers    = allOffers.filter(o => o.status === 'pending').length;
  const influencerIds    = new Set(allOffers.map(o => o.influencer_id).filter(Boolean));
  const influencersCount = influencerIds.size;

  // Recent 5 offers for the table
  const recentOffers = allOffers.slice(0, 5);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {user?.display_name || 'Brand'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Here's a snapshot of your brand's activity.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Campaigns"
          value={totalCampaigns}
          icon={Megaphone}
          color="bg-blue-900/40 text-blue-400"
          sub={`${activeCampaigns} active`}
        />
        <StatCard
          label="Active Offers"
          value={activeOffers}
          icon={Send}
          color="bg-purple-900/40 text-purple-400"
        />
        <StatCard
          label="Influencers Worked With"
          value={influencersCount}
          icon={Users}
          color="bg-emerald-900/40 text-emerald-400"
        />
        <StatCard
          label="Pending Responses"
          value={pendingOffers}
          icon={Clock}
          color="bg-amber-900/40 text-amber-400"
        />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Link to="/brand/influencers" className="btn-primary">
          <Users className="w-4 h-4" />
          Browse Influencers
        </Link>
        <Link to="/brand/campaigns" className="btn-secondary">
          <Plus className="w-4 h-4" />
          New Campaign
        </Link>
      </div>

      {/* Recent offers / requests table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a2a]">
          <p className="text-sm font-semibold text-gray-300">Recent Offers &amp; Requests</p>
          <Link to="/brand/campaigns" className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {recentOffers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Send className="w-8 h-8 text-gray-600 mb-3" />
            <p className="text-sm text-gray-400">No offers yet</p>
            <p className="text-xs text-gray-500 mt-1">
              Start by browsing influencers and sending a campaign request.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Title</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Platform</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Deadline</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]/50">
                {recentOffers.map((offer) => {
                  const id       = String(offer.id);
                  const title    = String(offer.title || '—');
                  const platform = String(offer.platform || '—');
                  const deadline = offer.deadline ? formatDate(String(offer.deadline)) : '—';
                  const status   = String(offer.status || 'pending');

                  return (
                    <tr key={id} className="hover:bg-[#1c1c1c] transition-colors">
                      <td className="px-5 py-3 text-white font-medium">{title}</td>
                      <td className="px-5 py-3 text-gray-400">{platform}</td>
                      <td className="px-5 py-3 text-gray-400">{deadline}</td>
                      <td className="px-5 py-3">
                        <span className={cn('badge', OFFER_STATUS_COLORS[status] || OFFER_STATUS_COLORS.pending)}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Campaigns overview mini-list */}
      {campaigns.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a2a]">
            <p className="text-sm font-semibold text-gray-300">Recent Campaigns</p>
            <Link to="/brand/campaigns" className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-[#2a2a2a]/50">
            {campaigns.slice(0, 4).map((c: Campaign) => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-3 hover:bg-[#1c1c1c] transition-colors">
                <div className="w-7 h-7 rounded-lg bg-[#2a2a2a] flex items-center justify-center text-gray-400 shrink-0">
                  {c.status === 'completed'
                    ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    : c.status === 'active'
                    ? <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                    : <Megaphone className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{c.name}</p>
                  {c.platform_focus && (
                    <p className="text-xs text-gray-500">{c.platform_focus}</p>
                  )}
                </div>
                <span className={cn(
                  'badge shrink-0 text-xs',
                  c.status === 'active' ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-800/40'
                  : c.status === 'completed' ? 'bg-purple-900/40 text-purple-300 border border-purple-800/40'
                  : 'bg-[#2a2a2a] text-gray-400 border border-[#2a2a2a]'
                )}>
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
