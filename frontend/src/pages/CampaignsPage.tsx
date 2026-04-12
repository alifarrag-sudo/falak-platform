import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Megaphone, Trash2, Copy, Eye, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { getCampaigns, createCampaign, deleteCampaign, exportCampaignsCSV } from '../utils/api';
import type { Campaign } from '../types';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import { formatRate, formatDate, getCampaignStatusColor, cn } from '../utils/helpers';

const STATUS_OPTIONS = ['draft', 'sent', 'approved', 'active', 'completed'];

export default function CampaignsPage() {
  const qc = useQueryClient();
  const { isRole } = useAuth();
  const isViewer = isRole('viewer');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '', client_name: '', start_date: '', end_date: '',
    budget: '', brief: '', platform_focus: '', status: 'draft'
  });

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: getCampaigns,
  });

  const createMutation = useMutation({
    mutationFn: createCampaign,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      setShowCreate(false);
      setForm({ name: '', client_name: '', start_date: '', end_date: '', budget: '', brief: '', platform_focus: '', status: 'draft' });
      toast.success('Campaign created');
    },
    onError: () => toast.error('Failed to create campaign'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCampaign,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign archived');
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (c: Campaign) => createCampaign({
      name: `Copy of ${c.name}`,
      client_name: c.client_name,
      platform_focus: c.platform_focus,
      budget: c.budget,
      brief: c.brief,
      status: 'draft',
    } as Partial<Campaign>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign duplicated');
    },
    onError: () => toast.error('Failed to duplicate campaign'),
  });

  const handleCreate = () => {
    if (!form.name.trim()) { toast.error('Campaign name is required'); return; }
    createMutation.mutate({ ...form, budget: form.budget ? Number(form.budget) : undefined } as Partial<Campaign>);
  };

  const statusColors: Record<string, string> = {
    draft:     'bg-surface-subtle text-gray-300 border border-surface-border',
    sent:      'bg-blue-900/40 text-blue-300 border border-blue-800/40',
    approved:  'bg-emerald-900/40 text-emerald-300 border border-emerald-800/40',
    active:    'bg-emerald-900/60 text-emerald-200 border border-emerald-700/40',
    completed: 'bg-purple-900/40 text-purple-300 border border-purple-800/40',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">{campaigns.length} campaigns</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              try { await exportCampaignsCSV(); toast.success('CSV downloaded'); }
              catch { toast.error('Export failed'); }
            }}
            className="btn-secondary"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          {!isViewer && (
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> New Campaign
            </button>
          )}
        </div>
      </div>

      {/* Campaign grid */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-5 space-y-3">
              <div className="skeleton h-5 w-40" />
              <div className="skeleton h-4 w-28" />
              <div className="skeleton h-4 w-full" />
            </div>
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="Create your first campaign to start building influencer proposals."
          action={!isViewer ? (
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> New Campaign
            </button>
          ) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c: Campaign) => (
            <div key={c.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white truncate">{c.name}</h3>
                  {c.client_name && <p className="text-xs text-gray-400 mt-0.5">{c.client_name}</p>}
                </div>
                <span className={cn('badge ml-2 shrink-0', statusColors[c.status] || 'bg-gray-100')}>
                  {c.status}
                </span>
              </div>

              {/* Stats */}
              <div className="flex gap-4 mb-3">
                <div>
                  <p className="text-xs text-gray-400">Influencers</p>
                  <p className="text-lg font-bold text-white">{c.influencer_count || 0}</p>
                </div>
                {c.total_cost ? (
                  <div>
                    <p className="text-xs text-gray-400">Total Cost</p>
                    <p className="text-lg font-bold text-white">{formatRate(c.total_cost)}</p>
                  </div>
                ) : c.budget ? (
                  <div>
                    <p className="text-xs text-gray-400">Budget</p>
                    <p className="text-lg font-bold text-gray-200">{formatRate(c.budget)}</p>
                  </div>
                ) : null}
              </div>

              {c.start_date && (
                <p className="text-xs text-gray-400 mb-3">
                  {formatDate(c.start_date)}{c.end_date && ` — ${formatDate(c.end_date)}`}
                </p>
              )}

              {c.platform_focus && (
                <span className="badge badge-blue mb-3">{c.platform_focus}</span>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-surface-border">
                <Link to={`/campaigns/${c.id}`} className="btn-primary btn-sm flex-1 justify-center">
                  <Eye className="w-3.5 h-3.5" /> Open
                </Link>
                {!isViewer && (
                  <>
                    <button
                      onClick={() => duplicateMutation.mutate(c)}
                      disabled={duplicateMutation.isPending}
                      className="btn-ghost btn-sm text-gray-400 hover:text-white"
                      title="Duplicate campaign"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(c.id)}
                      className="btn-ghost btn-sm text-red-400 hover:bg-red-900/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Campaign Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Campaign" size="lg">
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Campaign Name *</label>
              <input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Ramadan 2025 Campaign" />
            </div>
            <div>
              <label className="label">Client Name</label>
              <input className="input" value={form.client_name} onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))} placeholder="e.g., Shory Insurance" />
            </div>
            <div>
              <label className="label">Platform Focus</label>
              <select className="input" value={form.platform_focus} onChange={e => setForm(p => ({ ...p, platform_focus: e.target.value }))}>
                <option value="">Select platform</option>
                <option>Instagram</option>
                <option>TikTok</option>
                <option>Snapchat</option>
                <option>Multi-Platform</option>
              </select>
            </div>
            <div>
              <label className="label">Start Date</label>
              <input type="date" className="input" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
            </div>
            <div>
              <label className="label">End Date</label>
              <input type="date" className="input" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Budget (SAR)</label>
              <input type="number" className="input" value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Campaign Brief</label>
              <textarea className="input h-24 resize-none" value={form.brief} onChange={e => setForm(p => ({ ...p, brief: e.target.value }))} placeholder="Describe the campaign goals, target audience, deliverables..." />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} disabled={createMutation.isPending} className="btn-primary">
              {createMutation.isPending ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
