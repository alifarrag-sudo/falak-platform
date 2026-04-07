/**
 * Campaign Report — printable/shareable performance report.
 * Accessed via /campaigns/:id/report
 * Shows: overview, budget vs. spend, influencer roster, offer breakdown,
 *        deliverable progress, and a summary section.
 * Has a "Print" button that triggers window.print() for PDF export.
 */
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer, TrendingUp, Users, DollarSign, CheckCircle2 } from 'lucide-react';
import { getCampaign, getCampaignStats } from '../utils/api';
import { formatRate, formatDate, formatFollowers, cn } from '../utils/helpers';
import type { Campaign, CampaignInfluencer } from '../types';

const STATUS_COLORS: Record<string, string> = {
  pending:     'bg-gray-600 text-gray-200',
  sent:        'bg-blue-700 text-blue-100',
  accepted:    'bg-emerald-700 text-emerald-100',
  declined:    'bg-red-700 text-red-100',
  in_progress: 'bg-amber-700 text-amber-100',
  submitted:   'bg-purple-700 text-purple-100',
  approved:    'bg-emerald-600 text-white',
  completed:   'bg-gray-700 text-gray-200',
};

function formatReach(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function MetricCard({
  label, value, icon: Icon, sub, color,
}: {
  label: string; value: string | number; icon: React.ElementType; sub?: string; color: string;
}) {
  return (
    <div className="card p-5 flex items-center gap-4 print:border print:border-gray-300 print:rounded-xl print:bg-white print:text-black">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xl font-bold text-white print:text-black">{value}</p>
        <p className="text-xs text-gray-500 print:text-gray-600">{label}</p>
        {sub && <p className="text-xs text-gray-600 print:text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function CampaignReportPage() {
  const { id } = useParams<{ id: string }>();

  const { data: campaign, isLoading: loadingCampaign } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => getCampaign(id!),
    enabled: !!id,
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['campaign-stats', id],
    queryFn: () => getCampaignStats(id!),
    enabled: !!id,
  });

  const isLoading = loadingCampaign || loadingStats;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 p-6">
        <div className="skeleton h-8 w-64" />
        <div className="skeleton h-4 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[0,1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!campaign || !stats) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <p className="text-gray-400">Campaign not found.</p>
        <Link to="/campaigns" className="btn-secondary btn-sm mt-4">Back to Campaigns</Link>
      </div>
    );
  }

  const c = campaign as Campaign & { influencers?: CampaignInfluencer[] };
  const influencers = c.influencers || [];
  const budget = (c.budget as number) || stats.total_budget;
  const spent = stats.total_spent;
  const remaining = budget - spent;
  const spentPct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const totalOffers = Object.values(stats.offers_by_status).reduce((a, b) => a + b, 0);
  const acceptedOffers = (stats.offers_by_status['accepted'] || 0) +
    (stats.offers_by_status['in_progress'] || 0) +
    (stats.offers_by_status['submitted'] || 0) +
    (stats.offers_by_status['completed'] || 0);
  const acceptanceRate = totalOffers > 0 ? Math.round((acceptedOffers / totalOffers) * 100) : 0;
  const deliverablesPct = stats.deliverables_count > 0
    ? Math.round((stats.deliverables_approved / stats.deliverables_count) * 100)
    : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6 print:space-y-4">
      {/* Toolbar — hidden when printing */}
      <div className="flex items-center justify-between print:hidden">
        <Link to={`/campaigns/${id}`} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Campaign
        </Link>
        <button
          onClick={() => window.print()}
          className="btn-secondary btn-sm flex items-center gap-2"
        >
          <Printer className="w-4 h-4" /> Export / Print
        </button>
      </div>

      {/* Report header */}
      <div className="card p-6 print:border print:border-gray-300 print:rounded-xl print:p-6 print:bg-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1 print:text-gray-600">Campaign Report</p>
            <h1 className="text-2xl font-bold text-white print:text-black">{c.name}</h1>
            {c.client_name && (
              <p className="text-sm text-gray-400 mt-1 print:text-gray-600">Client: {c.client_name}</p>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {c.status && (
                <span className={cn(
                  'badge text-xs capitalize',
                  c.status === 'active' ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-800/40' :
                  c.status === 'completed' ? 'bg-purple-900/40 text-purple-300 border border-purple-800/40' :
                  'bg-surface-overlay text-gray-400 border border-surface-border'
                )}>
                  {c.status}
                </span>
              )}
              {c.platform_focus && (
                <span className="text-xs text-gray-500">{c.platform_focus}</span>
              )}
              {c.start_date && (
                <span className="text-xs text-gray-500">
                  {formatDate(c.start_date)}{c.end_date ? ` → ${formatDate(c.end_date)}` : ''}
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-500">Generated</p>
            <p className="text-sm text-white print:text-black">{formatDate(new Date().toISOString())}</p>
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Influencers"
          value={stats.influencer_count}
          icon={Users}
          sub="in campaign"
          color="bg-blue-900/40 text-blue-400"
        />
        <MetricCard
          label="Total Reach"
          value={formatReach(stats.total_followers_reach)}
          icon={TrendingUp}
          sub="combined followers"
          color="bg-purple-900/40 text-purple-400"
        />
        <MetricCard
          label="Acceptance Rate"
          value={`${acceptanceRate}%`}
          icon={CheckCircle2}
          sub={`${acceptedOffers}/${totalOffers} offers`}
          color="bg-emerald-900/40 text-emerald-400"
        />
        <MetricCard
          label="Deliverables"
          value={`${deliverablesPct}%`}
          icon={CheckCircle2}
          sub={`${stats.deliverables_approved}/${stats.deliverables_count} approved`}
          color="bg-amber-900/40 text-amber-400"
        />
      </div>

      {/* Budget vs Spend */}
      {budget > 0 && (
        <div className="card p-5 print:border print:border-gray-300 print:rounded-xl print:bg-white">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 print:text-black">Budget vs. Spend</h2>
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Spent</p>
              <p className="text-2xl font-bold text-white print:text-black">{formatRate(spent)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-1">Budget</p>
              <p className="text-2xl font-bold text-gray-300 print:text-black">{formatRate(budget)}</p>
            </div>
          </div>
          <div className="h-4 rounded-full bg-surface-overlay overflow-hidden print:border print:border-gray-300">
            <div
              className={cn('h-full rounded-full', spent > budget ? 'bg-red-500' : 'bg-blue-500')}
              style={{ width: `${spentPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-500">{spentPct.toFixed(0)}% utilized</p>
            <p className={cn('text-sm font-medium', remaining >= 0 ? 'text-emerald-400 print:text-emerald-600' : 'text-red-400')}>
              {remaining >= 0 ? `${formatRate(remaining)} remaining` : `${formatRate(Math.abs(remaining))} over budget`}
            </p>
          </div>
        </div>
      )}

      {/* Offer status breakdown */}
      {totalOffers > 0 && (
        <div className="card p-5 print:border print:border-gray-300 print:rounded-xl print:bg-white">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 print:text-black">Offer Status Breakdown</h2>
          <div className="space-y-2.5">
            {Object.entries(stats.offers_by_status).map(([status, count]) => (
              <div key={status} className="flex items-center gap-3">
                <span className={cn(
                  'text-xs font-medium px-2 py-0.5 rounded capitalize min-w-[90px] text-center',
                  STATUS_COLORS[status] || STATUS_COLORS.pending
                )}>
                  {status.replace('_', ' ')}
                </span>
                <div className="flex-1 h-2 rounded-full bg-surface-overlay overflow-hidden print:border print:border-gray-200">
                  <div
                    className="h-full rounded-full bg-white/30 print:bg-gray-400"
                    style={{ width: `${(count / totalOffers) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-white print:text-black w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Influencer roster */}
      {influencers.length > 0 && (
        <div className="card overflow-hidden print:border print:border-gray-300 print:rounded-xl">
          <div className="px-5 py-3 border-b border-surface-border print:border-gray-300">
            <h2 className="text-sm font-semibold text-gray-300 print:text-black">Influencer Roster ({influencers.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border print:border-gray-300">
                  <th className="px-5 py-2 text-left text-xs text-gray-500 uppercase tracking-wide">Influencer</th>
                  <th className="px-5 py-2 text-left text-xs text-gray-500 uppercase tracking-wide">Platform</th>
                  <th className="px-5 py-2 text-right text-xs text-gray-500 uppercase tracking-wide">Followers</th>
                  <th className="px-5 py-2 text-right text-xs text-gray-500 uppercase tracking-wide">Rate</th>
                  <th className="px-5 py-2 text-center text-xs text-gray-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/50 print:divide-gray-200">
                {influencers.map((inf: CampaignInfluencer) => {
                  const name = inf.name_english || inf.name_arabic || inf.ig_handle || 'Unknown';
                  const followers = inf.ig_followers || inf.tiktok_followers || 0;
                  return (
                    <tr key={inf.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-white print:text-black">{name}</p>
                        {inf.ig_handle && (
                          <p className="text-xs text-gray-500">@{inf.ig_handle}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-400 capitalize">
                        {inf.platform || 'Instagram'}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-300 print:text-black">
                        {formatFollowers(followers)}
                      </td>
                      <td className="px-5 py-3 text-right text-white font-medium print:text-black">
                        {inf.rate ? formatRate(inf.rate) : '—'}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded capitalize',
                          STATUS_COLORS[inf.offer_status || 'pending'] || STATUS_COLORS.pending
                        )}>
                          {(inf.offer_status || 'pending').replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Campaign brief */}
      {c.brief && (
        <div className="card p-5 print:border print:border-gray-300 print:rounded-xl print:bg-white">
          <h2 className="text-sm font-semibold text-gray-300 mb-3 print:text-black">Campaign Brief</h2>
          <p className="text-sm text-gray-300 whitespace-pre-wrap print:text-black">{c.brief}</p>
        </div>
      )}

      {/* Print footer */}
      <div className="hidden print:block text-center text-xs text-gray-500 border-t border-gray-200 pt-4 mt-8">
        Confidential — Generated by FALAK · {new Date().toLocaleDateString()}
      </div>
    </div>
  );
}
