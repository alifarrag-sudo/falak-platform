/**
 * Deal Tracker — lists all active deals (accepted + in_progress offers)
 * showing deadline, deliverable progress, and quick status updates.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Clock, CheckCircle2, XCircle, FileText, ChevronRight, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getOffers } from '../utils/api';
import { cn, formatDate, formatRate } from '../utils/helpers';

type Offer = Record<string, unknown> & { deliverables?: Record<string, unknown>[] };

const STATUS_STYLES: Record<string, string> = {
  accepted:    'bg-emerald-900/40 text-emerald-300 border border-emerald-800/40',
  in_progress: 'bg-amber-900/40 text-amber-300 border border-amber-800/40',
  submitted:   'bg-purple-900/40 text-purple-300 border border-purple-800/40',
};

function deadline(d?: string): { label: string; color: string } | null {
  if (!d) return null;
  const days = (new Date(d).getTime() - Date.now()) / 86400000;
  if (days < 0)   return { label: `${Math.abs(Math.ceil(days))}d overdue`, color: 'text-red-400' };
  if (days < 3)   return { label: `${Math.ceil(days)}d left`, color: 'text-red-400' };
  if (days < 7)   return { label: `${Math.ceil(days)}d left`, color: 'text-amber-400' };
  return               { label: `${Math.ceil(days)}d left`, color: 'text-gray-400' };
}

function DeliverableProgress({ deliverables }: { deliverables: Record<string, unknown>[] }) {
  const total = deliverables.length;
  if (total === 0) return null;
  const approved = deliverables.filter(d => d.status === 'approved').length;
  const submitted = deliverables.filter(d => d.status === 'submitted').length;
  const pct = (approved / total) * 100;

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500">Deliverables</span>
        <span className="text-xs text-gray-400">{approved}/{total} approved{submitted > 0 ? ` · ${submitted} pending review` : ''}</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-overlay overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function DealCard({ offer }: { offer: Offer }) {
  const dl = deadline(offer.deadline as string | undefined);
  const deliverables = (offer.deliverables || []) as Record<string, unknown>[];
  const hasSubmitted = deliverables.some(d => d.status === 'submitted');

  return (
    <div className={cn(
      'card p-4 space-y-3',
      hasSubmitted ? 'border-purple-800/40' : ''
    )}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-white truncate">{String(offer.title || 'Untitled Offer')}</p>
            {hasSubmitted && (
              <span className="flex items-center gap-1 text-xs text-purple-300 bg-purple-900/40 px-2 py-0.5 rounded-full border border-purple-800/40">
                <AlertCircle className="w-3 h-3" /> Needs review
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {String(offer.influencer_name || offer.portal_name || '—')}
            {!!offer.campaign_name && ` · ${String(offer.campaign_name)}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {dl && (
            <span className={cn('text-xs font-medium flex items-center gap-1', dl.color)}>
              <Clock className="w-3 h-3" />
              {dl.label}
            </span>
          )}
          <span className={cn('badge text-xs capitalize', STATUS_STYLES[String(offer.status)] || STATUS_STYLES.accepted)}>
            {String(offer.status).replace('_', ' ')}
          </span>
        </div>
      </div>

      {!!offer.rate && (
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>Rate: <span className="text-white font-medium">{formatRate(Number(offer.rate))}</span></span>
          {!!offer.platform && <span>Platform: <span className="text-gray-300">{String(offer.platform)}</span></span>}
          {!!offer.deadline && <span>Deadline: <span className="text-gray-300">{formatDate(String(offer.deadline))}</span></span>}
        </div>
      )}

      <DeliverableProgress deliverables={deliverables} />

      <div className="flex items-center justify-between pt-1">
        <Link
          to="/offers"
          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
        >
          Manage <ChevronRight className="w-3 h-3" />
        </Link>
        {!!offer.influencer_id && (
          <Link
            to={`/influencers/${String(offer.influencer_id)}`}
            className="text-xs text-gray-500 hover:text-white flex items-center gap-1 transition-colors"
          >
            View profile <ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

export default function DealTrackerPage() {
  const { data: acceptedData, isLoading: loadingAccepted } = useQuery({
    queryKey: ['deals-accepted'],
    queryFn: () => getOffers({ status: 'accepted', limit: '50' }),
    refetchInterval: 30000,
  });

  const { data: inProgressData, isLoading: loadingInProgress } = useQuery({
    queryKey: ['deals-in-progress'],
    queryFn: () => getOffers({ status: 'in_progress', limit: '50' }),
    refetchInterval: 30000,
  });

  const { data: submittedData, isLoading: loadingSubmitted } = useQuery({
    queryKey: ['deals-submitted'],
    queryFn: () => getOffers({ status: 'submitted', limit: '50' }),
    refetchInterval: 30000,
  });

  const isLoading = loadingAccepted || loadingInProgress || loadingSubmitted;

  const accepted    = (acceptedData?.data    || []) as Offer[];
  const inProgress  = (inProgressData?.data  || []) as Offer[];
  const submitted   = (submittedData?.data   || []) as Offer[];
  const total = accepted.length + inProgress.length + submitted.length;

  // Sort by urgency: overdue first, then by deadline
  const sortByDeadline = (a: Offer, b: Offer) => {
    const da = a.deadline ? new Date(a.deadline as string).getTime() : Infinity;
    const db = b.deadline ? new Date(b.deadline as string).getTime() : Infinity;
    return da - db;
  };

  const sections = [
    { label: 'Needs Review', color: 'text-purple-400', deals: [...submitted].sort(sortByDeadline), badge: 'bg-purple-900/40 border-purple-800/40' },
    { label: 'In Progress',  color: 'text-amber-400',  deals: [...inProgress].sort(sortByDeadline), badge: 'bg-amber-900/40 border-amber-800/40' },
    { label: 'Accepted',     color: 'text-emerald-400', deals: [...accepted].sort(sortByDeadline), badge: 'bg-emerald-900/40 border-emerald-800/40' },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Deal Tracker</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isLoading ? 'Loading...' : `${total} active deal${total !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Link to="/offers" className="btn-secondary btn-sm">
          All Offers <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-6">
          {[0, 1, 2].map(i => (
            <div key={i} className="space-y-3">
              <div className="skeleton h-5 w-28" />
              {[0, 1, 2].map(j => (
                <div key={j} className="card p-4 space-y-2">
                  <div className="skeleton h-4 w-full" />
                  <div className="skeleton h-3 w-2/3" />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : total === 0 ? (
        <div className="card p-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <p className="text-sm text-gray-300 font-medium">No active deals</p>
          <p className="text-xs text-gray-500 mt-1">Send offers to influencers to start tracking deals here.</p>
          <Link to="/offers" className="btn-primary btn-sm mt-4">Go to Offers</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {sections.map(section => (
            <div key={section.label}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className={cn('text-sm font-semibold', section.color)}>{section.label}</h2>
                <span className={cn('badge text-xs border', section.badge)}>
                  {section.deals.length}
                </span>
              </div>
              {section.deals.length === 0 ? (
                <div className="card p-6 text-center border-dashed">
                  <p className="text-xs text-gray-500">None</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {section.deals.map(o => (
                    <DealCard key={String(o.id)} offer={o} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
