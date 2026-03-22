/**
 * Billing & Subscription page — Stripe-powered plan management.
 */
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { CreditCard, CheckCircle, Loader2, ExternalLink, AlertCircle, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { getBillingStatus, createCheckoutSession, openBillingPortal } from '../utils/api';
import { cn } from '../utils/helpers';

const PLANS = [
  {
    id: 'starter' as const,
    name: 'Starter',
    price: 'SAR 499',
    period: '/mo',
    desc: 'For small agencies just getting started',
    features: [
      'Up to 500 influencers',
      '3 team users',
      'Campaign management',
      'Offer tracking',
      'CSV import / export',
      'Email notifications',
    ],
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    price: 'SAR 999',
    period: '/mo',
    desc: 'For growing agencies managing multiple brands',
    highlighted: true,
    features: [
      'Up to 2,000 influencers',
      '10 team users',
      'Everything in Starter',
      'API access',
      'Advanced analytics',
      'Influencer portal',
      'Priority support',
    ],
  },
  {
    id: 'enterprise' as const,
    name: 'Enterprise',
    price: 'SAR 2,499',
    period: '/mo',
    desc: 'For large agencies and platforms',
    features: [
      'Unlimited influencers',
      'Unlimited team users',
      'Everything in Pro',
      'White-label branding',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantee',
    ],
  },
];

const STATUS_BADGE: Record<string, string> = {
  active:    'bg-emerald-900/40 text-emerald-300 border border-emerald-700/40',
  trial:     'bg-blue-900/40 text-blue-300 border border-blue-700/40',
  past_due:  'bg-amber-900/40 text-amber-300 border border-amber-700/40',
  cancelled: 'bg-red-900/40 text-red-300 border border-red-700/40',
};

export default function BillingPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('success') === '1') {
      toast.success('Subscription activated! Welcome aboard. 🎉');
      setSearchParams({}, { replace: true });
    } else if (searchParams.get('cancelled') === '1') {
      toast('Checkout cancelled — no changes made.', { icon: 'ℹ️' });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data: status, isLoading, error } = useQuery({
    queryKey: ['billing-status'],
    queryFn: getBillingStatus,
    retry: false,
  });

  const checkoutMutation = useMutation({
    mutationFn: createCheckoutSession,
    onSuccess: ({ url }) => { if (url) window.location.href = url; },
    onError: (err: Error) => toast.error(err.message || 'Failed to open checkout'),
  });

  const portalMutation = useMutation({
    mutationFn: openBillingPortal,
    onSuccess: ({ url }) => { if (url) window.location.href = url; },
    onError: (err: Error) => toast.error(err.message || 'Failed to open billing portal'),
  });

  const currentPlan   = status?.plan   || 'starter';
  const currentStatus = status?.status || 'trial';
  const periodEnd = status?.period_end
    ? new Date(status.period_end).toLocaleDateString('en-SA', { dateStyle: 'long' })
    : null;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Billing &amp; Subscription</h2>
          <p className="text-sm text-gray-400 mt-0.5">Manage your plan, payment method, and invoices.</p>
        </div>
        {status?.has_customer && (
          <button
            onClick={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
            className="btn-secondary shrink-0"
          >
            {portalMutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <ExternalLink className="w-4 h-4" />}
            Manage Billing
          </button>
        )}
      </div>

      {/* Current status card */}
      {isLoading ? (
        <div className="card p-5 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
          <span className="text-sm text-gray-400">Loading subscription status…</span>
        </div>
      ) : error ? (
        <div className="card p-5 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
          <span className="text-sm text-amber-300">Could not load subscription details. Make sure Stripe is configured.</span>
        </div>
      ) : status ? (
        <div className="card p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-900/30 border border-blue-700/30 flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-white capitalize">{currentPlan} Plan</span>
              <span className={cn('text-xs px-2 py-0.5 rounded-full capitalize', STATUS_BADGE[currentStatus] || STATUS_BADGE.trial)}>
                {currentStatus}
              </span>
            </div>
            {periodEnd && (
              <p className="text-xs text-gray-500 mt-0.5">Renews {periodEnd}</p>
            )}
            {currentStatus === 'trial' && (
              <p className="text-xs text-amber-400 mt-0.5">You are on a free trial. Subscribe to continue after the trial ends.</p>
            )}
          </div>
        </div>
      ) : null}

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {PLANS.map(plan => {
          const isCurrent = currentPlan === plan.id;
          const isLoading = checkoutMutation.isPending && checkoutMutation.variables === plan.id;
          return (
            <div
              key={plan.id}
              className={cn(
                'card p-6 flex flex-col gap-5 relative',
                plan.highlighted && 'ring-1 ring-white/10',
                isCurrent && 'ring-1 ring-emerald-500/40'
              )}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white text-black text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                  <Zap className="w-3 h-3" /> Most Popular
                </div>
              )}
              {isCurrent && !plan.highlighted && (
                <div className="absolute -top-3 right-4 flex items-center gap-1 bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                  <CheckCircle className="w-3 h-3" /> Current
                </div>
              )}

              <div>
                <h3 className="text-base font-bold text-white">{plan.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{plan.desc}</p>
                <div className="mt-3 flex items-end gap-0.5">
                  <span className="text-2xl font-bold text-white">{plan.price}</span>
                  <span className="text-sm text-gray-500 mb-0.5">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-2 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs text-gray-400">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => !isCurrent && checkoutMutation.mutate(plan.id)}
                disabled={isCurrent || checkoutMutation.isPending}
                className={cn(
                  'w-full py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2',
                  isCurrent
                    ? 'bg-surface-overlay text-gray-500 cursor-default'
                    : plan.highlighted
                      ? 'bg-white text-black hover:bg-gray-100'
                      : 'btn-primary'
                )}
              >
                {isLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting…</>
                  : isCurrent
                    ? <><CheckCircle className="w-4 h-4" /> Current Plan</>
                    : 'Upgrade →'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Note */}
      <p className="text-xs text-gray-600 text-center">
        Prices are in Saudi Riyal (SAR) and billed monthly. Cancel anytime from the billing portal.
        Payments are processed securely via Stripe.
      </p>
    </div>
  );
}
