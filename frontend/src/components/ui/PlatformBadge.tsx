import { cn } from '../../utils/helpers';

interface PlatformBadgeProps {
  platform: string;
  handle?: string;
  followers?: number;
  className?: string;
  showHandle?: boolean;
}

const platformConfig: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  instagram: { bg: 'bg-pink-900/30',   text: 'text-pink-300',   border: 'border-pink-800/40',   icon: '📸' },
  tiktok:    { bg: 'bg-slate-800/60',  text: 'text-slate-200',  border: 'border-slate-700/40',  icon: '🎵' },
  snapchat:  { bg: 'bg-yellow-900/30', text: 'text-yellow-300', border: 'border-yellow-800/40', icon: '👻' },
  facebook:  { bg: 'bg-blue-900/30',   text: 'text-blue-300',   border: 'border-blue-800/40',   icon: '👤' },
};

function formatFollowers(n?: number): string {
  if (!n) return '';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

export default function PlatformBadge({ platform, handle, followers, className, showHandle = true }: PlatformBadgeProps) {
  const cfg = platformConfig[platform.toLowerCase()] || {
    bg: 'bg-surface-overlay', text: 'text-gray-300', border: 'border-surface-border', icon: '🌐'
  };
  const followersStr = formatFollowers(followers);

  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
      cfg.bg, cfg.text, cfg.border, className
    )}>
      <span>{cfg.icon}</span>
      {showHandle && handle && <span>@{handle}</span>}
      {followersStr && <span className="opacity-70">· {followersStr}</span>}
    </span>
  );
}
