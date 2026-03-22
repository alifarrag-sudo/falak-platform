/**
 * Portal Loyalty Page — shows the influencer's loyalty tier, points,
 * commission discount, and recent points history.
 */
import { useQuery } from '@tanstack/react-query';
import { Star, Trophy, Zap, Gift, ChevronRight, TrendingUp } from 'lucide-react';
import { portalGetMyLoyalty, portalGetLoyaltyHistory } from '../../utils/api';
import { cn } from '../../utils/helpers';

const TIERS: Record<string, { color: string; bg: string; ring: string; icon: string }> = {
  Bronze:   { color: 'text-amber-600',   bg: 'bg-amber-900/20',   ring: 'ring-amber-700/30',   icon: '🥉' },
  Silver:   { color: 'text-gray-300',    bg: 'bg-gray-800/40',    ring: 'ring-gray-600/30',    icon: '🥈' },
  Gold:     { color: 'text-yellow-400',  bg: 'bg-yellow-900/20',  ring: 'ring-yellow-700/30',  icon: '🥇' },
  Platinum: { color: 'text-cyan-300',    bg: 'bg-cyan-900/20',    ring: 'ring-cyan-700/30',    icon: '💎' },
};

const ACTION_LABELS: Record<string, string> = {
  offer_accepted:           'Offer accepted',
  offer_completed:          'Deliverable approved',
  fan_request_fulfilled:    'Fan request fulfilled',
  review_left:              'Review received',
  manual:                   'Bonus points',
};

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 100;
  return (
    <div className="w-full h-2 bg-surface-overlay rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 rounded-full transition-all duration-700"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function PortalLoyaltyPage() {
  const { data: loyalty, isLoading } = useQuery({
    queryKey: ['portal-loyalty'],
    queryFn: portalGetMyLoyalty,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['portal-loyalty-history'],
    queryFn: portalGetLoyaltyHistory,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-6 h-6 rounded-full border-2 border-yellow-400/30 border-t-yellow-400 animate-spin" />
      </div>
    );
  }

  const tier = loyalty?.tier || 'Bronze';
  const tierStyle = TIERS[tier] || TIERS.Bronze;
  const totalPoints = loyalty?.total_points || 0;
  const toNext = loyalty?.points_to_next_tier || 0;
  const nextTier = loyalty?.next_tier;
  const commDiscount = loyalty?.commission_discount_pct || 0;
  const effectiveComm = loyalty?.effective_commission_pct ?? 10;

  return (
    <div className="space-y-6 max-w-2xl mx-auto p-4">
      {/* Tier Card */}
      <div className={cn('rounded-2xl p-6 ring-1 flex flex-col gap-4', tierStyle.bg, tierStyle.ring)}>
        <div className="flex items-center gap-4">
          <div className="text-5xl">{tierStyle.icon}</div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Your Tier</p>
            <h2 className={cn('text-3xl font-bold', tierStyle.color)}>{tier}</h2>
            <p className="text-sm text-gray-400 mt-0.5">{totalPoints.toLocaleString()} points earned</p>
          </div>
        </div>

        {nextTier && toNext > 0 ? (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-400">
              <span>{totalPoints.toLocaleString()} pts</span>
              <span>{(totalPoints + toNext).toLocaleString()} pts → {nextTier}</span>
            </div>
            <ProgressBar value={totalPoints} max={totalPoints + toNext} />
            <p className="text-xs text-gray-500">
              Earn <span className="text-white font-medium">{toNext} more points</span> to reach {nextTier}
            </p>
          </div>
        ) : (
          <p className="text-xs text-cyan-400 font-medium">You've reached the highest tier! 🎉</p>
        )}
      </div>

      {/* Benefits */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Gift className="w-4 h-4 text-yellow-400" /> Your Benefits
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm text-white">Platform Commission</p>
                <p className="text-xs text-gray-500">% taken from your accepted offers</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-emerald-400">{effectiveComm}%</span>
              {commDiscount > 0 && (
                <p className="text-xs text-emerald-600">-{commDiscount}% {tier} discount</p>
              )}
            </div>
          </div>

          {tier === 'Gold' || tier === 'Platinum' ? (
            <div className="flex items-center gap-3">
              <Star className="w-4 h-4 text-yellow-400 shrink-0" />
              <div>
                <p className="text-sm text-white">Featured in Discover</p>
                <p className="text-xs text-gray-500">Your profile appears higher in search results</p>
              </div>
              <span className="ml-auto text-xs text-yellow-400 font-medium">Active</span>
            </div>
          ) : null}

          {tier === 'Platinum' ? (
            <div className="flex items-center gap-3">
              <Zap className="w-4 h-4 text-cyan-400 shrink-0" />
              <div>
                <p className="text-sm text-white">Priority Matching</p>
                <p className="text-xs text-gray-500">Agencies see your profile first for matching briefs</p>
              </div>
              <span className="ml-auto text-xs text-cyan-400 font-medium">Active</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* How to earn points */}
      <div className="card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-400" /> How to Earn Points
        </h3>
        <div className="space-y-2 text-sm">
          {[
            { action: 'Accept an offer',           points: 10 },
            { action: 'Get a deliverable approved', points: 25 },
            { action: 'Fulfil a fan request',      points: 10 },
          ].map(({ action, points }) => (
            <div key={action} className="flex items-center justify-between text-gray-400">
              <div className="flex items-center gap-2">
                <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                {action}
              </div>
              <span className="text-yellow-400 font-semibold">+{points} pts</span>
            </div>
          ))}
        </div>
      </div>

      {/* Points History */}
      {(history as Record<string, unknown>[]).length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-surface-border">
            <h3 className="text-sm font-semibold text-white">Points History</h3>
          </div>
          <div className="divide-y divide-surface-border/50">
            {(history as Record<string, unknown>[]).map(h => (
              <div key={String(h.id)} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm text-gray-300">
                    {ACTION_LABELS[String(h.action)] || String(h.action)}
                  </p>
                  {h.note ? <p className="text-xs text-gray-600">{String(h.note)}</p> : null}
                  <p className="text-xs text-gray-600">
                    {h.created_at ? new Date(String(h.created_at)).toLocaleDateString() : ''}
                  </p>
                </div>
                <span className="text-yellow-400 font-bold text-sm">+{Number(h.points)} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
