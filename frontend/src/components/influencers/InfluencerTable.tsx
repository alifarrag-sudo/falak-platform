import { useNavigate } from 'react-router-dom';
import { Shield, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import type { Influencer, FilterState } from '../../types';
import Avatar from '../ui/Avatar';
import PlatformBadge from '../ui/PlatformBadge';
import { formatFollowers, formatRate, getPrimaryRate, getDisplayName, cn } from '../../utils/helpers';

interface InfluencerTableProps {
  influencers: Influencer[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  filters: FilterState;
  onSortChange: (field: string) => void;
  currency?: string;
}

type SortIconProps = { field: string; current: string; dir: 'asc' | 'desc' };
function SortIcon({ field, current, dir }: SortIconProps) {
  if (current !== field) return <ChevronsUpDown className="w-3.5 h-3.5 text-gray-600" />;
  return dir === 'asc'
    ? <ChevronUp className="w-3.5 h-3.5 text-white" />
    : <ChevronDown className="w-3.5 h-3.5 text-white" />;
}

const columns = [
  { id: 'name',           label: 'Name',                    sortable: true,  width: 'w-56' },
  { id: 'platforms',      label: 'Platforms & Followers',   sortable: false, width: 'w-64' },
  { id: 'category',       label: 'Category',                sortable: true,  width: 'w-36' },
  { id: 'rate',           label: 'Rate',                    sortable: true,  width: 'w-32' },
  { id: 'country',        label: 'Location',                sortable: false, width: 'w-28' },
  { id: 'supplier_source',label: 'Source',                  sortable: false, width: 'w-28' },
  { id: 'status',         label: 'Status',                  sortable: false, width: 'w-24' },
];

export default function InfluencerTable({
  influencers, selectedIds, onToggleSelect, onSelectAll, filters, onSortChange, currency = 'SAR'
}: InfluencerTableProps) {
  const navigate = useNavigate();
  const allSelected = influencers.length > 0 && influencers.every(i => selectedIds.has(i.id));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-border bg-surface-overlay/40">
            <th className="w-10 px-4 py-3 text-left">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onSelectAll}
                className="w-4 h-4 rounded accent-white cursor-pointer"
              />
            </th>
            {columns.map(col => (
              <th
                key={col.id}
                className={cn(
                  'px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide',
                  col.width,
                  col.sortable && 'cursor-pointer select-none hover:text-gray-200 transition-colors'
                )}
                onClick={() => col.sortable && onSortChange(col.id)}
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  {col.sortable && (
                    <SortIcon field={col.id} current={filters.sortBy} dir={filters.sortDir} />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border/50">
          {influencers.map(inf => {
            const name = getDisplayName(inf);
            const primaryRate = getPrimaryRate(inf);
            const isSelected = selectedIds.has(inf.id);

            return (
              <tr
                key={inf.id}
                className={cn('table-row-hover', isSelected && 'bg-white/5')}
                onClick={() => navigate(`/influencers/${inf.id}`)}
              >
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(inf.id)}
                    className="w-4 h-4 rounded accent-white cursor-pointer"
                  />
                </td>

                <td className="px-3 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar src={inf.profile_photo_url} name={name} size="sm" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-white truncate">{name}</span>
                        {inf.mawthouq_certificate === 1 && (
                          <Shield className="w-3 h-3 text-emerald-400 shrink-0" />
                        )}
                      </div>
                      {inf.name_arabic && inf.name_english && (
                        <p className="text-xs text-gray-500 truncate arabic-text">{inf.name_arabic}</p>
                      )}
                    </div>
                  </div>
                </td>

                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {inf.ig_handle && (
                      <PlatformBadge platform="instagram" followers={inf.ig_followers} showHandle={false} />
                    )}
                    {inf.tiktok_handle && (
                      <PlatformBadge platform="tiktok" followers={inf.tiktok_followers} showHandle={false} />
                    )}
                    {inf.snap_handle && (
                      <PlatformBadge platform="snapchat" followers={inf.snap_followers} showHandle={false} />
                    )}
                    {!inf.ig_handle && !inf.tiktok_handle && !inf.snap_handle && (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {inf.ig_followers ? formatFollowers(inf.ig_followers) :
                      inf.tiktok_followers ? formatFollowers(inf.tiktok_followers) : ''}
                  </div>
                </td>

                <td className="px-3 py-3">
                  <div>
                    {inf.main_category && (
                      <span className="text-xs font-medium text-gray-300">{inf.main_category}</span>
                    )}
                    {inf.account_tier && (
                      <span className="badge badge-blue ml-1">{inf.account_tier}</span>
                    )}
                  </div>
                </td>

                <td className="px-3 py-3">
                  <span className="font-semibold text-white">
                    {primaryRate ? formatRate(primaryRate, currency) : '—'}
                  </span>
                </td>

                <td className="px-3 py-3 text-xs text-gray-500">
                  {[inf.city, inf.country].filter(Boolean).join(', ') || '—'}
                </td>

                <td className="px-3 py-3">
                  {inf.supplier_source && (
                    <span className="text-xs text-gray-500 truncate max-w-[100px] block" title={inf.supplier_source}>
                      {inf.supplier_source.replace(/\.(xlsx|csv)$/i, '')}
                    </span>
                  )}
                </td>

                <td className="px-3 py-3">
                  <div className="flex items-center gap-1">
                    {inf.phone_number && (
                      <span className="badge badge-green text-xs">Has Contact</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
