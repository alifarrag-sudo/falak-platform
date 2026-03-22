import { User } from 'lucide-react';
import { cn } from '../../utils/helpers';

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizes = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-20 h-20 text-2xl',
};

// Dark-mode monochrome palette
const colors = [
  'bg-zinc-700 text-zinc-200',
  'bg-stone-700 text-stone-200',
  'bg-neutral-600 text-neutral-200',
  'bg-slate-700 text-slate-200',
  'bg-zinc-600 text-zinc-100',
  'bg-neutral-700 text-neutral-100',
];

export default function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  const initials = name
    ? name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : null;

  const colorIdx = name ? name.charCodeAt(0) % colors.length : 0;

  if (src) {
    return (
      <img
        src={src}
        alt={name || 'avatar'}
        className={cn('rounded-full object-cover shrink-0', sizes[size], className)}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }

  return (
    <div className={cn(
      'rounded-full flex items-center justify-center font-semibold shrink-0',
      sizes[size],
      initials ? colors[colorIdx] : 'bg-surface-subtle text-gray-500',
      className
    )}>
      {initials || <User className="w-1/2 h-1/2" />}
    </div>
  );
}
