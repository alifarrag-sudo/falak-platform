import { X } from 'lucide-react';
import type { FilterState, FilterMeta } from '../../types';

interface FiltersPanelProps {
  filters: FilterState;
  meta: FilterMeta | undefined;
  onChange: (updates: Partial<FilterState>) => void;
  onClear: () => void;
}

export default function FiltersPanel({ filters, meta, onChange, onClear }: FiltersPanelProps) {
  const hasActive = !!(
    filters.category || filters.platform || filters.tier || filters.country ||
    filters.mawthouq || filters.hasPhone || filters.supplierSource || filters.tags ||
    filters.minFollowers || filters.maxFollowers || filters.minRate || filters.maxRate
  );

  return (
    <div className="w-56 shrink-0 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Filters</h3>
        {hasActive && (
          <button onClick={onClear} className="text-xs text-gray-400 hover:text-white flex items-center gap-0.5 transition-colors">
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      <div>
        <label className="label">Category</label>
        <select className="input text-sm" value={filters.category} onChange={e => onChange({ category: e.target.value, page: 1 })}>
          <option value="">All categories</option>
          {meta?.categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div>
        <label className="label">Platform</label>
        <select className="input text-sm" value={filters.platform} onChange={e => onChange({ platform: e.target.value, page: 1 })}>
          <option value="">All platforms</option>
          <option value="instagram">Instagram</option>
          <option value="tiktok">TikTok</option>
          <option value="snapchat">Snapchat</option>
          <option value="facebook">Facebook</option>
        </select>
      </div>

      <div>
        <label className="label">Tier</label>
        <select className="input text-sm" value={filters.tier} onChange={e => onChange({ tier: e.target.value, page: 1 })}>
          <option value="">All tiers</option>
          {meta?.tiers.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div>
        <label className="label">Country</label>
        <select className="input text-sm" value={filters.country} onChange={e => onChange({ country: e.target.value, page: 1 })}>
          <option value="">All countries</option>
          {meta?.countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div>
        <label className="label">Min Followers</label>
        <select className="input text-sm" value={filters.minFollowers || ''} onChange={e => onChange({ minFollowers: e.target.value ? Number(e.target.value) : null, page: 1 })}>
          <option value="">Any</option>
          <option value="1000">1K+</option>
          <option value="10000">10K+</option>
          <option value="50000">50K+</option>
          <option value="100000">100K+</option>
          <option value="500000">500K+</option>
          <option value="1000000">1M+</option>
        </select>
      </div>

      <div>
        <label className="label">Tag</label>
        <input
          className="input text-sm"
          placeholder="e.g. vip, saudi"
          value={filters.tags}
          onChange={e => onChange({ tags: e.target.value, page: 1 })}
        />
      </div>

      <div>
        <label className="label">Data Source</label>
        <select className="input text-sm" value={filters.supplierSource} onChange={e => onChange({ supplierSource: e.target.value, page: 1 })}>
          <option value="">All sources</option>
          {meta?.sources.map(s => (
            <option key={s} value={s}>{s.replace(/\.(xlsx|csv)$/i, '')}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Verification</label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer hover:text-white transition-colors">
            <input
              type="checkbox"
              checked={filters.mawthouq === true}
              onChange={e => onChange({ mawthouq: e.target.checked ? true : null, page: 1 })}
              className="w-3.5 h-3.5 rounded accent-white"
            />
            Mawthouq certified
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer hover:text-white transition-colors">
            <input
              type="checkbox"
              checked={filters.hasPhone === true}
              onChange={e => onChange({ hasPhone: e.target.checked ? true : null, page: 1 })}
              className="w-3.5 h-3.5 rounded accent-white"
            />
            Has phone number
          </label>
        </div>
      </div>

      {meta && (
        <div className="pt-3 border-t border-surface-border space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Total</span>
            <span className="font-medium text-gray-200">{meta.stats.total.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Mawthouq</span>
            <span className="font-medium text-emerald-400">{meta.stats.mawthouq_count}</span>
          </div>
        </div>
      )}
    </div>
  );
}
