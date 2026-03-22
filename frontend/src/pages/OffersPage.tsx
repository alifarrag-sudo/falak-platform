import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, ExternalLink, MessageSquare, Plus, Download, RefreshCw, Search, X as XIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { getOffers, getOfferStats, reviewDeliverable, downloadOfferContract, updateOffer, counterOffer, acceptCounterOffer, getCampaigns } from '../utils/api';
import type { Campaign } from '../types';
import { cn, formatDate, formatRate } from '../utils/helpers';
import SendOfferModal from '../components/offers/SendOfferModal';

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

const DELIVERABLE_STATUS_STYLES: Record<string, string> = {
  submitted:          'bg-blue-900/40 text-blue-300 border border-blue-800/40',
  approved:           'bg-emerald-900/40 text-emerald-300 border border-emerald-800/40',
  rejected:           'bg-red-900/40 text-red-300 border border-red-800/40',
  revision_requested: 'bg-amber-900/40 text-amber-300 border border-amber-800/40',
};

const STATUS_FILTERS = ['all', 'sent', 'accepted', 'submitted', 'approved', 'declined', 'completed'];

type Deliverable = Record<string, unknown>;
type Offer = Record<string, unknown> & { deliverables?: Deliverable[] };

function ReviewPanel({ offerId, deliverable, onDone }: {
  offerId: string;
  deliverable: Deliverable;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState('');
  const [liveUrl, setLiveUrl] = useState('');

  const reviewMutation = useMutation({
    mutationFn: (decision: string) =>
      reviewDeliverable(offerId, String(deliverable.id), { decision, feedback, live_url: liveUrl }),
    onSuccess: (_, decision) => {
      qc.invalidateQueries({ queryKey: ['offers'] });
      toast.success(decision === 'approved' ? 'Submission approved!' : decision === 'rejected' ? 'Submission rejected' : 'Revision requested');
      onDone();
    },
    onError: () => toast.error('Failed to review submission'),
  });

  return (
    <div className="mt-3 p-3 bg-surface-overlay rounded-lg border border-surface-border space-y-3">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Review Submission</p>
      <div>
        <label className="label">Feedback (optional)</label>
        <textarea
          className="input resize-none h-16 text-sm"
          placeholder="Feedback for the influencer..."
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Live URL (optional)</label>
        <input
          className="input text-sm"
          placeholder="https://..."
          value={liveUrl}
          onChange={e => setLiveUrl(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => reviewMutation.mutate('approved')}
          disabled={reviewMutation.isPending}
          className="btn-primary btn-sm flex-1"
        >
          <CheckCircle className="w-3.5 h-3.5" /> Approve
        </button>
        <button
          onClick={() => reviewMutation.mutate('revision_requested')}
          disabled={reviewMutation.isPending}
          className="btn-secondary btn-sm flex-1"
        >
          <MessageSquare className="w-3.5 h-3.5" /> Request Revision
        </button>
        <button
          onClick={() => reviewMutation.mutate('rejected')}
          disabled={reviewMutation.isPending}
          className="btn-danger btn-sm flex-1"
        >
          <XCircle className="w-3.5 h-3.5" /> Reject
        </button>
      </div>
    </div>
  );
}

const CONTRACT_STATUSES = new Set(['accepted', 'in_progress', 'submitted', 'approved', 'completed']);

function OfferRow({ offer }: { offer: Offer }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [downloadingContract, setDownloadingContract] = useState(false);
  const [agencyNotes, setAgencyNotes] = useState(String(offer.agency_notes || ''));
  const [savingNotes, setSavingNotes] = useState(false);
  const [showCounter, setShowCounter] = useState(false);
  const [counterForm, setCounterForm] = useState({ counter_rate: '', counter_notes: '', counter_currency: 'SAR' });
  const [submittingCounter, setSubmittingCounter] = useState(false);
  const status = String(offer.status || '');

  const saveNotes = async () => {
    if (agencyNotes === String(offer.agency_notes || '')) return;
    setSavingNotes(true);
    try {
      await updateOffer(String(offer.id), { agency_notes: agencyNotes });
      qc.invalidateQueries({ queryKey: ['offers'] });
    } catch {
      toast.error('Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };
  const deliverables = (offer.deliverables as Deliverable[]) || [];
  const hasSubmissions = deliverables.length > 0;

  const handleDownloadContract = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadingContract(true);
    try {
      await downloadOfferContract(String(offer.id));
    } catch {
      toast.error('Failed to download contract');
    } finally {
      setDownloadingContract(false);
    }
  };

  return (
    <div className="border-b border-surface-border/50 last:border-0">
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-surface-overlay transition-colors text-left"
      >
        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white text-sm truncate">{String(offer.title)}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {!!offer.influencer_name && (
              <span className="text-xs text-gray-400">{String(offer.influencer_name)}</span>
            )}
            {!!offer.campaign_name && (
              <span className="text-xs text-gray-600">· {String(offer.campaign_name)}</span>
            )}
            {!!offer.platform && (
              <span className="text-xs text-gray-600">· {String(offer.platform)}</span>
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

        {/* Deadline */}
        {!!offer.deadline && (
          <div className="shrink-0 text-right hidden sm:block">
            <p className="text-xs text-gray-500">Due</p>
            <p className="text-xs text-gray-300">{formatDate(String(offer.deadline))}</p>
          </div>
        )}

        {/* Status */}
        <div className="flex items-center gap-2 shrink-0">
          {hasSubmissions && (
            <span className="text-xs text-purple-400 font-medium">{deliverables.length} sub.</span>
          )}
          <span className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
            STATUS_STYLES[status] || STATUS_STYLES.pending
          )}>
            {status.replace('_', ' ')}
          </span>
          {CONTRACT_STATUSES.has(status) && (
            <button
              onClick={handleDownloadContract}
              disabled={downloadingContract}
              title="Download contract PDF"
              className={cn(
                'inline-flex items-center justify-center w-7 h-7 rounded-md border transition-all',
                'border-surface-border text-gray-400 hover:text-white hover:border-white/30 hover:bg-surface-overlay',
                downloadingContract && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4 bg-surface-overlay/30">
          {/* Offer details */}
          <div className="grid grid-cols-2 gap-3 pt-3 text-xs">
            {!!offer.brief && (
              <div className="col-span-2">
                <p className="text-gray-500 mb-1">Brief</p>
                <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{String(offer.brief)}</p>
              </div>
            )}
            {!!offer.sent_at && (
              <div>
                <p className="text-gray-500">Sent</p>
                <p className="text-gray-300">{formatDate(String(offer.sent_at))}</p>
              </div>
            )}
            {!!offer.responded_at && (
              <div>
                <p className="text-gray-500">Responded</p>
                <p className="text-gray-300">{formatDate(String(offer.responded_at))}</p>
              </div>
            )}
            {!!offer.influencer_notes && (
              <div className="col-span-2 p-2 bg-surface-overlay rounded-lg border border-surface-border">
                <p className="text-gray-500 mb-0.5">Influencer note</p>
                <p className="text-gray-300">{String(offer.influencer_notes)}</p>
              </div>
            )}
          </div>

          {/* Counter-offer panel */}
          {(status === 'sent' || status === 'accepted' || status === 'negotiating') && (
            <div className="space-y-2">
              {/* Show pending counter-offer from influencer */}
              {!!offer.counter_rate && offer.counter_by === 'influencer' && (
                <div className="p-3 bg-amber-900/20 rounded-lg border border-amber-800/40 space-y-2">
                  <p className="text-xs font-medium text-amber-300">Counter-offer from influencer</p>
                  <p className="text-sm text-white font-semibold">
                    {String(offer.counter_currency ?? 'SAR')} {Number(offer.counter_rate).toLocaleString()}
                  </p>
                  {!!offer.counter_notes && <p className="text-xs text-gray-300">{String(offer.counter_notes)}</p>}
                  <div className="flex gap-2">
                    <button
                      className="btn-primary btn-sm"
                      onClick={async () => {
                        try {
                          await acceptCounterOffer(String(offer.id));
                          qc.invalidateQueries({ queryKey: ['offers'] });
                          toast.success('Counter-offer accepted');
                        } catch { toast.error('Failed'); }
                      }}
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Accept Counter
                    </button>
                    <button className="btn-secondary btn-sm" onClick={() => setShowCounter(true)}>
                      <RefreshCw className="w-3.5 h-3.5" /> Counter Back
                    </button>
                  </div>
                </div>
              )}

              {/* Counter button (agency side) */}
              {!offer.counter_rate && !showCounter && (
                <button className="btn-ghost btn-sm text-xs text-gray-500" onClick={() => setShowCounter(true)}>
                  <RefreshCw className="w-3 h-3" /> Propose Counter-Offer
                </button>
              )}

              {showCounter && (
                <div className="p-3 bg-surface-overlay rounded-lg border border-surface-border space-y-2">
                  <p className="text-xs font-medium text-gray-400">Propose Counter-Offer (Agency)</p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      className="input flex-1 text-sm py-1.5"
                      placeholder="New rate"
                      value={counterForm.counter_rate}
                      onChange={e => setCounterForm(p => ({ ...p, counter_rate: e.target.value }))}
                    />
                    <select
                      className="input w-24 text-sm py-1.5"
                      value={counterForm.counter_currency}
                      onChange={e => setCounterForm(p => ({ ...p, counter_currency: e.target.value }))}
                    >
                      <option>SAR</option><option>USD</option><option>AED</option><option>KWD</option>
                    </select>
                  </div>
                  <textarea
                    className="input text-sm resize-none h-12"
                    placeholder="Notes for influencer..."
                    value={counterForm.counter_notes}
                    onChange={e => setCounterForm(p => ({ ...p, counter_notes: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <button
                      className="btn-primary btn-sm"
                      disabled={!counterForm.counter_rate || submittingCounter}
                      onClick={async () => {
                        setSubmittingCounter(true);
                        try {
                          await counterOffer(String(offer.id), {
                            counter_rate: Number(counterForm.counter_rate),
                            counter_currency: counterForm.counter_currency,
                            counter_notes: counterForm.counter_notes,
                            counter_by: 'agency',
                          });
                          qc.invalidateQueries({ queryKey: ['offers'] });
                          toast.success('Counter-offer sent');
                          setShowCounter(false);
                          setCounterForm({ counter_rate: '', counter_notes: '', counter_currency: 'SAR' });
                        } catch { toast.error('Failed to send counter'); }
                        finally { setSubmittingCounter(false); }
                      }}
                    >
                      Send Counter
                    </button>
                    <button className="btn-ghost btn-sm" onClick={() => setShowCounter(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Agency notes */}
          <div>
            <label className="label text-xs">Agency Notes (internal)</label>
            <textarea
              className="input resize-none h-16 text-xs"
              placeholder="Internal notes about this offer..."
              value={agencyNotes}
              onChange={e => setAgencyNotes(e.target.value)}
              onBlur={saveNotes}
            />
            {savingNotes && <p className="text-xs text-gray-500 mt-0.5">Saving...</p>}
          </div>

          {/* Submissions */}
          {deliverables.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                Submissions ({deliverables.length})
              </p>
              {deliverables.map(d => (
                <div key={String(d.id)} className="p-3 bg-surface-overlay rounded-lg border border-surface-border space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {!!d.content_url && (
                        <a
                          href={String(d.content_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 truncate"
                        >
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{String(d.content_url)}</span>
                        </a>
                      )}
                      {!!d.caption && <p className="text-xs text-gray-400 mt-1 italic">"{String(d.caption)}"</p>}
                      {!!d.notes && <p className="text-xs text-gray-500 mt-1">{String(d.notes)}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                        DELIVERABLE_STATUS_STYLES[String(d.status)] || DELIVERABLE_STATUS_STYLES.submitted
                      )}>
                        {String(d.status).replace('_', ' ')}
                      </span>
                      {d.status === 'submitted' && (
                        <button
                          onClick={() => setReviewingId(prev => prev === String(d.id) ? null : String(d.id))}
                          className="btn-secondary btn-sm"
                        >
                          Review
                        </button>
                      )}
                    </div>
                  </div>
                  {!!d.feedback && (
                    <p className="text-xs text-gray-400 bg-surface-subtle rounded px-2 py-1 border border-surface-border">
                      <span className="text-gray-500">Your feedback: </span>{String(d.feedback)}
                    </p>
                  )}
                  <p className="text-xs text-gray-600">Submitted {formatDate(String(d.submitted_at))}</p>
                  {reviewingId === String(d.id) && (
                    <ReviewPanel
                      offerId={String(offer.id)}
                      deliverable={d}
                      onDone={() => setReviewingId(null)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function OffersPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [campaignFilter, setCampaignFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [showSendOffer, setShowSendOffer] = useState(false);

  const { data: campaignsData } = useQuery({
    queryKey: ['offers-page-campaigns'],
    queryFn: getCampaigns,
    staleTime: 60000,
  });
  const campaigns = (campaignsData || []) as Campaign[];

  const params: Record<string, string> = {};
  if (statusFilter !== 'all') params.status = statusFilter;
  if (campaignFilter) params.campaign_id = campaignFilter;
  if (search) params.search = search;
  params.limit = '50';

  const { data, isLoading } = useQuery({
    queryKey: ['offers', statusFilter, campaignFilter, search],
    queryFn: () => getOffers(params),
    refetchInterval: 15000,
  });

  const { data: stats } = useQuery({
    queryKey: ['offer-stats'],
    queryFn: getOfferStats,
    refetchInterval: 30000,
  });

  const offers = (data?.data || []) as Offer[];
  const statsData = stats as Record<string, number> | undefined;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Offers</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track and manage all influencer offers</p>
        </div>
        <button onClick={() => setShowSendOffer(true)} className="btn-primary btn-sm">
          <Plus className="w-4 h-4" /> Send Offer
        </button>
      </div>

      {/* Send offer modal (no pre-filled influencer — user picks from campaign) */}
      <SendOfferModal
        open={showSendOffer}
        onClose={() => setShowSendOffer(false)}
      />

      {/* Stats */}
      {statsData && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Sent',      value: (statsData.sent || 0) + (statsData.pending || 0), color: 'text-blue-400' },
            { label: 'Active',    value: (statsData.accepted || 0) + (statsData.in_progress || 0), color: 'text-amber-400' },
            { label: 'Submitted', value: statsData.submitted || 0, color: 'text-purple-400' },
            { label: 'Completed', value: statsData.completed || 0, color: 'text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="card p-4 text-center">
              <div className={cn('text-2xl font-bold', s.color)}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters + list */}
      <div className="card overflow-hidden">
        {/* Search + Campaign filter row */}
        <div className="px-5 py-3 border-b border-surface-border flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              className="input pl-8 pr-3 text-sm py-1.5"
              placeholder="Search by influencer, campaign, title..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setSearch(searchInput)}
            />
            {search && (
              <button
                onClick={() => { setSearch(''); setSearchInput(''); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <select
            className="input text-sm py-1.5 w-44"
            value={campaignFilter}
            onChange={e => setCampaignFilter(e.target.value)}
          >
            <option value="">All campaigns</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            onClick={() => setSearch(searchInput)}
            className="btn-secondary btn-sm"
          >
            Filter
          </button>
        </div>
        {/* Filter bar */}
        <div className="px-5 py-3 border-b border-surface-border flex items-center gap-2 flex-wrap">
          <FileText className="w-4 h-4 text-gray-500 shrink-0" />
          <span className="text-sm font-semibold text-gray-300 mr-2">All Offers</span>
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_FILTERS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                  statusFilter === s
                    ? 'bg-white text-[#1c1c1c] border-white'
                    : 'text-gray-400 border-surface-border hover:border-white/20 hover:text-white'
                )}
              >
                {s === 'all' ? 'All' : s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-48" />
                  <div className="skeleton h-3 w-32" />
                </div>
                <div className="skeleton h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : offers.length === 0 ? (
          <div className="py-16 text-center">
            <Clock className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No offers found</p>
            <p className="text-xs text-gray-600 mt-1">Click "Send Offer" above or go to an influencer's profile to send one</p>
          </div>
        ) : (
          <div>
            {offers.map(offer => (
              <OfferRow key={String(offer.id)} offer={offer} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
