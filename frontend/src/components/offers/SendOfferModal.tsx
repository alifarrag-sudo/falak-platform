/**
 * Reusable "Send Offer" modal.
 *
 * Usage:
 *   <SendOfferModal
 *     open={showSendOffer}
 *     onClose={() => setShowSendOffer(false)}
 *     influencerId="abc"          // pre-filled, can be undefined for manual pick
 *     influencerName="Sara Ahmed" // shown in title
 *     campaignId="xyz"            // pre-filled (optional)
 *   />
 */
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, BookMarked, Save, Trash2, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { createOffer, getCampaigns, getOfferTemplates, createOfferTemplate, deleteOfferTemplate } from '../../utils/api';
import type { Campaign, OfferTemplate } from '../../types';
import { cn } from '../../utils/helpers';

const PLATFORMS = ['Instagram', 'TikTok', 'Snapchat', 'Facebook', 'YouTube', 'Twitter'];
const CONTENT_TYPES = ['Post', 'Story', 'Reel', 'Video', 'Carousel', 'Live'];
const CURRENCIES = ['SAR', 'AED', 'USD', 'EGP', 'KWD', 'BHD'];

interface SendOfferModalProps {
  open: boolean;
  onClose: () => void;
  influencerId?: string;
  influencerName?: string;
  campaignId?: string;
  onSuccess?: () => void;
}

interface OfferForm {
  title: string;
  campaign_id: string;
  platform: string;
  content_type: string;
  brief: string;
  deliverables: string;
  rate: string;
  currency: string;
  deadline: string;
  agency_notes: string;
}

const DEFAULT_FORM: OfferForm = {
  title: '',
  campaign_id: '',
  platform: '',
  content_type: '',
  brief: '',
  deliverables: '',
  rate: '',
  currency: 'SAR',
  deadline: '',
  agency_notes: '',
};

