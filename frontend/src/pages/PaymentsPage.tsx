/**
 * Payments tracking page — agency/admin dashboard.
 * Lists completed/approved offers with payment status management.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, CheckCircle, Clock, DollarSign, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getPayments,
  getPaymentSummary,
  markPaymentPaid,
  markPaymentUnpaid,
  type PaymentOffer,
} from '../utils/api';
import { cn, formatDate } from '../utils/helpers';

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function formatMoney(amount: number, currency = 'SAR'): string {
  return `${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${currency}`;
}

/* ── Summary stat card ────────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  sub,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  icon: React.ElementType;
}) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={cn('p-2 rounded-lg', color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-white mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/* ── Mark Paid Modal ──────────────────────────────────────────────────────── */

function MarkPaidModal({
  offer,
  onClose,
  onConfirm,
  isPending,
}: {
  offer: PaymentOffer;
  onClose: () => void;
  onConfirm: (reference: string, notes: string) => void;
  isPending: boolean;
}) {
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1c1c1c] border border-surface-border rounded-xl w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <div>
            <h3 className="text-sm font-semibold text-white">Mark as Paid</h3>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{offer.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-overlay text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          <div className="p-3 bg-surface-overlay rounded-lg border border-surface-border flex items-center justify-between">
            <span className="text-sm text-gray-400">Amount</span>
            <span className="text-sm font-semibold text-white">
              {formatMoney(offer.rate ?? 0, offer.currency)}
            </span>
          </div>
          <div>
            <label className="label">Payment Reference <span className="text-gray-600">(optional)</span></label>
            <input
              className="input"
              placeholder="Invoice #, transfer ID, cheque #…"
              value={reference}
              onChange={e => setReference(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Notes <span className="text-gray-600">(optional)</span></label>
            <textarea
              className="input resize-none h-20 text-sm"
              placeholder="Any additional notes about this payment…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-surface-border flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reference, notes)}
            disabled={isPending}
            className="btn-primary flex-1"
          >
            <CheckCircle className="w-4 h-4" />
            {isPending ? 'Marking…' : 'Confirm Paid'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Payment row ─────────────────────────────────────────────────────────── */

function PaymentRow({
  offer,
  onMarkPaid,
  onMarkUnpaid,
}: {
  offer: PaymentOffer;
  onMarkPaid: (offer: PaymentOffer) => void;
  onMarkUnpaid: (id: string) => void;
}) {
  const isPaid = offer.payment_status === 'paid';

  return (
    <tr className="border-b border-surface-border/40 hover:bg-surface-overlay/50 transition-colors last:border-0">
      {/* Influencer */}
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-white">
          {offer.influencer_name || <span className="text-gray-600">—</span>}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {offer.ig_handle ? `@${offer.ig_handle}` : offer.tiktok_handle ? `@${offer.tiktok_handle}` : ''}
        </p>
      </td>

      {/* Campaign */}
      <td className="px-4 py-3">
        <p className="text-sm text-gray-300">{offer.campaign_name || <span className="text-gray-600">—</span>}</p>
      </td>

      {/* Title */}
      <td className="px-4 py-3">
        <p className="text-sm text-gray-300 max-w-[200px] truncate">{offer.title}</p>
      </td>

      {/* Rate */}
      <td className="px-4 py-3 text-right">
        <p className="text-sm font-semibold text-white tabular-nums">
          {(offer.rate ?? 0).toLocaleString()}
        </p>
        <p className="text-xs text-gray-600">{offer.currency}</p>
      </td>

      {/* Offer status */}
      <td className="px-4 py-3">
        <span className={cn(
          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
          offer.status === 'completed'
            ? 'bg-gray-700 text-gray-300 border-gray-600'
            : 'bg-emerald-900/40 text-emerald-300 border-emerald-700/40',
        )}>
          {offer.status}
        </span>
      </td>

      {/* Payment status */}
      <td className="px-4 py-3">
        <span className={cn(
          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
          isPaid
            ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700/40'
            : 'bg-amber-900/30 text-amber-300 border-amber-700/30',
        )}>
          {isPaid ? 'Paid' : 'Unpaid'}
        </span>
      </td>

      {/* Paid at */}
      <td className="px-4 py-3">
        <p className="text-xs text-gray-400">
          {offer.paid_at ? formatDate(offer.paid_at) : <span className="text-gray-700">—</span>}
        </p>
      </td>

      {/* Reference */}
      <td className="px-4 py-3">
        {offer.payment_reference ? (
          <span className="inline-block bg-surface-overlay border border-surface-border text-xs text-gray-300 px-2 py-0.5 rounded-full max-w-[120px] truncate">
            {offer.payment_reference}
          </span>
        ) : (
          <span className="text-gray-700 text-xs">—</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        {isPaid ? (
          <button
            onClick={() => onMarkUnpaid(offer.id)}
            className="text-xs text-gray-500 hover:text-amber-400 underline transition-colors"
          >
            Mark Unpaid
          </button>
        ) : (
          <button
            onClick={() => onMarkPaid(offer)}
            className="btn-primary btn-sm"
          >
            <CheckCircle className="w-3.5 h-3.5" /> Mark Paid
          </button>
        )}
      </td>
    </tr>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */

type PaymentFilter = 'all' | 'unpaid' | 'paid';

export default function PaymentsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<PaymentFilter>('all');
  const [search, setSearch] = useState('');
  const [modalOffer, setModalOffer] = useState<PaymentOffer | null>(null);

  /* Queries */
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['payment-summary'],
    queryFn: getPaymentSummary,
    refetchInterval: 30000,
  });

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments', filter],
    queryFn: () => getPayments({ payment_status: filter, limit: 200 }),
    refetchInterval: 30000,
  });

  /* Mutations */
  const markPaidMutation = useMutation({
    mutationFn: ({ id, reference, notes }: { id: string; reference: string; notes: string }) =>
      markPaymentPaid(id, {
        payment_reference: reference || undefined,
        payment_notes: notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['payment-summary'] });
      toast.success('Payment marked as paid');
      setModalOffer(null);
    },
    onError: () => toast.error('Failed to mark payment'),
  });

  const markUnpaidMutation = useMutation({
    mutationFn: (id: string) => markPaymentUnpaid(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['payment-summary'] });
      toast.success('Payment reset to unpaid');
    },
    onError: () => toast.error('Failed to update payment'),
  });

  /* Client-side search filter */
  const allOffers = paymentsData?.data ?? [];
  const offers = search.trim()
    ? allOffers.filter(o => {
        const q = search.toLowerCase();
        return (
          o.influencer_name?.toLowerCase().includes(q) ||
          o.campaign_name?.toLowerCase().includes(q) ||
          o.title?.toLowerCase().includes(q) ||
          o.ig_handle?.toLowerCase().includes(q)
        );
      })
    : allOffers;

  const summary = summaryData;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-emerald-400" />
          Payments
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Track and manage influencer payments for completed offers</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-5">
              <div className="skeleton h-4 w-20 mb-2" />
              <div className="skeleton h-7 w-28" />
            </div>
          ))
        ) : summary ? (
          <>
            <StatCard
              label="Total Earned"
              value={formatMoney(summary.total_earned)}
              sub={`${(summary.count_paid + summary.count_unpaid)} offers`}
              color="bg-blue-900/40 text-blue-400"
              icon={DollarSign}
            />
            <StatCard
              label="Total Paid"
              value={formatMoney(summary.total_paid)}
              sub={`${summary.count_paid} offers paid`}
              color="bg-emerald-900/40 text-emerald-400"
              icon={CheckCircle}
            />
            <StatCard
              label="Outstanding"
              value={formatMoney(summary.total_unpaid)}
              sub={`${summary.count_unpaid} offers unpaid`}
              color="bg-amber-900/40 text-amber-400"
              icon={Clock}
            />
            <StatCard
              label="Paid / Unpaid"
              value={`${summary.count_paid} / ${summary.count_unpaid}`}
              sub="completed offers"
              color="bg-purple-900/40 text-purple-400"
              icon={CreditCard}
            />
          </>
        ) : null}
      </div>

      {/* Filter + search bar */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-surface-border flex flex-wrap items-center gap-3">
          {/* Tab filters */}
          <div className="flex gap-1.5">
            {(['all', 'unpaid', 'paid'] as PaymentFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-all capitalize',
                  filter === f
                    ? 'bg-white text-[#1c1c1c] border-white'
                    : 'text-gray-400 border-surface-border hover:border-white/20 hover:text-white',
                )}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search */}
          <input
            type="text"
            className="input w-56 text-sm"
            placeholder="Search influencer or campaign…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        {paymentsLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-4 w-36" />
                  <div className="skeleton h-3 w-24" />
                </div>
                <div className="skeleton h-4 w-24" />
                <div className="skeleton h-6 w-16 rounded-full" />
                <div className="skeleton h-7 w-20 rounded-lg" />
              </div>
            ))}
          </div>
        ) : offers.length === 0 ? (
          <div className="py-16 text-center">
            <CreditCard className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No payments found</p>
            <p className="text-xs text-gray-600 mt-1">
              Payments appear here once an offer reaches &quot;completed&quot; or &quot;approved&quot; status
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[900px]">
              <thead>
                <tr className="border-b border-surface-border">
                  {[
                    'Influencer',
                    'Campaign',
                    'Title',
                    'Rate',
                    'Status',
                    'Payment',
                    'Paid At',
                    'Reference',
                    'Actions',
                  ].map(col => (
                    <th
                      key={col}
                      className={cn(
                        'px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap',
                        col === 'Rate' ? 'text-right' : '',
                      )}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {offers.map(offer => (
                  <PaymentRow
                    key={offer.id}
                    offer={offer}
                    onMarkPaid={o => setModalOffer(o)}
                    onMarkUnpaid={id => markUnpaidMutation.mutate(id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Row count footer */}
        {!paymentsLoading && offers.length > 0 && (
          <div className="px-5 py-3 border-t border-surface-border">
            <p className="text-xs text-gray-600">
              {offers.length} offer{offers.length !== 1 ? 's' : ''} shown
              {paymentsData?.total !== undefined && paymentsData.total !== offers.length
                ? ` (filtered from ${paymentsData.total})`
                : ''}
            </p>
          </div>
        )}
      </div>

      {/* Mark Paid Modal */}
      {modalOffer && (
        <MarkPaidModal
          offer={modalOffer}
          onClose={() => setModalOffer(null)}
          onConfirm={(reference, notes) =>
            markPaidMutation.mutate({ id: modalOffer.id, reference, notes })
          }
          isPending={markPaidMutation.isPending}
        />
      )}
    </div>
  );
}
