import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, CheckCircle, XCircle, ExternalLink, Send, Upload, Link2,
  FileText, Clock, AlertTriangle, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { portalGetOffer, portalRespondToOffer, portalSubmitDeliverable } from '../../utils/api';
import axios from 'axios';
import { cn, formatDate, formatRate } from '../../utils/helpers';

const STATUS_COLORS: Record<string, string> = {
  sent:        'text-blue-400',
  accepted:    'text-emerald-400',
  declined:    'text-red-400',
  in_progress: 'text-amber-400',
  submitted:   'text-purple-400',
  approved:    'text-emerald-400',
  completed:   'text-gray-400',
};

// ─── Status Timeline ──────────────────────────────────────────────────────────

const TIMELINE_STEPS = [
  { key: 'sent',        label: 'Received'   },
  { key: 'accepted',    label: 'Accepted'   },
  { key: 'in_progress', label: 'In Progress'},
  { key: 'submitted',   label: 'Submitted'  },
  { key: 'approved',    label: 'Approved'   },
];

function getStepIndex(status: string): number {
  const map: Record<string, number> = {
    sent: 0,
    pending: 0,
    accepted: 1,
    in_progress: 2,
    submitted: 3,
    approved: 4,
    completed: 4,
  };
  return map[status] ?? 0;
}

