/**
 * Brand Requests — shows all collaboration requests / offers sent by this brand.
 * Fetches from GET /api/offers with status filters.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Send, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';
import { getOffers } from '../../utils/api';
import { cn, formatDate, formatRate } from '../../utils/helpers';

const STATUS_STYLES: Record<string, string> = {
  pending:     'bg-surface-subtle text-gray-300 border border-surface-border',
  sent:        'bg-blue-900/40 text-blue-300 border border-blue-800/40',
  accepted:    'bg-emerald-900/40 text-emerald-300 border border-emerald-800/40',
  declined:    'bg-red-900/40 text-red-300 border border-red-800/40',
  in_progress: 'bg-amber-900/40 text-amber-300 border border-amber-800/40',
  submitted:   'bg-purple-900/40 text-purple-300 border border-purple-800/40',
  approved:    'bg-emerald-900/60 text-emerald-200 border border-emerald-700/40',
  completed:   'bg-gray-700 text-gray-300 border border-gray-600',
};

const STATUS_FILTERS = ['all', 'pending', 'sent', 'accepted', 'declined', 'in_progress', 'submitted', 'completed'];

type Offer = Record<string, unknown>;

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: React.ElementType; color: string;
}) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xl font-bold text-white">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export default function BrandRequestsPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['brand-requests', statusFilter],
    queryFn: () => getOffers(statusFilter !== 'all' ? { status: statusFilter, limit: '100' } : { limit: '100' }),
  });

  const allOffers: Offer[] = Array.isArray(data)
    ? data
    : (data as { data?: Offer[] })?.data ?? [];

  const filtered = search
    ? allOffers.filter(o =>
        String(o.title || '').toLowerCase().includes(search.toLowerCase()) ||
        String(o.influencer_name || '').toLowerCase().includes(search.toLowerCase()) ||
        String(o.campaign_name || '').toLowerCase().includes(search.toLowerCase())
      )
    : allOffers;

  // Stats
  const total     = allOffers.length;
  const pending   = allOffers.filter(o => ['pending', 'sent'].includes(String(o.status))).length;
  const accepted  = allOffers.filter(o => ['accepted', 'in_progress', 'submitted', 'approved'].includes(String(o.status))).length;
  const completed = allOffers.filter(o => o.status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Collaboration Requests</h1>
        <p className="text-sm text-gray-500 mt-1">Track all requests sent to influencers.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Requests" value={total}     icon={FileText}    color="bg-blue-900/40 text-blue-400" />
        <StatCard label="Awaiting Reply"  value={pending}   icon={Clock}       color="bg-amber-900/40 text-amber-400" />
        <StatCard label="Accepted"        value={accepted}  icon={CheckCircle} color="bg-emerald-900/40 text-emerald-400" />
        <StatCard label="Completed"       value={completed} icon={TrendingUp}  color="bg-purple-900/40 text-purple-400" />
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-medium transition-colors capitalize',
                statusFilter === s
                  ? 'bg-white text-[#1c1c1c]'
                  : 'bg-surface-overlay text-gray-400 hover:text-white'
              )}
            >
              {s === 'all' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search by title, influencer, or campaign…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full sm:w-72 px-3 py-2 bg-surface-overlay border border-surface-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-surface-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex gap-4 animate-pulse">
                <div className="h-4 bg-surface-overlay rounded w-48" />
                <div className="h-4 bg-surface-overlay rounded w-32" />
                <div className="h-4 bg-surface-overlay rounded w-24 ml-auto" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Send className="w-10 h-10 text-gray-600 mb-3" />
            <p className="text-sm text-gray-400">No requests found</p>
            <p className="text-xs text-gray-500 mt-1">
              {statusFilter !== 'all' ? 'Try a different status filter.' : 'Start by browsing influencers and sending a request.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Influencer</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Title</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Campaign</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Platform</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Rate</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Deadline</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/50">
                {filtered.map(offer => {
                  const id           = String(offer.id);
                  const influencer   = String(offer.influencer_name || offer.portal_name || '—');
                  const title        = String(offer.title || '—');
                  const campaign     = String(offer.campaign_name || '—');
                  const platform     = String(offer.platform || '—');
                  const rate         = offer.rate ? formatRate(Number(offer.rate), String(offer.currency || 'SAR')) : '—';
                  const deadline     = offer.deadline ? formatDate(String(offer.deadline)) : '—';
                  const status       = String(offer.status || 'pending');
                  const sentAt       = offer.sent_at ? formatDate(String(offer.sent_at)) : offer.created_at ? formatDate(String(offer.created_at)) : '—';

                  return (
                    <tr key={id} className="hover:bg-surface-overlay transition-colors">
                      <td className="px-5 py-3 text-white font-medium">{influencer}</td>
                      <td className="px-5 py-3 text-gray-300">{title}</td>
                      <td className="px-5 py-3 text-gray-400">{campaign}</td>
                      <td className="px-5 py-3 text-gray-400 capitalize">{platform}</td>
                      <td className="px-5 py-3 text-gray-300">{rate}</td>
                      <td className="px-5 py-3 text-gray-400">{deadline}</td>
                      <td className="px-5 py-3">
                        <span className={cn('badge text-xs capitalize', STATUS_STYLES[status] || STATUS_STYLES.pending)}>
                          {status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{sentAt}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-5 py-3 border-t border-surface-border text-xs text-gray-600">
              {filtered.length} request{filtered.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
