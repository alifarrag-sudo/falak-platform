/**
 * BrandCampaignsPage — brand's own campaign list with "Create Campaign" modal.
 * Lists campaigns with status, budget, influencer count.
 * Create modal: name, description, budget, platforms, dates.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Megaphone, Eye, Trash2, CalendarDays, DollarSign, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { getCampaigns, createCampaign, deleteCampaign } from '../../utils/api';
import type { Campaign } from '../../types';
import Modal from '../../components/ui/Modal';
import { formatRate, formatDate, cn } from '../../utils/helpers';
import { useAuth } from '../../contexts/AuthContext';

const STATUS_OPTIONS = ['draft', 'sent', 'approved', 'active', 'completed'];
const PLATFORM_OPTIONS = ['Instagram', 'TikTok', 'Snapchat', 'Facebook', 'YouTube', 'Multi-Platform'];

const STATUS_COLORS: Record<string, string> = {
  draft:     'bg-[#2a2a2a] text-gray-300 border border-[#2a2a2a]',
  sent:      'bg-blue-900/40 text-blue-300 border border-blue-800/40',
  approved:  'bg-emerald-900/40 text-emerald-300 border border-emerald-800/40',
  active:    'bg-emerald-900/60 text-emerald-200 border border-emerald-700/40',
  completed: 'bg-purple-900/40 text-purple-300 border border-purple-800/40',
};

const EMPTY_FORM = {
  name: '', brief: '', budget: '', platform_focus: '', status: 'draft',
  start_date: '', end_date: '', client_name: '',
};

export default function BrandCampaignsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['brand-campaigns'],
    queryFn: getCampaigns,
  });

  const createMutation = useMutation({
    mutationFn: createCampaign,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brand-campaigns'] });
      setShowCreate(false);
      setForm(EMPTY_FORM);
      toast.success('Campaign created successfully');
    },
    onError: () => toast.error('Failed to create campaign'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCampaign,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brand-campaigns'] });
      toast.success('Campaign removed');
    },
    onError: () => toast.error('Failed to remove campaign'),
  });

  const handleCreate = () => {
    if (!form.name.trim()) {
      toast.error('Campaign name is required');
      return;
    }
    createMutation.mutate({
      ...form,
      budget: form.budget ? Number(form.budget) : undefined,
      client_name: user?.display_name || form.client_name,
      created_by: user?.id || 'brand',
    } as Partial<Campaign>);
  };

  const set = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm(p => ({ ...p, [field]: e.target.value }));

  // Summary counts
  const active    = campaigns.filter((c: Campaign) => c.status === 'active').length;
  const drafts    = campaigns.filter((c: Campaign) => c.status === 'draft').length;
  const completed = campaigns.filter((c: Campaign) => c.status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Campaigns</h1>
          <p className="text-sm text-gray-500 mt-1">
            {campaigns.length} total &bull; {active} active &bull; {drafts} draft &bull; {completed} completed
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          Create Campaign
        </button>
      </div>

      {/* Campaign list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-5 flex items-center gap-4">
              <div className="skeleton w-10 h-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-48" />
                <div className="skeleton h-3 w-32" />
              </div>
              <div className="skeleton h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Megaphone className="w-12 h-12 text-gray-600 mb-4" />
          <p className="text-lg font-semibold text-white">No campaigns yet</p>
          <p className="text-sm text-gray-500 mt-1 mb-6">Create your first campaign to start working with influencers.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Create Campaign
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c: Campaign) => (
            <div
              key={c.id}
              className="card p-5 flex items-center gap-4 hover:bg-[#1c1c1c] transition-colors"
            >
              {/* Icon */}
              <div className="w-10 h-10 rounded-lg bg-[#2a2a2a] flex items-center justify-center text-gray-400 shrink-0">
                <Megaphone className="w-5 h-5" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white truncate">{c.name}</p>
                <div className="flex items-center gap-4 mt-1 flex-wrap">
                  {c.platform_focus && (
                    <span className="text-xs text-gray-400">{c.platform_focus}</span>
                  )}
                  {c.start_date && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <CalendarDays className="w-3 h-3" />
                      {formatDate(c.start_date)}{c.end_date ? ` — ${formatDate(c.end_date)}` : ''}
                    </span>
                  )}
                  {c.budget && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <DollarSign className="w-3 h-3" />
                      {formatRate(c.budget)}
                    </span>
                  )}
                  {(c.influencer_count != null) && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Users className="w-3 h-3" />
                      {c.influencer_count} influencer{c.influencer_count !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Status badge */}
              <span className={cn('badge shrink-0', STATUS_COLORS[c.status] || STATUS_COLORS.draft)}>
                {c.status}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <a href={`/campaigns/${c.id}`} className="btn-ghost btn-sm">
                  <Eye className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => {
                    if (window.confirm(`Remove "${c.name}"?`)) deleteMutation.mutate(c.id);
                  }}
                  className="btn-ghost btn-sm text-red-400 hover:bg-red-900/20"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Campaign Modal */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setForm(EMPTY_FORM); }}
        title="Create Campaign"
        size="lg"
      >
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Name */}
            <div className="col-span-2">
              <label className="label">Campaign Name *</label>
              <input
                className="input"
                value={form.name}
                onChange={set('name')}
                placeholder="e.g., Summer Collection 2025"
              />
            </div>

            {/* Platform */}
            <div>
              <label className="label">Platform</label>
              <select className="input" value={form.platform_focus} onChange={set('platform_focus')}>
                <option value="">Select platform…</option>
                {PLATFORM_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={set('status')}>
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Budget */}
            <div>
              <label className="label">Budget (SAR)</label>
              <input
                type="number"
                className="input"
                value={form.budget}
                onChange={set('budget')}
                placeholder="0"
                min="0"
              />
            </div>

            {/* Start Date */}
            <div>
              <label className="label">Start Date</label>
              <input type="date" className="input" value={form.start_date} onChange={set('start_date')} />
            </div>

            {/* End Date */}
            <div>
              <label className="label">End Date</label>
              <input type="date" className="input" value={form.end_date} onChange={set('end_date')} />
            </div>

            {/* Brief / Description */}
            <div className="col-span-2">
              <label className="label">Campaign Description</label>
              <textarea
                className="input h-24 resize-none"
                value={form.brief}
                onChange={set('brief')}
                placeholder="Describe the campaign goals, target audience, deliverables…"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#2a2a2a]">
            <button
              onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="btn-primary"
            >
              {createMutation.isPending ? 'Creating…' : 'Create Campaign'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
