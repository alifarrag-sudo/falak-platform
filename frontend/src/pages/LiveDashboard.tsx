/**
 * /live — Real-time partner/investor dashboard.
 * Accessible to viewer + admin roles only.
 * - Metric cards auto-refresh every 60 seconds via GET /api/live/metrics
 * - Event feed streams from GET /api/live/feed (SSE, no library)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Users, Megaphone, DollarSign, Zap, Wifi, WifiOff } from 'lucide-react';
import { cn } from '../utils/helpers';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Metrics {
  total_influencers: number;
  active_campaigns: number;
  total_paid_this_month: { amount: number; currency: string };
  avg_payment_hours: number | null;
  recent_payments: RecentPayment[];
}

interface RecentPayment {
  id: string;
  influencer_name: string;
  amount: number;
  currency: string;
  campaign: string | null;
  market: string | null;
  timestamp: string;
}

interface FeedEvent {
  type: 'new_offer' | 'offer_update' | 'payment' | 'new_influencer' | 'heartbeat';
  data?: Record<string, unknown>;
  ts: string;
  _key: number; // local unique key for React list
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSAR(amount: number): string {
  if (amount >= 1_000_000) return `SAR ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `SAR ${(amount / 1_000).toFixed(1)}K`;
  return `SAR ${amount.toLocaleString()}`;
}

function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}

function eventLabel(type: FeedEvent['type']): { label: string; color: string } {
  switch (type) {
    case 'payment':       return { label: 'Payment Released', color: 'text-emerald-400' };
    case 'new_offer':     return { label: 'New Offer Sent',   color: 'text-blue-400'    };
    case 'offer_update':  return { label: 'Offer Updated',    color: 'text-amber-400'   };
    case 'new_influencer':return { label: 'Creator Joined',   color: 'text-purple-400'  };
    case 'heartbeat':     return { label: 'Connected',        color: 'text-gray-500'    };
    default:              return { label: type,               color: 'text-gray-400'    };
  }
}

function eventDetail(ev: FeedEvent): string {
  if (!ev.data) return '';
  const d = ev.data;
  switch (ev.type) {
    case 'payment':
      return d.influencer_name
        ? `${d.influencer_name} · ${d.amount ? `${d.currency ?? 'SAR'} ${Number(d.amount).toLocaleString()}` : ''}`
        : '';
    case 'new_offer':
      return String(d.title ?? '');
    case 'offer_update':
      return `${d.title ?? ''} → ${d.status ?? ''}`;
    case 'new_influencer':
      return `${d.name ?? ''} ${d.country ? `(${d.country})` : ''}`.trim();
    default:
      return '';
  }
}

const MAX_EVENTS = 10;

// ── Component ─────────────────────────────────────────────────────────────────

export default function LiveDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [sseStatus, setSseStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [tick, setTick] = useState(0); // forces "ago" counter re-render each second
  const eventKeyRef = useRef(0);
  const esRef = useRef<EventSource | null>(null);

  // ── Metrics polling ───────────────────────────────────────────────────────

  const fetchMetrics = useCallback(async () => {
    try {
      const token = localStorage.getItem('cp_auth_token');
      const res = await fetch('/api/live/metrics', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Metrics = await res.json();
      setMetrics(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('[live/metrics]', err);
    }
  }, []);

  // Initial fetch + 60-second refresh
  useEffect(() => {
    fetchMetrics();
    const id = setInterval(fetchMetrics, 60_000);
    return () => clearInterval(id);
  }, [fetchMetrics]);

  // ── "Last updated" ticker ─────────────────────────────────────────────────

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1_000);
    return () => clearInterval(id);
  }, []);

  function secondsAgo(): string {
    const secs = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
    if (secs < 5)  return 'just now';
    if (secs < 60) return `${secs}s ago`;
    return `${Math.floor(secs / 60)}m ago`;
  }

  // suppress unused warning from tick usage
  void tick;

  // ── SSE connection ─────────────────────────────────────────────────────────

  useEffect(() => {
    const token = localStorage.getItem('cp_auth_token');
    const url = token ? `/api/live/feed?token=${encodeURIComponent(token)}` : '/api/live/feed';

    function connect() {
      setSseStatus('connecting');

      // EventSource doesn't support custom headers natively — pass token as query param
      // The backend currently reads from Authorization header; we handle this below
      const es = new EventSource(url);
      esRef.current = es;

      es.onopen = () => setSseStatus('connected');

      es.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data) as Omit<FeedEvent, '_key'>;
          if (parsed.type === 'heartbeat') {
            setSseStatus('connected');
            return;
          }
          setEvents(prev => {
            const newEvent: FeedEvent = { ...parsed, _key: ++eventKeyRef.current };
            return [newEvent, ...prev].slice(0, MAX_EVENTS);
          });
        } catch { /* ignore malformed frames */ }
      };

      es.onerror = () => {
        setSseStatus('disconnected');
        es.close();
        // Reconnect after 5 seconds
        setTimeout(connect, 5_000);
      };
    }

    connect();

    return () => {
      esRef.current?.close();
    };
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  const metricCards = [
    {
      label: 'Total Creators',
      value: metrics ? metrics.total_influencers.toLocaleString() : '—',
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
    },
    {
      label: 'Active Campaigns',
      value: metrics ? metrics.active_campaigns.toString() : '—',
      icon: Megaphone,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
    },
    {
      label: 'Paid This Month',
      value: metrics ? formatSAR(metrics.total_paid_this_month.amount) : '—',
      icon: DollarSign,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      label: 'Avg Pay Speed',
      value: metrics?.avg_payment_hours != null
        ? `${metrics.avg_payment_hours}h`
        : '—',
      icon: Zap,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20',
    },
  ];

  return (
    <div className="min-h-screen bg-[#080808] text-gray-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">Platform Overview</h1>
            <p className="text-xs text-gray-500 mt-0.5">Updated {secondsAgo()} · refreshes every 60s</p>
          </div>

          {/* LIVE badge */}
          <div className="flex items-center gap-2">
            {sseStatus === 'connected' ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            ) : sseStatus === 'connecting' ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-amber-400 border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 rounded-full">
                <Wifi className="w-3 h-3 animate-pulse" />
                Connecting…
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-red-400 border border-red-500/30 bg-red-500/10 px-3 py-1.5 rounded-full">
                <WifiOff className="w-3 h-3" />
                Reconnecting…
              </span>
            )}
          </div>
        </div>

        {/* ── Metric cards ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {metricCards.map(card => (
            <div key={card.label} className={cn('rounded-xl border p-4 space-y-3', card.bg)}>
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', card.bg)}>
                <card.icon className={cn('w-4 h-4', card.color)} />
              </div>
              <div>
                <p className="text-2xl font-bold text-white leading-none">{card.value}</p>
                <p className="text-xs text-gray-500 mt-1">{card.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* ── Recent Payments ──────────────────────────────────── */}
          <div className="rounded-xl border border-white/8 bg-white/3 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
              <h2 className="text-sm font-medium text-white">Recent Payments</h2>
              <span className="text-xs text-gray-500">Last 8 releases</span>
            </div>
            <div className="divide-y divide-white/5">
              {metrics?.recent_payments.length ? (
                metrics.recent_payments.map(p => (
                  <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{p.influencer_name || '—'}</p>
                      <p className="text-xs text-gray-500 truncate">{p.campaign || 'Campaign'}{p.market ? ` · ${p.market}` : ''}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-emerald-400">
                        {p.currency} {Number(p.amount || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-600">{p.timestamp ? formatTs(p.timestamp) : ''}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="px-4 py-6 text-xs text-gray-600 text-center">No payments recorded yet</p>
              )}
            </div>
          </div>

          {/* ── Live Event Feed ──────────────────────────────────── */}
          <div className="rounded-xl border border-white/8 bg-white/3 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
              <h2 className="text-sm font-medium text-white">Live Activity</h2>
              <span className="text-xs text-gray-500">Last {MAX_EVENTS} events</span>
            </div>
            <div className="divide-y divide-white/5 min-h-[200px]">
              {events.filter(e => e.type !== 'heartbeat').length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <p className="text-xs text-gray-600">Listening for activity…</p>
                </div>
              ) : (
                events
                  .filter(e => e.type !== 'heartbeat')
                  .map(ev => {
                    const { label, color } = eventLabel(ev.type);
                    const detail = eventDetail(ev);
                    return (
                      <div
                        key={ev._key}
                        className="px-4 py-3 flex items-start gap-3 animate-in slide-in-from-top-2 duration-300"
                      >
                        <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-current shrink-0" style={{ color: color.replace('text-', '') }} />
                        <div className="min-w-0 flex-1">
                          <p className={cn('text-xs font-semibold', color)}>{label}</p>
                          {detail && <p className="text-xs text-gray-400 truncate mt-0.5">{detail}</p>}
                        </div>
                        <span className="text-xs text-gray-600 shrink-0 tabular-nums">{formatTs(ev.ts)}</span>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