export default function SendOfferModal({
  open,
  onClose,
  influencerId,
  influencerName,
  campaignId,
  onSuccess,
}: SendOfferModalProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState<OfferForm>(DEFAULT_FORM);
  const [showTemplates, setShowTemplates] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  useEffect(() => {
    if (campaignId) setForm(f => ({ ...f, campaign_id: campaignId }));
  }, [campaignId]);

  useEffect(() => {
    if (!open) {
      setForm(prev => ({ ...DEFAULT_FORM, currency: prev.currency }));
      setShowTemplates(false);
      setSavingTemplate(false);
      setTemplateName('');
    }
  }, [open]);

  const { data: campaignsData } = useQuery({
    queryKey: ['campaigns'],
    queryFn: getCampaigns,
    enabled: open,
  });

  const { data: templates = [] } = useQuery<OfferTemplate[]>({
    queryKey: ['offer-templates'],
    queryFn: getOfferTemplates,
    enabled: open,
  });

  const campaigns = (campaignsData || []) as Campaign[];

  const saveTemplateMutation = useMutation({
    mutationFn: () => createOfferTemplate({
      name: templateName.trim() || `Template ${new Date().toLocaleDateString()}`,
      title: form.title || undefined,
      platform: form.platform || undefined,
      content_type: form.content_type || undefined,
      brief: form.brief || undefined,
      deliverables: form.deliverables || undefined,
      rate: form.rate ? Number(form.rate) : undefined,
      currency: form.currency,
      agency_notes: form.agency_notes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['offer-templates'] });
      setSavingTemplate(false);
      setTemplateName('');
      toast.success('Template saved');
    },
    onError: () => toast.error('Failed to save template'),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: deleteOfferTemplate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['offer-templates'] }),
  });

  const loadTemplate = (t: OfferTemplate) => {
    setForm(f => ({
      ...f,
      title:        t.title        || f.title,
      platform:     t.platform     || f.platform,
      content_type: t.content_type || f.content_type,
      brief:        t.brief        || f.brief,
      deliverables: t.deliverables || f.deliverables,
      rate:         t.rate != null  ? String(t.rate) : f.rate,
      currency:     t.currency     || f.currency,
      agency_notes: t.agency_notes || f.agency_notes,
    }));
    setShowTemplates(false);
    toast.success(`Loaded "${t.name}"`);
  };

  const mutation = useMutation({
    mutationFn: () => {
      // Auto-build title if empty: "<content_type> <platform> - <influencer>"
      const autoTitle =
        form.title.trim() ||
        [
          form.content_type || 'Content',
          form.platform ? `(${form.platform})` : '',
          influencerName ? `– ${influencerName}` : '',
        ]
          .filter(Boolean)
          .join(' ');

      return createOffer({
        influencer_id: influencerId,
        campaign_id: form.campaign_id || undefined,
        title: autoTitle,
        brief: form.brief || undefined,
        platform: form.platform || undefined,
        deliverables:
          form.deliverables ||
          (form.content_type ? `1 ${form.content_type}` : undefined),
        rate: form.rate ? Number(form.rate) : undefined,
        currency: form.currency,
        deadline: form.deadline || undefined,
        agency_notes: form.agency_notes || undefined,
        status: 'sent',
      });
    },
    onSuccess: () => {
      toast.success('Offer sent!');
      qc.invalidateQueries({ queryKey: ['offers'] });
      onSuccess?.();
      onClose();
    },
    onError: () => toast.error('Failed to send offer'),
  });

  const set = <K extends keyof OfferForm>(field: K, value: OfferForm[K]) =>
    setForm(f => ({ ...f, [field]: value }));

  const canSubmit = !!(influencerId && (form.title.trim() || form.content_type));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={influencerName ? `Send Offer to ${influencerName}` : 'Send Offer'}
      size="lg"
    >
      <div className="p-5 space-y-4">

        {/* Template bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <button
              type="button"
              onClick={() => setShowTemplates(p => !p)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-overlay border border-surface-border text-sm text-gray-400 hover:text-white hover:border-white/20 transition-colors"
            >
              <BookMarked className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">
                {templates.length > 0 ? `Load template (${templates.length} saved)` : 'Load template'}
              </span>
              <ChevronDown className={cn('w-4 h-4 shrink-0 transition-transform', showTemplates && 'rotate-180')} />
            </button>
            {showTemplates && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#1e1e1e] border border-surface-border rounded-xl shadow-2xl z-50 overflow-hidden max-h-56 overflow-y-auto">
                {templates.length === 0 ? (
                  <p className="text-sm text-gray-500 px-4 py-3 text-center">No templates yet. Fill the form and save one.</p>
                ) : (
                  templates.map(t => (
                    <div key={t.id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-surface-overlay transition-colors group">
                      <button
                        type="button"
                        className="flex-1 text-left min-w-0"
                        onClick={() => loadTemplate(t)}
                      >
                        <span className="block text-sm text-gray-300 hover:text-white font-medium truncate">{t.name}</span>
                        {(t.platform || t.content_type) && (
                          <span className="text-xs text-gray-500">{[t.platform, t.content_type].filter(Boolean).join(' · ')}</span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTemplateMutation.mutate(t.id)}
                        className="text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          {!savingTemplate ? (
            <button
              type="button"
              onClick={() => setSavingTemplate(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-overlay border border-surface-border text-sm text-gray-400 hover:text-white hover:border-white/20 transition-colors shrink-0"
              title="Save current form as template"
            >
              <Save className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <input
                autoFocus
                className="input text-sm py-1.5 w-36"
                placeholder="Template name"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveTemplateMutation.mutate();
                  if (e.key === 'Escape') setSavingTemplate(false);
                }}
              />
              <button type="button" onClick={() => saveTemplateMutation.mutate()} disabled={saveTemplateMutation.isPending} className="btn-primary btn-sm">Save</button>
              <button type="button" onClick={() => setSavingTemplate(false)} className="btn-secondary btn-sm">×</button>
            </div>
          )}
        </div>

        {/* Row 1: Campaign */}
        <div>
          <label className="label">Campaign (optional)</label>
          <select
            className="input"
            value={form.campaign_id}
            onChange={e => set('campaign_id', e.target.value)}
          >
            <option value="">No campaign</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} {c.client_name ? `— ${c.client_name}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Row 2: Platform + Content type */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Platform</label>
            <select
              className="input"
              value={form.platform}
              onChange={e => set('platform', e.target.value)}
            >
              <option value="">Any / Multiple</option>
              {PLATFORMS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Content Type</label>
            <select
              className="input"
              value={form.content_type}
              onChange={e => set('content_type', e.target.value)}
            >
              <option value="">Not specified</option>
              {CONTENT_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 3: Custom title */}
        <div>
          <label className="label">
            Offer Title
            <span className="text-gray-600 ml-1 font-normal">(auto-generated if blank)</span>
          </label>
          <input
            className="input"
            placeholder={`e.g. Instagram Reel – Ramadan Campaign`}
            value={form.title}
            onChange={e => set('title', e.target.value)}
          />
        </div>

        {/* Row 4: Deliverables description */}
        <div>
          <label className="label">Deliverables</label>
          <input
            className="input text-sm"
            placeholder="e.g. 1 Reel + 3 Stories + 1 Feed Post"
            value={form.deliverables}
            onChange={e => set('deliverables', e.target.value)}
          />
        </div>

        {/* Row 5: Brief */}
        <div>
          <label className="label">Brief / Description</label>
          <textarea
            className="input resize-none h-24 text-sm"
            placeholder="Campaign details, messaging guidelines, dos and don'ts..."
            value={form.brief}
            onChange={e => set('brief', e.target.value)}
          />
        </div>

        {/* Row 6: Budget + Currency + Deadline */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <label className="label">Budget</label>
            <input
              className="input"
              type="number"
              min="0"
              placeholder="0"
              value={form.rate}
              onChange={e => set('rate', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Currency</label>
            <select
              className="input"
              value={form.currency}
              onChange={e => set('currency', e.target.value)}
            >
              {CURRENCIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Deadline</label>
            <input
              className="input"
              type="date"
              value={form.deadline}
              onChange={e => set('deadline', e.target.value)}
            />
          </div>
        </div>

        {/* Row 7: Internal notes */}
        <div>
          <label className="label">
            Notes
            <span className="text-gray-600 ml-1 font-normal">(internal, not shown to influencer)</span>
          </label>
          <input
            className="input text-sm"
            placeholder="Internal notes..."
            value={form.agency_notes}
            onChange={e => set('agency_notes', e.target.value)}
          />
        </div>

        {!influencerId ? (
          <div className="p-4 bg-surface-overlay rounded-lg border border-surface-border text-center space-y-3">
            <p className="text-sm text-gray-400">
              To send an offer, select an influencer first.
            </p>
            <a
              href="/influencers"
              onClick={onClose}
              className="btn-primary btn-sm inline-flex"
            >
              Browse Influencers
            </a>
          </div>
        ) : (
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !canSubmit}
            className="btn-primary w-full mt-1"
          >
            <Send className="w-4 h-4" />
            {mutation.isPending ? 'Sending...' : 'Send Offer'}
          </button>
        )}
      </div>
    </Modal>
  );
}
