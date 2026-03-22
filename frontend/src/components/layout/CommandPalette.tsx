/**
 * CommandPalette — Cmd+K quick search across influencers, campaigns, offers.
 * Opens a modal overlay with live results.
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Users, Megaphone, FileText, X } from 'lucide-react';
import { getInfluencers, getCampaigns, getOffers } from '../../utils/api';
import { cn, getDisplayName } from '../../utils/helpers';
import type { Campaign } from '../../types';

interface CommandItem {
  id: string;
  label: string;
  sub?: string;
  icon: React.ElementType;
  href: string;
  group: string;
}

export default function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
        setQuery('');
        setSelectedIdx(0);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const enabled = open && query.length >= 1;

  const { data: influencerData } = useQuery({
    queryKey: ['cmd-influencers', query],
    queryFn: () => getInfluencers({ search: query, page: 1, limit: 5 }),
    enabled,
    staleTime: 5000,
  });

  const { data: campaignData } = useQuery({
    queryKey: ['cmd-campaigns'],
    queryFn: getCampaigns,
    enabled: open,
    staleTime: 30000,
  });

  const { data: offerData } = useQuery({
    queryKey: ['cmd-offers', query],
    queryFn: () => getOffers({ limit: '5' }),
    enabled: open && query.length === 0,
    staleTime: 30000,
  });

  const items: CommandItem[] = [];

  if (influencerData?.data) {
    for (const inf of influencerData.data.slice(0, 5)) {
      items.push({
        id: `inf-${inf.id}`,
        label: getDisplayName(inf),
        sub: [inf.ig_handle && `@${inf.ig_handle}`, inf.main_category].filter(Boolean).join(' · '),
        icon: Users,
        href: `/influencers/${inf.id}`,
        group: 'Influencers',
      });
    }
  }

  if (campaignData) {
    const filtered = (campaignData as Campaign[]).filter(c =>
      !query || c.name.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 4);
    for (const c of filtered) {
      items.push({
        id: `camp-${c.id}`,
        label: c.name,
        sub: `${c.status} · ${c.platform_focus || 'multi-platform'}`,
        icon: Megaphone,
        href: `/campaigns/${c.id}`,
        group: 'Campaigns',
      });
    }
  }

  if (offerData?.data && !query) {
    for (const o of (offerData.data as Record<string, unknown>[]).slice(0, 3)) {
      items.push({
        id: `offer-${o.id}`,
        label: String(o.title || 'Untitled Offer'),
        sub: `${String(o.status || '')} · ${String(o.influencer_name || '')}`,
        icon: FileText,
        href: `/offers`,
        group: 'Recent Offers',
      });
    }
  }

  const handleSelect = (item: CommandItem) => {
    setOpen(false);
    setQuery('');
    navigate(item.href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && items[selectedIdx]) {
      handleSelect(items[selectedIdx]);
    }
  };

  if (!open) return null;

  // Group items
  const groups: Record<string, CommandItem[]> = {};
  for (const item of items) {
    if (!groups[item.group]) groups[item.group] = [];
    groups[item.group].push(item);
  }

  let globalIdx = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4"
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Palette */}
      <div
        className="relative w-full max-w-xl bg-[#1a1a1a] rounded-2xl border border-surface-border shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none"
            placeholder="Search influencers, campaigns, offers..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={handleKeyDown}
          />
          <button onClick={() => setOpen(false)} className="text-gray-600 hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto py-2">
          {items.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              {query.length === 0 ? 'Start typing to search...' : 'No results found'}
            </div>
          ) : (
            Object.entries(groups).map(([group, groupItems]) => (
              <div key={group}>
                <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-600 uppercase tracking-widest">
                  {group}
                </p>
                {groupItems.map(item => {
                  const idx = globalIdx++;
                  const isSelected = idx === selectedIdx;
                  return (
                    <button
                      key={item.id}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left',
                        isSelected ? 'bg-white/10' : 'hover:bg-white/5'
                      )}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIdx(idx)}
                    >
                      <item.icon className="w-4 h-4 text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{item.label}</p>
                        {item.sub && <p className="text-xs text-gray-500 truncate">{item.sub}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-surface-border flex items-center gap-3 text-[10px] text-gray-600">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
          <span className="ml-auto">⌘K</span>
        </div>
      </div>
    </div>
  );
}