function StatusTimeline({ status }: { status: string }) {
  const currentIdx = getStepIndex(status);
  const isDeclined = status === 'declined';

  if (isDeclined) {
    return (
      <div className="flex items-center gap-2 px-1 py-3">
        <XCircle className="w-5 h-5 text-red-400" />
        <span className="text-sm text-red-400 font-medium">Offer Declined</span>
      </div>
    );
  }

  return (
    <div className="relative flex items-start justify-between">
      {/* Connector line */}
      <div className="absolute top-4 left-4 right-4 h-px bg-surface-border" />
      {TIMELINE_STEPS.map((step, idx) => {
        const isDone    = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <div key={step.key} className="relative flex flex-col items-center gap-1.5 flex-1 min-w-0">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 transition-all',
              isDone    ? 'bg-emerald-500 border-emerald-500 text-white'  :
              isCurrent ? 'bg-[#1c1c1c] border-white text-white'          :
                          'bg-[#1c1c1c] border-surface-border text-gray-600'
            )}>
              {isDone ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <span className="text-xs font-bold">{idx + 1}</span>
              )}
            </div>
            <span className={cn(
              'text-xs text-center leading-tight',
              isDone    ? 'text-emerald-400' :
              isCurrent ? 'text-white font-semibold' :
                          'text-gray-600'
            )}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Deadline Countdown ───────────────────────────────────────────────────────

function DeadlineCountdown({ deadline, status }: { deadline: string; status: string }) {
  const isCompleted = ['approved', 'completed', 'declined'].includes(status);
  if (isCompleted) return null;

  const daysLeft = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);

  const colorClass =
    daysLeft > 7  ? 'text-emerald-400' :
    daysLeft >= 1 ? 'text-amber-400'   :
                    'text-red-400';

  const Icon = daysLeft >= 1 ? Clock : AlertTriangle;
  const label =
    daysLeft > 0
      ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`
      : daysLeft === 0
        ? 'Due today'
        : `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''}`;

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', colorClass)}>
      <Icon className="w-4 h-4" />
      {label}
    </span>
  );
}

// ─── Rate Display ─────────────────────────────────────────────────────────────

function RateDisplay({ rate, currency }: { rate: number; currency?: string }) {
  return (
    <div className="inline-flex items-center gap-2 bg-emerald-900/20 border border-emerald-800/40 rounded-xl px-4 py-2.5">
      <span className="text-xs text-emerald-500 font-medium uppercase tracking-wide">Your Rate</span>
      <span className="text-xl font-bold text-emerald-300">
        {(currency || 'SAR')} {rate.toLocaleString()}
      </span>
    </div>
  );
}

// ─── Campaign Brief ───────────────────────────────────────────────────────────

function CampaignBrief({ brief }: { brief: string }) {
  return (
    <div className="border border-surface-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-surface-overlay border-b border-surface-border">
        <FileText className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-semibold text-gray-300">Campaign Brief</span>
      </div>
      <div className="px-4 py-4">
        <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{brief}</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PortalOfferPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [declineNote, setDeclineNote] = useState('');
  const [showDecline, setShowDecline] = useState(false);
  const [showCounter, setShowCounter] = useState(false);
  const [counterRate, setCounterRate] = useState('');
  const [counterNotes, setCounterNotes] = useState('');
  const [submitingCounter, setSubmitingCounter] = useState(false);
  const [submitUrl, setSubmitUrl]     = useState('');
  const [submitCaption, setSubmitCaption] = useState('');
  const [submitNote, setSubmitNote]   = useState('');
  const [submitMode, setSubmitMode]   = useState<'url' | 'file'>('url');
  const [uploadFile, setUploadFile]   = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: offer, isLoading } = useQuery({
    queryKey: ['portal-offer', id],
    queryFn: () => portalGetOffer(id!),
    enabled: !!id,
  });

  const respondMutation = useMutation({
    mutationFn: ({ decision, notes }: { decision: 'accepted' | 'declined'; notes?: string }) =>
      portalRespondToOffer(id!, decision, notes),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['portal-offer', id] });
      qc.invalidateQueries({ queryKey: ['portal-offers'] });
      toast.success(vars.decision === 'accepted' ? 'Offer accepted!' : 'Offer declined');
      setShowDecline(false);
    },
    onError: () => toast.error('Failed to respond to offer'),
  });

  const submitMutation = useMutation({
    mutationFn: () => portalSubmitDeliverable(id!, {
      content_url: submitUrl,
      caption: submitCaption,
      notes: submitNote,
      submission_type: 'link',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal-offer', id] });
      qc.invalidateQueries({ queryKey: ['portal-offers'] });
      toast.success('Work submitted!');
      setSubmitUrl('');
      setSubmitCaption('');
      setSubmitNote('');
    },
    onError: () => toast.error('Failed to submit'),
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error('No file selected');
      const token = localStorage.getItem('cp_portal_token');
      const form = new FormData();
      form.append('file', uploadFile);
      if (submitCaption) form.append('caption', submitCaption);
      if (submitNote)    form.append('notes', submitNote);
      await axios.post(`/api/portal/offers/${id}/deliverables/upload`, form, {
        headers: { Authorization: `Bearer ${token}` },
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded * 100) / e.total));
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal-offer', id] });
      qc.invalidateQueries({ queryKey: ['portal-offers'] });
      toast.success('File submitted!');
      setUploadFile(null);
      setSubmitCaption('');
      setSubmitNote('');
      setUploadProgress(0);
    },
    onError: () => { toast.error('Upload failed'); setUploadProgress(0); },
  });

  if (isLoading) return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="skeleton h-8 w-32" />
      <div className="card p-6 space-y-3">
        <div className="skeleton h-6 w-64" />
        <div className="skeleton h-4 w-40" />
        <div className="skeleton h-20 w-full" />
      </div>
    </div>
  );

  if (!offer) return <div className="text-gray-400">Offer not found</div>;

  const status    = String(offer.status || '');
  const canRespond  = ['pending', 'sent'].includes(status);
  const canSubmit   = ['accepted', 'in_progress'].includes(status);
  const deliverables = (offer.deliverables as Record<string, unknown>[]) || [];

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Nav */}
      <button onClick={() => navigate('/portal/dashboard')} className="btn-ghost btn-sm">
        <ArrowLeft className="w-4 h-4" /> My Offers
      </button>

      {/* Status Timeline */}
      <div className="card p-5">
        <StatusTimeline status={status} />
      </div>

      {/* Offer details */}
      <div className="card p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white mb-1">{String(offer.title)}</h1>
            {offer.campaign_name && <p className="text-gray-500 text-sm">{String(offer.campaign_name)}</p>}
          </div>
          <span className={cn('text-sm font-semibold capitalize shrink-0', STATUS_COLORS[status] || 'text-gray-400')}>
            {status.replace('_', ' ')}
          </span>
        </div>

        {/* Rate display — prominent */}
        {offer.rate && (
          <RateDisplay rate={Number(offer.rate)} currency={offer.currency ? String(offer.currency) : undefined} />
        )}

        {/* Deadline countdown */}
        {offer.deadline && (
          <DeadlineCountdown deadline={String(offer.deadline)} status={status} />
        )}

        {/* Campaign Brief — styled card */}
        {offer.brief && <CampaignBrief brief={String(offer.brief)} />}

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-surface-border">
          {offer.platform && (
            <div>
              <p className="text-xs text-gray-500">Platform</p>
              <p className="text-sm text-white font-medium">{String(offer.platform)}</p>
            </div>
          )}
          {offer.deliverables && (
            <div>
              <p className="text-xs text-gray-500">Deliverables</p>
              <p className="text-sm text-white font-medium">{String(offer.deliverables)}</p>
            </div>
          )}
          {offer.rate && (
            <div>
              <p className="text-xs text-gray-500">Rate</p>
              <p className="text-sm text-white font-bold">{formatRate(Number(offer.rate))} {String(offer.currency || 'SAR')}</p>
            </div>
          )}
          {offer.deadline && (
            <div>
              <p className="text-xs text-gray-500">Deadline</p>
              <p className="text-sm text-white font-medium">{formatDate(String(offer.deadline))}</p>
            </div>
          )}
        </div>

        {offer.agency_notes && (
          <div className="p-3 bg-surface-overlay rounded-lg border border-surface-border">
            <p className="text-xs text-gray-500 mb-1">Agency Notes</p>
            <p className="text-sm text-gray-300">{String(offer.agency_notes)}</p>
          </div>
        )}
      </div>

      {/* Show agency counter-offer if pending */}
      {offer.counter_rate && offer.counter_by === 'agency' && (
        <div className="card p-5 space-y-3">
          <p className="text-sm font-semibold text-amber-300">Counter-offer from Agency</p>
          <div className="flex items-center gap-3">
            <div className="text-2xl font-bold text-white">
              {String(offer.counter_currency || 'SAR')} {Number(offer.counter_rate).toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">
              (original: {formatRate(Number(offer.rate))} {String(offer.currency || 'SAR')})
            </div>
          </div>
          {offer.counter_notes && <p className="text-sm text-gray-300">{String(offer.counter_notes)}</p>}
          <div className="flex gap-2">
            <button
              className="btn-primary"
              onClick={async () => {
                try {
                  const token = localStorage.getItem('cp_portal_token');
                  await axios.post(`/api/portal/offers/${id}/accept-counter`, {}, {
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  qc.invalidateQueries({ queryKey: ['portal-offer', id] });
                  toast.success('Counter accepted!');
                } catch { toast.error('Failed'); }
              }}
            >
              <CheckCircle className="w-4 h-4" /> Accept Counter
            </button>
            <button className="btn-secondary" onClick={() => setShowCounter(true)}>
              <RefreshCw className="w-4 h-4" /> Counter Back
            </button>
          </div>
        </div>
      )}

      {/* Respond to offer */}
      {canRespond && (
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-300">Respond to Offer</h2>
          <div className="flex gap-3">
            <button
              onClick={() => respondMutation.mutate({ decision: 'accepted' })}
              disabled={respondMutation.isPending}
              className="btn-primary flex-1"
            >
              <CheckCircle className="w-4 h-4" /> Accept Offer
            </button>
            <button
              onClick={() => setShowDecline(p => !p)}
              className="btn-secondary flex-1"
            >
              <XCircle className="w-4 h-4" /> Decline
            </button>
            <button
              onClick={() => setShowCounter(p => !p)}
              className="btn-ghost flex-1 text-amber-400 hover:bg-amber-900/20"
            >
              <RefreshCw className="w-4 h-4" /> Counter
            </button>
          </div>

          {showCounter && (
            <div className="space-y-2 p-3 bg-surface-overlay rounded-lg border border-surface-border">
              <p className="text-xs text-gray-400 font-medium">Propose a counter-offer rate</p>
              <input
                type="number"
                className="input text-sm"
                placeholder={`Your rate (current: ${offer.rate})`}
                value={counterRate}
                onChange={e => setCounterRate(e.target.value)}
              />
              <textarea
                className="input text-sm resize-none h-16"
                placeholder="Reason or message..."
                value={counterNotes}
                onChange={e => setCounterNotes(e.target.value)}
              />
              <button
                className="btn-primary btn-sm"
                disabled={!counterRate || submitingCounter}
                onClick={async () => {
                  setSubmitingCounter(true);
                  try {
                    const token = localStorage.getItem('cp_portal_token');
                    await axios.post(`/api/offers/${id}/counter`, {
                      counter_rate: Number(counterRate),
                      counter_notes: counterNotes,
                      counter_by: 'influencer',
                      counter_currency: String(offer.currency || 'SAR'),
                    }, { headers: { Authorization: `Bearer ${token}` } });
                    qc.invalidateQueries({ queryKey: ['portal-offer', id] });
                    toast.success('Counter-offer sent!');
                    setShowCounter(false);
                    setCounterRate('');
                    setCounterNotes('');
                  } catch { toast.error('Failed to send counter'); }
                  finally { setSubmitingCounter(false); }
                }}
              >
                Send Counter-Offer
              </button>
            </div>
          )}

          {showDecline && (
            <div className="space-y-2">
              <textarea
                className="input resize-none h-20 text-sm"
                placeholder="Optional: let us know why you're declining..."
                value={declineNote}
                onChange={e => setDeclineNote(e.target.value)}
              />
              <button
                onClick={() => respondMutation.mutate({ decision: 'declined', notes: declineNote })}
                disabled={respondMutation.isPending}
                className="btn-danger btn-sm"
              >
                Confirm Decline
              </button>
            </div>
          )}
        </div>
      )}

      {/* Submit deliverable */}
      {canSubmit && (
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300">Submit Your Work</h2>

          {/* Tab toggle */}
          <div className="flex gap-1 p-1 bg-surface-overlay rounded-lg border border-surface-border">
            <button
              onClick={() => setSubmitMode('url')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all',
                submitMode === 'url'
                  ? 'bg-[#2a2a2a] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-300',
              )}
            >
              <Link2 className="w-4 h-4" /> Paste Link
            </button>
            <button
              onClick={() => setSubmitMode('file')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all',
                submitMode === 'file'
                  ? 'bg-[#2a2a2a] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-300',
              )}
            >
              <Upload className="w-4 h-4" /> Upload File
            </button>
          </div>

          <div className="space-y-3">
            {submitMode === 'url' ? (
              <div>
                <label className="label">Post / Content URL *</label>
                <input
                  className="input"
                  placeholder="https://instagram.com/p/... or https://tiktok.com/@..."
                  value={submitUrl}
                  onChange={e => setSubmitUrl(e.target.value)}
                />
              </div>
            ) : (
              <div>
                <label className="label">Upload Content File *</label>
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,video/*,application/pdf"
                  onChange={e => setUploadFile(e.target.files?.[0] || null)}
                />
                {/* Drop zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    const f = e.dataTransfer.files[0];
                    if (f) setUploadFile(f);
                  }}
                  className={cn(
                    'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
                    uploadFile
                      ? 'border-emerald-600 bg-emerald-900/10'
                      : 'border-surface-border hover:border-gray-500 bg-surface-overlay',
                  )}
                >
                  {uploadFile ? (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-emerald-300 truncate">{uploadFile.name}</p>
                      <p className="text-xs text-gray-500">{(uploadFile.size / 1024 / 1024).toFixed(1)} MB</p>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setUploadFile(null); setUploadProgress(0); }}
                        className="text-xs text-red-400 hover:text-red-300 mt-1"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-8 h-8 text-gray-500 mx-auto" />
                      <p className="text-sm text-gray-400">Drag & drop or <span className="text-blue-400">browse</span></p>
                      <p className="text-xs text-gray-600">Images, videos (MP4), PDF — max 200 MB</p>
                    </div>
                  )}
                </div>
                {/* Progress bar */}
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Uploading…</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-1.5 bg-surface-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-200"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="label">Caption (optional)</label>
              <textarea
                className="input resize-none h-20 text-sm"
                placeholder="The caption you used..."
                value={submitCaption}
                onChange={e => setSubmitCaption(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Notes for the agency (optional)</label>
              <input
                className="input text-sm"
                placeholder="Any notes for the agency..."
                value={submitNote}
                onChange={e => setSubmitNote(e.target.value)}
              />
            </div>

            {submitMode === 'url' ? (
              <button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending || !submitUrl.trim()}
                className="btn-primary w-full"
              >
                <Send className="w-4 h-4" />
                {submitMutation.isPending ? 'Submitting...' : 'Submit Link'}
              </button>
            ) : (
              <button
                onClick={() => uploadMutation.mutate()}
                disabled={uploadMutation.isPending || !uploadFile}
                className="btn-primary w-full"
              >
                <Upload className="w-4 h-4" />
                {uploadMutation.isPending ? 'Uploading...' : 'Upload & Submit'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Submission history */}
      {deliverables.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-surface-border">
            <h2 className="text-sm font-semibold text-gray-300">Submissions ({deliverables.length})</h2>
          </div>
          <div className="divide-y divide-surface-border/50">
            {deliverables.map(d => (
              <div key={String(d.id)} className="px-5 py-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {!!d.content_url && (
                      <a
                        href={String(d.content_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 truncate"
                      >
                        {d.submission_type === 'file'
                          ? <Upload className="w-3.5 h-3.5 shrink-0" />
                          : <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        }
                        <span className="truncate">
                          {d.submission_type === 'file' && d.file_name
                            ? String(d.file_name)
                            : String(d.content_url)}
                        </span>
                      </a>
                    )}
                    {!!d.caption && <p className="text-xs text-gray-400 mt-1">{String(d.caption)}</p>}
                  </div>
                  <span className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0',
                    d.status === 'approved'  ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-800/40' :
                    d.status === 'rejected'  ? 'bg-red-900/40 text-red-300 border border-red-800/40' :
                    d.status === 'revision_requested' ? 'bg-amber-900/40 text-amber-300 border border-amber-800/40' :
                    'bg-surface-subtle text-gray-300 border border-surface-border'
                  )}>
                    {String(d.status).replace('_', ' ')}
                  </span>
                </div>
                {!!d.feedback && (
                  <p className="text-xs text-gray-400 bg-surface-overlay rounded-lg px-3 py-2 border border-surface-border">
                    <span className="text-gray-500 font-medium">Agency feedback: </span>
                    {String(d.feedback)}
                  </p>
                )}
                <p className="text-xs text-gray-600">Submitted {formatDate(String(d.submitted_at))}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
