/**
 * DeduplicatePage — detect and merge duplicate influencer records.
 * Accessible at /deduplicate (agency) and /admin/deduplicate.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GitMerge, AlertTriangle, Check, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { getDuplicates, mergeInfluencers } from '../utils/api';
import type { DuplicateGroup } from '../utils/api';
import { cn, formatDate } from '../utils/helpers';

function formatFollowers(n: number | null) {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function DuplicateGroupCard({ group, onMerged }: { group: DuplicateGroup; onMerged: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const [primaryId, setPrimaryId] = useState<string>(group.influencers[0]?.id || '');
  const [merging, setMerging] = useState(false);

  const handleMerge = async () => {
    const dupIds = group.influencers.map(i => i.id).filter(id => id !== primaryId);
    if (!primaryId || dupIds.length === 0) { toast.error('Select a primary record'); return; }
    if (!confirm(`Merge ${dupIds.length} duplicate(s) into the selected primary? This cannot be undone.`)) return;
    setMerging(true);
    try {
      const result = await mergeInfluencers(primaryId, dupIds);
      toast.success(`Merged ${result.merged_count} duplicate(s)`);
      onMerged();
    } catch {
      toast.error('Merge failed');
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-overlay transition-colors"
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="text-left">
            <p className="text-sm font-medium text-white">{group.reason}</p>
            <p className="text-xs text-gray-500">{group.influencers.length} records</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>

      {expanded && (
        <div className="border-t border-surface-border">
          <div className="p-4 space-y-2">
            {group.influencers.map(inf => (
              <label
                key={inf.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                  primaryId === inf.id
                    ? 'border-blue-500 bg-blue-900/20'
                    : 'border-surface-border hover:border-surface-border/80 hover:bg-surface-overlay'
                )}
              >
                <input
                  type="radio"
                  name={`primary-${group.reason}`}
                  value={inf.id}
                  checked={primaryId === inf.id}
                  onChange={() => setPrimaryId(inf.id)}
                  className="accent-blue-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {inf.name_english || inf.name_arabic || 'Unknown'}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {inf.ig_handle && (
                      <span className="text-xs text-gray-400">@{inf.ig_handle} · {formatFollowers(inf.ig_followers)} IG</span>
                    )}
                    {inf.tiktok_handle && (
                      <span className="text-xs text-gray-400">@{inf.tiktok_handle} · {formatFollowers(inf.tiktok_followers)} TikTok</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">Added {formatDate(inf.created_at)}</p>
                </div>
                {primaryId === inf.id && (
                  <span className="shrink-0 text-xs font-medium text-blue-400 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Primary
                  </span>
                )}
              </label>
            ))}
          </div>
          <div className="px-4 pb-4">
            <p className="text-xs text-gray-500 mb-3">
              Select the <strong className="text-gray-300">primary</strong> record to keep. All campaign memberships and offers from duplicates will be re-assigned to it, and duplicates will be archived.
            </p>
            <button
              onClick={handleMerge}
              disabled={merging}
              className="btn-primary btn-sm"
            >
              <GitMerge className="w-4 h-4" />
              {merging ? 'Merging...' : `Merge ${group.influencers.length - 1} duplicate(s) into primary`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DeduplicatePage() {
  const qc = useQueryClient();
  const { data: groups, isLoading, refetch } = useQuery({
    queryKey: ['duplicates'],
    queryFn: getDuplicates,
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Deduplicate Influencers</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Find and merge duplicate influencer records with the same handle.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="card p-5 space-y-3">
              <div className="skeleton h-4 w-48" />
              <div className="skeleton h-16 w-full" />
            </div>
          ))}
        </div>
      ) : !groups || groups.length === 0 ? (
        <div className="card p-12 text-center">
          <Check className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white">No duplicates found</h2>
          <p className="text-sm text-gray-500 mt-1">Your influencer database looks clean.</p>
          <button onClick={() => refetch()} className="btn-secondary btn-sm mt-4">
            Re-scan
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">
              <span className="font-semibold text-amber-400">{groups.length}</span> duplicate group{groups.length !== 1 ? 's' : ''} found
            </p>
            <button onClick={() => refetch()} className="btn-secondary btn-sm">Re-scan</button>
          </div>
          <div className="space-y-4">
            {groups.map((g, i) => (
              <DuplicateGroupCard
                key={i}
                group={g}
                onMerged={() => qc.invalidateQueries({ queryKey: ['duplicates'] })}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
