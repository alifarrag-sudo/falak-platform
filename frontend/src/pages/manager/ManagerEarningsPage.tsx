/**
 * Manager Earnings Page — earnings derived from completed/approved offers.
 * Fetches completed + approved offers, groups by influencer, shows summaries.
 * Supports date range filter: This Month / Last 3 Months / All Time.
 */
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DollarSign, TrendingUp, Award, Calendar,
  Users, ChevronDown,
} from 'lucide-react';
import { getOffers } from '../../utils/api';
import { cn, formatDate } from '../../utils/helpers';

/* ── Types ───────────────────────────────────────────────────────────── */
type Offer = Record<string, unknown>;

type DateRange = 'this_month' | 'last_3_months' | 'all_time';

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  this_month:    'This Month',
  last_3_months: 'Last 3 Months',
  all_time:      'All Time',
};

/* ── Stat card ───────────────────────────────────────────────────────── */
function StatCard({
  label, value, sub, icon: Icon, color, loading,
}: {
  label: string;
  value: string | number;
  sub?: string;
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
          <div className="skeleton h-7 w-20 mb-1" />
        ) : (
          <p className="text-2xl font-bold text-white truncate">{value}</p>
        )}
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/* ── Currency formatter ──────────────────────────────────────────────── */
function fmtCurrency(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/* ── Date range filter ───────────────────────────────────────────────── */
function isWithinRange(dateStr: string | undefined, range: DateRange): boolean {
  if (!dateStr) return range === 'all_time';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return range === 'all_time';
  const now = new Date();

  if (range === 'this_month') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  if (range === 'last_3_months') {
    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - 3);
    return d >= cutoff;
  }
  return true; // all_time
}

