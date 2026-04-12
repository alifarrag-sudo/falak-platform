/**
 * Revenue & Commission Dashboard — platform monetisation view.
 * Shows total commissions earned, pending, collected, offer volume and
 * a paginated ledger of all commission entries.
 */
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign, TrendingUp, Clock, CheckCircle, BarChart2, RefreshCw, Settings2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getRevenueSummary, getRevenueCommissions, collectCommission, getRevenueSettings, updateRevenueSettings } from '../../utils/api';
import { cn } from '../../utils/helpers';

const STATUS_BADGE: Record<string, string> = {
  PENDING:   'bg-amber-900/30 text-amber-300 border border-amber-700/30',
  COLLECTED: 'bg-emerald-900/30 text-emerald-300 border border-emerald-700/30',
};

function fmt(n: number, currency = 'SAR') {
  return new Intl.NumberFormat('en-EG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}

export default function RevenuePage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [commPct, setCommPct] = useState('');

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['revenue-summary'],
    queryFn: getRevenueSummary,
  });

  const { data: commissionsData, isLoading: listLoading } = useQuery({
    queryKey: ['revenue-commissions', statusFilter],
    queryFn: () => getRevenueCommissions(statusFilter ? { status: statusFilter } : {}),
  });

  const { data: settings } = useQuery({
    queryKey: ['revenue-settings'],
    queryFn: getRevenueSettings,
  });

  useEffect(() => {
    if (settings && !commPct) {
      setCommPct((settings as Record<string, string>).platform_commission_pct || '10');
    }
  }, [settings]);

  const collectMutation = useMutation({
    mutationFn: collectCommission,
    onSuccess: () => {
      toast.success('Marked as collected');
      qc.invalidateQueries({ queryKey: ['revenue-commissions'] });
      qc.invalidateQueries({ queryKey: ['revenue-summary'] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => updateRevenueSettings({ platform_commission_pct: commPct }),
    onSuccess: () => {
      toast.success('Commission rate updated');
      qc.invalidateQueries({ queryKey: ['revenue-summary'] });
      qc.invalidateQueries({ queryKey: ['revenue-settings'] });
      setShowSettings(false);
    },
    onError: () => toast.error('Failed to save'),
  });

  const commissions = (commissionsData?.items || []) as Record<string, unknown>[];

  const kpis = [
    {
      label: 'Total Earned',
      value: summaryLoading ? '…' : fmt(summary?.total_earned || 0),
      icon: DollarSign,
      color: 'text-emerald-400',
      bg: 'bg-emerald-900/20 border-emerald-700/20',
    },
    {
      label: 'This Month',
      value: summaryLoading ? '…' : fmt(summary?.this_month_earned || 0),
      icon: TrendingUp,
      color: 'text-blue-400',
      bg: 'bg-blue-900/20 border-blue-700/20',
    },
    {
      label: 'Pending Collection',
      value: summaryLoading ? '…' : fmt(summary?.pending || 0),
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-900/20 border-amber-700/20',
    },
    {
      label: 'Total Offer Volume',
      value: summaryLoading ? '…' : fmt(summary?.total_offer_volume || 0),
      icon: BarChart2,
      color: 'text-purple-400',
      bg: 'bg-purple-900/20 border-purple-700/20',
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-white">Revenue & Commissions</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            FALAK earns {summary?.commission_rate_pct ?? '10'}% on every accepted offer.
          </p>
        </div>
        <button
          onClick={() => setShowSettings(p => !p)}
          className="btn-secondary"
        >
          <Settings2 className="w-4 h-4" /> Commission Rate
        </button>
      </div>

      {/* Commission Rate Settings */}
      {showSettings && (
        <div className="card p-5 flex items-end gap-4 flex-wrap">
          <div>
            <label className="label">Platform Commission %</label>
            <input
              className="input w-36"
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={commPct}
              onChange={e => setCommPct(e.target.value)}
            />
          </div>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="btn-primary"
          >
            {saveMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Save Rate
          </button>
          <p className="text-xs text-gray-500 self-center">
            This rate is applied when an influencer accepts an offer. Existing commissions are unaffected.
          </p>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className={cn('card p-5 flex items-start gap-4 border', kpi.bg)}>
            <div className={cn('p-2.5 rounded-xl bg-black/20', kpi.color)}>
              <kpi.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">{kpi.label}</p>
              <p className="text-lg font-bold text-white">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Active offers stat */}
      {summary && (
        <div className="text-xs text-gray-500">
          {summary.active_offers} offers currently in progress · {summary.total_commissions} commission entries total
        </div>
      )}

      {/* Commission ledger */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-surface-border">
          <h3 className="text-sm font-semibold text-white">Commission Ledger</h3>
          <select
            className="input text-sm py-1.5 w-40"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="COLLECTED">Collected</option>
          </select>
        </div>

        {listLoading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading commissions…</div>
        ) : commissions.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No commission entries yet. Send offers and have influencers accept them to see revenue here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-surface-border">
                  <th className="text-left px-4 py-3">Offer</th>
                  <th className="text-left px-4 py-3">Influencer</th>
                  <th className="text-right px-4 py-3">Offer Value</th>
                  <th className="text-right px-4 py-3">Commission</th>
                  <th className="text-right px-4 py-3">Rate</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {commissions.map(c => (
                  <tr key={String(c.id)} className="border-b border-surface-border/50 hover:bg-surface-overlay/30 transition-colors">
                    <td className="px-4 py-3 text-gray-300 max-w-[180px] truncate">{String(c.offer_title || c.reference_id || '—')}</td>
                    <td className="px-4 py-3 text-gray-400">{String(c.influencer_name || c.ig_handle || '—')}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{fmt(Number(c.gross_amount) || 0, String(c.currency || 'SAR'))}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-400">{fmt(Number(c.commission_amount) || 0, String(c.currency || 'SAR'))}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{Number(c.commission_rate) || 0}%</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full', STATUS_BADGE[String(c.status)] || STATUS_BADGE.PENDING)}>
                        {String(c.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {c.created_at ? new Date(String(c.created_at)).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {c.status === 'PENDING' && (
                        <button
                          onClick={() => collectMutation.mutate(String(c.id))}
                          disabled={collectMutation.isPending}
                          className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors whitespace-nowrap"
                        >
                          Mark collected
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer note */}
      <p className="text-xs text-gray-600">
        Commissions are calculated at the time an influencer accepts an offer. The net amount is what the agency owes the influencer after FALAK's cut.
      </p>
    </div>
  );
}
