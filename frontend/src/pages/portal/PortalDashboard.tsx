import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Megaphone, Clock, CheckCircle, XCircle, ChevronRight, Upload, AlertTriangle } from 'lucide-react';
import { portalGetOffers, portalGetProfile } from '../../utils/api';
import { cn, formatDate, formatRate } from '../../utils/helpers';

const STATUS_STYLES: Record<string, string> = {
  pending:     'bg-surface-subtle text-gray-300 border border-surface-border',
  sent:        'bg-blue-900/40 text-blue-300 border border-blue-800/40',
  accepted:    'bg-emerald-900/40 text-emerald-300 border border-emerald-800/40',
  declined:    'bg-red-900/40 text-red-300 border border-red-800/40',
  in_progress: 'bg-amber-900/40 text-amber-300 border border-amber-800/40',
  submitted:   'bg-purple-900/40 text-purple-300 border border-purple-800/40',
  approved:    'bg-emerald-900/60 text-emerald-200 border border-emerald-700/40',
  rejected:    'bg-red-900/40 text-red-300 border border-red-800/40',
  completed:   'bg-gray-700 text-gray-300 border border-gray-600',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  sent:        <Clock className="w-3.5 h-3.5" />,
  accepted:    <CheckCircle className="w-3.5 h-3.5" />,
  declined:    <XCircle className="w-3.5 h-3.5" />,
  submitted:   <Upload className="w-3.5 h-3.5" />,
  completed:   <CheckCircle className="w-3.5 h-3.5" />,
};

export default function PortalDashboard() {
  const { data: offers = [], isLoading } = useQuery({
    queryKey: ['portal-offers'],
    queryFn: portalGetOffers,
    refetchInterval: 30000,
  });

  const { data: profile } = useQuery({
    queryKey: ['portal-profile'],
    queryFn: portalGetProfile,
  });

  const offerList = offers as Record<string, unknown>[];
  const profileData = profile as Record<string, unknown> | undefined;

  // Determine if profile is incomplete (no category or no platform handles)
  const isProfileIncomplete = profileData && (
    !profileData.category ||
    (!profileData.handle && !profileData.platforms)
  );

  const stats = {
    pending:   offerList.filter(o => ['pending','sent'].includes(String(o.status))).length,
    active:    offerList.filter(o => ['accepted','in_progress'].includes(String(o.status))).length,
    submitted: offerList.filter(o => o.status === 'submitted').length,
    completed: offerList.filter(o => o.status === 'completed').length,
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Onboarding banner */}
      {isProfileIncomplete && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-900/30 border border-amber-700/50 text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <p className="text-sm flex-1">
            Complete your profile to appear in brand searches.
          </p>
          <Link
            to="/portal/profile"
            className="text-xs font-semibold underline underline-offset-2 hover:text-amber-200 shrink-0"
          >
            Complete profile
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Awaiting Response', value: stats.pending,   color: 'text-blue-400' },
          { label: 'In Progress',        value: stats.active,    color: 'text-amber-400' },
          { label: 'Submitted',          value: stats.submitted, color: 'text-purple-400' },
          { label: 'Completed',          value: stats.completed, color: 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <div className={cn('text-2xl font-bold', s.color)}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Offers list */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-surface-border flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-300">My Offers</h2>
          {stats.pending > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-900/40 text-blue-300 border border-blue-800/40">
              {stats.pending} new
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="skeleton h-12 w-12 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-48" />
                  <div className="skeleton h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : offerList.length === 0 ? (
          <div className="py-16 text-center">
            <Megaphone className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No offers yet</p>
            <p className="text-xs text-gray-600 mt-1">When the agency sends you an offer, it will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-border/50">
            {offerList.map(offer => (
              <Link
                key={String(offer.id)}
                to={`/portal/offers/${offer.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-surface-overlay transition-colors group"
              >
                {/* Icon */}
                <div className="w-10 h-10 rounded-lg bg-surface-overlay border border-surface-border flex items-center justify-center text-gray-400 shrink-0">
                  <Megaphone className="w-4 h-4" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white group-hover:text-white text-sm truncate">
                    {String(offer.title)}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {!!offer.campaign_name && (
                      <span className="text-xs text-gray-500">{String(offer.campaign_name)}</span>
                    )}
                    {!!offer.platform && (
                      <span className="text-xs text-gray-600">· {String(offer.platform)}</span>
                    )}
                    {!!offer.deadline && (
                      <span className="text-xs text-gray-600">· Due {formatDate(String(offer.deadline))}</span>
                    )}
                  </div>
                </div>

                {/* Rate */}
                {!!offer.rate && (
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-white">{formatRate(Number(offer.rate))}</p>
                    <p className="text-xs text-gray-500">{String(offer.currency || 'SAR')}</p>
                  </div>
                )}

                {/* Status */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                    STATUS_STYLES[String(offer.status)] || STATUS_STYLES.pending
                  )}>
                    {STATUS_ICON[String(offer.status)]}
                    {String(offer.status).replace('_', ' ')}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
