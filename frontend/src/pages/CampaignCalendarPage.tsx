/**
 * Campaign Calendar — month-view showing campaign start/end date spans.
 * Navigate months with arrows. Each campaign appears as a colored bar on its dates.
 */
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Megaphone } from 'lucide-react';
import { getCampaigns } from '../utils/api';
import type { Campaign } from '../types';
import { cn } from '../utils/helpers';

// Pastel palette cycling by index
const COLORS = [
  'bg-blue-700/60 text-blue-200',
  'bg-emerald-700/60 text-emerald-200',
  'bg-purple-700/60 text-purple-200',
  'bg-amber-700/60 text-amber-200',
  'bg-pink-700/60 text-pink-200',
  'bg-cyan-700/60 text-cyan-200',
  'bg-orange-700/60 text-orange-200',
  'bg-indigo-700/60 text-indigo-200',
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function monthDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function dateOnly(s: string): Date {
  const d = new Date(s);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export default function CampaignCalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: getCampaigns,
    staleTime: 60000,
  });

  const days = useMemo(() => monthDays(year, month), [year, month]);

  // Leading blank cells (Sunday = 0)
  const startDow = days[0].getDay();

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  // Filter campaigns that have start/end dates and overlap this month
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  const activeCampaigns = useMemo(() =>
    (campaigns as Campaign[]).filter(c => {
      if (!c.start_date && !c.end_date) return false;
      const s = c.start_date ? dateOnly(c.start_date) : monthStart;
      const e = c.end_date ? dateOnly(c.end_date) : monthEnd;
      return s <= monthEnd && e >= monthStart;
    }),
    [campaigns, month, year] // eslint-disable-line
  );

  // Map: dateString → campaigns that are active on that day
  const dayMap = useMemo(() => {
    const map: Record<string, { campaign: Campaign; colorIdx: number }[]> = {};
    activeCampaigns.forEach((c, idx) => {
      const s = c.start_date ? dateOnly(c.start_date) : monthStart;
      const e = c.end_date ? dateOnly(c.end_date) : monthEnd;
      for (const d of days) {
        if (d >= s && d <= e) {
          const key = d.toDateString();
          if (!map[key]) map[key] = [];
          map[key].push({ campaign: c, colorIdx: idx % COLORS.length });
        }
      }
    });
    return map;
  }, [activeCampaigns, days]); // eslint-disable-line

  const monthLabel = new Date(year, month, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Campaign Calendar</h1>
          <p className="text-sm text-gray-500 mt-0.5">View campaign timelines by month</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/campaigns" className="btn-secondary btn-sm">List View</Link>
          <Link to="/pipeline" className="btn-secondary btn-sm">Kanban</Link>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center gap-3">
        <button onClick={prevMonth} className="btn-secondary btn-sm p-2">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-base font-semibold text-white min-w-40 text-center">{monthLabel}</span>
        <button onClick={nextMonth} className="btn-secondary btn-sm p-2">
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
          className="btn-ghost btn-sm ml-2"
        >
          Today
        </button>
      </div>

      {/* Legend */}
      {activeCampaigns.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {activeCampaigns.map((c, idx) => (
            <Link
              key={c.id}
              to={`/campaigns/${c.id}`}
              className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-transparent', COLORS[idx % COLORS.length])}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {/* Calendar grid */}
      <div className="card overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-surface-border">
          {DAY_LABELS.map(d => (
            <div key={d} className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7">
          {/* Blank leading cells */}
          {Array.from({ length: startDow }).map((_, i) => (
            <div key={`blank-${i}`} className="min-h-[90px] border-r border-b border-surface-border/50 bg-[#111]" />
          ))}

          {days.map(day => {
            const isToday = isSameDay(day, today);
            const key = day.toDateString();
            const entries = dayMap[key] || [];

            return (
              <div
                key={key}
                className={cn(
                  'min-h-[90px] p-1.5 border-r border-b border-surface-border/50 flex flex-col gap-0.5',
                  isToday ? 'bg-white/5' : ''
                )}
              >
                <span className={cn(
                  'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-0.5',
                  isToday ? 'bg-blue-500 text-white' : 'text-gray-500'
                )}>
                  {day.getDate()}
                </span>
                {entries.slice(0, 3).map(({ campaign, colorIdx }) => (
                  <Link
                    key={campaign.id}
                    to={`/campaigns/${campaign.id}`}
                    className={cn(
                      'text-[10px] font-medium px-1.5 py-0.5 rounded truncate leading-tight',
                      COLORS[colorIdx]
                    )}
                    title={campaign.name}
                  >
                    {campaign.name}
                  </Link>
                ))}
                {entries.length > 3 && (
                  <span className="text-[10px] text-gray-600 px-1">+{entries.length - 3} more</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Empty state */}
      {activeCampaigns.length === 0 && (
        <div className="card p-10 text-center">
          <Megaphone className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No campaigns with dates in {monthLabel}</p>
          <p className="text-xs text-gray-600 mt-1">Add start/end dates to campaigns to see them here.</p>
          <Link to="/campaigns" className="btn-secondary btn-sm mt-4">View Campaigns</Link>
        </div>
      )}
    </div>
  );
}
