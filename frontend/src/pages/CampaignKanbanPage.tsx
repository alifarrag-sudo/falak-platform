/**
 * CampaignKanbanPage — visual pipeline board for campaigns.
 * Columns: Draft → Approved → Active → Completed
 * Drag-and-drop is not required; clicking a status chip updates it.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Megaphone, ExternalLink, Users, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { getCampaigns, updateCampaign } from '../utils/api';
import type { Campaign } from '../types';
import { formatRate, cn } from '../utils/helpers';

const COLUMNS: { status: string; label: string; color: string; dot: string }[] = [
  { status: 'draft',     label: 'Draft',     color: 'border-gray-600',    dot: 'bg-gray-400'     },
  { status: 'approved',  label: 'Approved',  color: 'border-blue-600',    dot: 'bg-blue-400'     },
  { status: 'active',    label: 'Active',    color: 'border-emerald-600', dot: 'bg-emerald-400'  },
  { status: 'paused',    label: 'Paused',    color: 'border-amber-600',   dot: 'bg-amber-400'    },
  { status: 'completed', label: 'Completed', color: 'border-purple-600',  dot: 'bg-purple-400'   },
];

const STATUS_BADGE: Record<string, string> = {
  draft:     'bg-surface-overlay text-gray-400 border border-surface-border',
  approved:  'bg-blue-900/40 text-blue-300 border border-blue-800/40',
  active:    'bg-emerald-900/40 text-emerald-300 border border-emerald-800/40',
  paused:    'bg-amber-900/40 text-amber-300 border border-amber-800/40',
  completed: 'bg-purple-900/40 text-purple-300 border border-purple-800/40',
};

function CampaignCard({ campaign, onStatusChange }: {
  campaign: Campaign;
  onStatusChange: (id: string, status: string) => void;
}) {
  const totalCost = Number((campaign as unknown as Record<string, unknown>).total_cost) || 0;
  const influencerCount = Number((campaign as unknown as Record<string, unknown>).influencer_count) || 0;
  const nextStatuses = COLUMNS.filter(c => c.status !== campaign.status).map(c => c.status);

  return (
    <div className="bg-[#1a1a1a] border border-surface-border rounded-xl p-4 space-y-3 hover:border-white/20 transition-colors group">
      <div className="flex items-start justify-between gap-2">
        <Link to={`/campaigns/${campaign.id}`} className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors truncate leading-snug">
            {campaign.name}
          </p>
          {campaign.client_name && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{campaign.client_name}</p>
          )}
        </Link>
        <Link to={`/campaigns/${campaign.id}`} className="text-gray-600 hover:text-white transition-colors shrink-0 mt-0.5">
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {campaign.platform_focus && (
        <span className="inline-flex text-xs px-2 py-0.5 rounded bg-surface-overlay text-gray-400 border border-surface-border">
          {campaign.platform_focus}
        </span>
      )}

      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" /> {influencerCount}
        </span>
        {totalCost > 0 && (
          <span className="flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> {formatRate(totalCost)}
          </span>
        )}
      </div>

      {/* Move to status */}
      <div className="border-t border-surface-border/50 pt-2">
        <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-1.5">Move to</p>
        <div className="flex flex-wrap gap-1">
          {nextStatuses.map(s => (
            <button
              key={s}
              onClick={() => onStatusChange(campaign.id, s)}
              className={cn('text-[10px] px-2 py-0.5 rounded-full border transition-all', STATUS_BADGE[s], 'hover:opacity-80')}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CampaignKanbanPage() {
  const qc = useQueryClient();
  const [movingId, setMovingId] = useState<string | null>(null);

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: getCampaigns,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateCampaign(id, { status } as never),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign moved');
      setMovingId(null);
    },
    onError: () => toast.error('Failed to update status'),
  });

  const handleStatusChange = (id: string, status: string) => {
    setMovingId(id);
    updateMutation.mutate({ id, status });
  };

  const byStatus = (status: string) =>
    campaigns.filter((c: Campaign) => c.status === status);

  if (isLoading) {
    return (
      <div className="grid grid-cols-5 gap-4">
        {COLUMNS.map(col => (
          <div key={col.status} className="space-y-3">
            <div className="skeleton h-4 w-20" />
            {[0, 1].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Campaign Pipeline</h1>
          <p className="text-sm text-gray-500 mt-0.5">{campaigns.length} campaigns · drag-free board</p>
        </div>
        <Link to="/campaigns" className="btn-secondary btn-sm">
          <Megaphone className="w-4 h-4" /> List View
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
        {COLUMNS.map(col => {
          const colCampaigns = byStatus(col.status);
          return (
            <div key={col.status} className={cn('rounded-xl border-t-2 bg-surface-subtle p-3 space-y-3', col.color)}>
              {/* Column header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn('w-2 h-2 rounded-full', col.dot)} />
                  <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{col.label}</span>
                </div>
                <span className="text-xs text-gray-500 font-medium">{colCampaigns.length}</span>
              </div>

              {/* Cards */}
              {colCampaigns.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-xs text-gray-600">No campaigns</p>
                </div>
              ) : (
                colCampaigns.map(c => (
                  <div key={c.id} className={cn(movingId === c.id && 'opacity-50 pointer-events-none')}>
                    <CampaignCard campaign={c} onStatusChange={handleStatusChange} />
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