/* ── Page ────────────────────────────────────────────────────────────── */
export default function ManagerEarningsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('all_time');
  const [showRangePicker, setShowRangePicker] = useState(false);

  /* Fetch completed and approved offers in parallel */
  const { data: completedData, isLoading: completedLoading } = useQuery({
    queryKey: ['manager-earnings-completed'],
    queryFn: () => getOffers({ status: 'completed', limit: '200' }),
    staleTime: 60_000,
  });

  const { data: approvedData, isLoading: approvedLoading } = useQuery({
    queryKey: ['manager-earnings-approved'],
    queryFn: () => getOffers({ status: 'approved', limit: '200' }),
    staleTime: 60_000,
  });

  const isLoading = completedLoading || approvedLoading;

  /* Normalise helper */
  function normalise(raw: unknown): Offer[] {
    if (Array.isArray(raw)) return raw as Offer[];
    const r = raw as Record<string, unknown> | undefined;
    if (r?.offers && Array.isArray(r.offers)) return r.offers as Offer[];
    if (r?.data && Array.isArray(r.data)) return r.data as Offer[];
    return [];
  }

  /* Combine + dedupe by id */
  const allDeals = useMemo<Offer[]>(() => {
    const combined = [
      ...normalise(completedData),
      ...normalise(approvedData),
    ];
    const seen = new Set<string>();
    return combined.filter(o => {
      const id = String(o.id ?? '');
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [completedData, approvedData]);

  /* Apply date range filter */
  const filteredDeals = useMemo<Offer[]>(() => {
    if (dateRange === 'all_time') return allDeals;
    return allDeals.filter(o => isWithinRange(o.created_at as string | undefined, dateRange));
  }, [allDeals, dateRange]);

  /* Summary totals — group by currency */
  const summaryByCurrency = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const o of filteredDeals) {
      const currency = String(o.currency || 'SAR');
      const rate     = Number(o.rate) || 0;
      const existing = map.get(currency) ?? { total: 0, count: 0 };
      map.set(currency, { total: existing.total + rate, count: existing.count + 1 });
    }
    return Array.from(map.entries()).map(([currency, { total, count }]) => ({
      currency, total, count,
    }));
  }, [filteredDeals]);

  /* Primary currency for headline stats (use SAR or first) */
  const primaryCurrency = summaryByCurrency.find(s => s.currency === 'SAR') ?? summaryByCurrency[0];
  const totalGross      = primaryCurrency?.total ?? 0;
  const primaryCurCode  = primaryCurrency?.currency ?? 'SAR';
  const totalDeals      = filteredDeals.length;
  const avgDealValue    = totalDeals > 0 ? totalGross / totalDeals : 0;

  /* Per-influencer grouping */
  type InfluencerRow = {
    name: string;
    handle: string;
    deals: number;
    total: number;
    currency: string;
    avgRate: number;
    lastDeal: string | undefined;
  };

  const perInfluencer = useMemo<InfluencerRow[]>(() => {
    const map = new Map<string, InfluencerRow>();
    for (const o of filteredDeals) {
      const key    = String(o.influencer_id || o.influencer_name || 'unknown');
      const name   = String(o.influencer_name || 'Unknown');
      const handle = String(o.influencer_handle || '');
      const rate   = Number(o.rate) || 0;
      const cur    = String(o.currency || 'SAR');
      const date   = o.created_at ? String(o.created_at) : undefined;

      const existing = map.get(key) ?? {
        name, handle, deals: 0, total: 0, currency: cur,
        avgRate: 0, lastDeal: undefined,
      };

      const newTotal = existing.total + rate;
      const newDeals = existing.deals + 1;
      const newLast  =
        !existing.lastDeal ? date
        : !date ? existing.lastDeal
        : new Date(date) > new Date(existing.lastDeal) ? date
        : existing.lastDeal;

      map.set(key, {
        ...existing,
        deals:   newDeals,
        total:   newTotal,
        avgRate: newTotal / newDeals,
        lastDeal: newLast,
      });
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredDeals]);

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Earnings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Revenue from completed and approved deals across your roster.
          </p>
        </div>

        {/* Date range picker */}
        <div className="relative">
          <button
            onClick={() => setShowRangePicker(p => !p)}
            className="flex items-center gap-2 px-3 py-2 bg-surface-overlay border border-surface-border rounded-lg text-sm text-gray-300 hover:text-white hover:border-white/20 transition-colors"
          >
            <Calendar className="w-4 h-4 text-gray-500" />
            {DATE_RANGE_LABELS[dateRange]}
            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
          </button>
          {showRangePicker && (
            <div className="absolute right-0 top-full mt-1 bg-[#252525] border border-surface-border rounded-xl shadow-xl z-10 py-1 min-w-[160px]">
              {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map(r => (
                <button
                  key={r}
                  onClick={() => { setDateRange(r); setShowRangePicker(false); }}
                  className={cn(
                    'w-full text-left px-4 py-2 text-sm transition-colors',
                    dateRange === r
                      ? 'text-white bg-surface-overlay'
                      : 'text-gray-400 hover:text-white hover:bg-surface-overlay'
                  )}
                >
                  {DATE_RANGE_LABELS[r]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Gross Earnings"
          value={isLoading ? '…' : fmtCurrency(totalGross, primaryCurCode)}
          sub={summaryByCurrency.length > 1
            ? summaryByCurrency
                .filter(s => s.currency !== primaryCurCode)
                .map(s => `+ ${fmtCurrency(s.total, s.currency)}`)
                .join(', ')
            : undefined}
          icon={DollarSign}
          color="bg-emerald-900/40 text-emerald-400"
          loading={isLoading}
        />
        <StatCard
          label="Deals Completed"
          value={isLoading ? '…' : totalDeals}
          icon={Award}
          color="bg-purple-900/40 text-purple-400"
          loading={isLoading}
        />
        <StatCard
          label="Average Deal Value"
          value={isLoading ? '…' : fmtCurrency(Math.round(avgDealValue), primaryCurCode)}
          icon={TrendingUp}
          color="bg-blue-900/40 text-blue-400"
          loading={isLoading}
        />
      </div>

      {/* Per-influencer earnings table */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-[#2a2a2a]">
          <Users className="w-4 h-4 text-gray-500" />
          <p className="text-sm font-semibold text-gray-300">
            Earnings by Influencer
          </p>
          <span className="ml-auto text-xs text-gray-600">
            {DATE_RANGE_LABELS[dateRange]}
          </span>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="skeleton h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-4 w-32" />
                  <div className="skeleton h-3 w-20" />
                </div>
                <div className="skeleton h-5 w-24" />
              </div>
            ))}
          </div>
        ) : perInfluencer.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <DollarSign className="w-10 h-10 text-gray-600 mb-3" />
            <p className="text-sm text-gray-400">No completed deals found</p>
            <p className="text-xs text-gray-500 mt-1">
              Completed and approved offers will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Influencer</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">Deals</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">Total Earned</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">Avg Rate</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Last Deal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]/50">
                {perInfluencer.map((row, idx) => (
                  <tr key={idx} className="hover:bg-surface-overlay transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-white font-medium">{row.name}</p>
                      {row.handle && (
                        <p className="text-xs text-gray-500 mt-0.5">@{row.handle}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-300 tabular-nums">
                      {row.deals}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-emerald-300 tabular-nums whitespace-nowrap">
                      {fmtCurrency(row.total, row.currency)}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-400 tabular-nums whitespace-nowrap">
                      {fmtCurrency(Math.round(row.avgRate), row.currency)}
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {row.lastDeal ? formatDate(row.lastDeal) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Multi-currency note (shown only when more than one currency) */}
      {summaryByCurrency.length > 1 && (
        <div className="card p-4">
          <p className="text-xs font-medium text-gray-400 mb-2">Currency Breakdown</p>
          <div className="flex flex-wrap gap-4">
            {summaryByCurrency.map(s => (
              <div key={s.currency} className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{s.currency}</span>
                <span className="text-sm font-semibold text-white">{fmtCurrency(s.total, s.currency)}</span>
                <span className="text-xs text-gray-600">({s.count} deals)</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
