/**
 * Notification bell icon shown in the header for all authenticated users.
 * Shows unread count badge, dropdown of last 50 notifications.
 * Polls every 30 seconds AND re-fetches on tab focus (visibilitychange).
 */
import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, X, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../../utils/api';
import { formatDate } from '../../utils/helpers';
import { cn } from '../../utils/helpers';

// Emoji icons and colour classes per notification type
const TYPE_META: Record<string, { icon: string; colour: string }> = {
  offer_received:       { icon: '📨', colour: 'bg-blue-900/40 text-blue-300' },
  offer_accepted:       { icon: '✅', colour: 'bg-emerald-900/40 text-emerald-300' },
  offer_declined:       { icon: '❌', colour: 'bg-red-900/40 text-red-300' },
  offer_completed:      { icon: '🏆', colour: 'bg-yellow-900/40 text-yellow-300' },
  new_connection:       { icon: '🔗', colour: 'bg-purple-900/40 text-purple-300' },
  // Legacy upper-case types kept for backwards-compat
  OFFER_RECEIVED:       { icon: '📨', colour: 'bg-blue-900/40 text-blue-300' },
  CONTENT_APPROVED:     { icon: '✅', colour: 'bg-emerald-900/40 text-emerald-300' },
  REVISION_REQUESTED:   { icon: '🔁', colour: 'bg-amber-900/40 text-amber-300' },
  PAYMENT_SENT:         { icon: '💸', colour: 'bg-emerald-900/40 text-emerald-300' },
  FAN_BOOKING_RECEIVED: { icon: '🎤', colour: 'bg-purple-900/40 text-purple-300' },
  PROPOSAL_APPROVED:    { icon: '📋', colour: 'bg-emerald-900/40 text-emerald-300' },
  INFLUENCER_DECLINED:  { icon: '❌', colour: 'bg-red-900/40 text-red-300' },
};

const DEFAULT_META = { icon: '🔔', colour: 'bg-surface-subtle text-gray-400' };

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    refetchInterval: 30_000,          // poll every 30 s
    refetchIntervalInBackground: false,
  });

  // Re-fetch when the user switches back to this tab
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        qc.invalidateQueries({ queryKey: ['notifications'] });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [qc]);

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markOneMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const notifications = data?.notifications || [];
  const unread = data?.unread_count || 0;

  const handleClick = (n: Record<string, unknown>) => {
    if (!n.is_read) markOneMutation.mutate(String(n.id));
    if (n.link) navigate(String(n.link));
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(p => !p)}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-overlay transition-colors text-gray-400 hover:text-white"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-white text-[#1c1c1c] text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-11 w-80 bg-[#1e1e1e] border border-surface-border rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Dropdown header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
            <span className="text-sm font-semibold text-white">Notifications</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={() => markAllMutation.mutate()}
                  disabled={markAllMutation.isPending}
                  className="text-xs text-gray-400 hover:text-white flex items-center gap-1 disabled:opacity-50"
                >
                  <CheckCheck className="w-3 h-3" /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto divide-y divide-surface-border/50">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => {
                const typeKey = String(n.type || '');
                const meta = TYPE_META[typeKey] || DEFAULT_META;
                return (
                  <button
                    key={String(n.id)}
                    onClick={() => handleClick(n)}
                    className={cn(
                      'w-full text-left px-4 py-3 hover:bg-surface-overlay transition-colors',
                      !n.is_read && 'bg-surface-raised/50'
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Type icon */}
                      <span className="text-base leading-none mt-0.5 shrink-0" role="img" aria-hidden>
                        {meta.icon}
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm leading-tight', !n.is_read ? 'text-white font-medium' : 'text-gray-300')}>
                          {String(n.title)}
                        </p>
                        {!!n.body && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{String(n.body)}</p>
                        )}
                        <p className="text-[10px] text-gray-600 mt-1">
                          {formatDate(String(n.created_at))}
                        </p>
                      </div>

                      {/* Unread dot */}
                      {!n.is_read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1.5" />
                      )}

                      {/* Type pill */}
                      {!!n.type && (
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 self-start',
                          meta.colour
                        )}>
                          {typeKey.replace(/_/g, ' ').toLowerCase()}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
