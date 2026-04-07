/**
 * Outreach Pipeline — discover and contact shadow profiles (influencers not yet on the platform).
 * Accessible at /outreach — agency + admin roles.
 */
import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  Loader2,
  Users,
  Mail,
  MessageSquare,
  TrendingUp,
  Instagram,
  Music2,
  Youtube,
  Camera,
  ChevronDown,
  X,
  Send,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getShadowProfiles,
  createShadowProfile,
  deleteShadowProfile,
  logOutreach,
  recordResponse,
  getOutreachStats,
  getOutreachLog,
} from '../utils/api';
import { cn } from '../utils/helpers';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShadowProfile {
  id: string;
  name?: string;
  handle: string;
  platform: string;
  follower_count?: number;
  category?: string;
  country?: string;
  email?: string;
  claim_status: 'unclaimed' | 'responded' | 'claimed';
  contact_attempts?: number;
  outreach_count?: number;
  response_count?: number;
  created_at: string;
}

interface OutreachStats {
  total_profiles: number;
  by_status: {
    unclaimed: number;
    responded: number;
    claimed: number;
  };
  contacted: number;
  responded: number;
  response_rate: number;
  by_platform: { platform: string; count: number }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFollowers(n?: number): string {
  if (!n) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  const cls = cn('w-3.5 h-3.5', className);
  if (platform === 'instagram') return <Instagram className={cls} />;
  if (platform === 'tiktok')    return <Music2 className={cls} />;
  if (platform === 'youtube')   return <Youtube className={cls} />;
  if (platform === 'snapchat')  return <Camera className={cls} />;
  return <span className="text-xs font-bold">{platform[0]?.toUpperCase()}</span>;
}

function platformColor(platform: string): string {
  if (platform === 'instagram') return 'text-pink-400';
  if (platform === 'tiktok')    return 'text-slate-300';
  if (platform === 'youtube')   return 'text-red-400';
  if (platform === 'snapchat')  return 'text-yellow-400';
  return 'text-gray-400';
}

const STATUS_STYLES: Record<ShadowProfile['claim_status'], string> = {
  unclaimed: 'bg-gray-800/60 text-gray-400 border border-gray-700/60',
  responded: 'bg-amber-900/40 text-amber-300 border border-amber-700/40',
  claimed:   'bg-emerald-900/40 text-emerald-300 border border-emerald-700/40',
};

const STATUS_LABELS: Record<ShadowProfile['claim_status'], string> = {
  unclaimed: 'Unclaimed',
  responded: 'Responded',
  claimed:   'Claimed',
};

const PLATFORMS = [
  { value: 'all',       label: 'All Platforms' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok',    label: 'TikTok' },
  { value: 'youtube',   label: 'YouTube' },
  { value: 'snapchat',  label: 'Snapchat' },
];

const STATUSES = [
  { value: 'all',       label: 'All Statuses' },
  { value: 'unclaimed', label: 'Unclaimed' },
  { value: 'responded', label: 'Responded' },
  { value: 'claimed',   label: 'Claimed' },
];

const CHANNELS = [
  { value: 'email',    label: 'Email' },
  { value: 'dm',       label: 'DM' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'phone',    label: 'Phone' },
];

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  iconColor,
  iconBg,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={cn('p-2.5 rounded-xl shrink-0', iconBg)}>
        <Icon className={cn('w-5 h-5', iconColor)} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// ─── Add Profile Modal ────────────────────────────────────────────────────────

interface AddProfileModalProps {
  onClose: () => void;
  onSaved: () => void;
}

function AddProfileModal({ onClose, onSaved }: AddProfileModalProps) {
  const [handle, setHandle]     = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [name, setName]         = useState('');
  const [followers, setFollowers] = useState('');
  const [category, setCategory] = useState('');
  const [country, setCountry]   = useState('');
  const [email, setEmail]       = useState('');

  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      createShadowProfile({
        handle:         handle.replace(/^@/, '').trim(),
        platform,
        name:           name.trim() || undefined,
        follower_count: followers ? parseInt(followers, 10) : undefined,
        category:       category.trim() || undefined,
        country:        country.trim() || undefined,
        email:          email.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Profile added successfully');
      qc.invalidateQueries({ queryKey: ['shadows'] });
      qc.invalidateQueries({ queryKey: ['outreach-stats'] });
      onSaved();
    },
    onError: () => toast.error('Failed to add profile'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim()) { toast.error('Handle is required'); return; }
    mutation.mutate();
  };

  // Close on backdrop click
  const backdropRef = useRef<HTMLDivElement>(null);
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleBackdrop}
    >
      <div className="card w-full max-w-md p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Add Shadow Profile</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Handle + Platform */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-gray-400">Handle *</label>
              <input
                className="input w-full"
                placeholder="@username"
                value={handle}
                onChange={e => setHandle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="w-36 space-y-1">
              <label className="text-xs text-gray-400">Platform *</label>
              <select
                className="input w-full"
                value={platform}
                onChange={e => setPlatform(e.target.value)}
              >
                {PLATFORMS.filter(p => p.value !== 'all').map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Name (optional)</label>
            <input
              className="input w-full"
              placeholder="Full name"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          {/* Followers + Category */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-gray-400">Followers</label>
              <input
                className="input w-full"
                type="number"
                min={0}
                placeholder="e.g. 50000"
                value={followers}
                onChange={e => setFollowers(e.target.value)}
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-gray-400">Category</label>
              <input
                className="input w-full"
                placeholder="e.g. Lifestyle"
                value={category}
                onChange={e => setCategory(e.target.value)}
              />
            </div>
          </div>

          {/* Country + Email */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-gray-400">Country</label>
              <input
                className="input w-full"
                placeholder="e.g. Egypt"
                value={country}
                onChange={e => setCountry(e.target.value)}
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-gray-400">Email</label>
              <input
                className="input w-full"
                type="email"
                placeholder="contact@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary btn-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !handle.trim()}
              className="btn-primary btn-sm"
            >
              {mutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              ) : (
                <><Plus className="w-4 h-4" /> Add Profile</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Log Outreach Modal ───────────────────────────────────────────────────────

interface LogOutreachModalProps {
  profile: ShadowProfile;
  onClose: () => void;
  onLogged: () => void;
}

function LogOutreachModal({ profile, onClose, onLogged }: LogOutreachModalProps) {
  const [channel, setChannel]   = useState<string>('email');
  const [message, setMessage]   = useState('');

  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      logOutreach(profile.id, {
        channel,
        message_sent: message.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(`Outreach logged via ${channel}`);
      qc.invalidateQueries({ queryKey: ['shadows'] });
      qc.invalidateQueries({ queryKey: ['outreach-stats'] });
      onLogged();
    },
    onError: () => toast.error('Failed to log outreach'),
  });

  const backdropRef = useRef<HTMLDivElement>(null);
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleBackdrop}
    >
      <div className="card w-full max-w-sm p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Log Outreach</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              @{profile.handle}
              {profile.name ? ` · ${profile.name}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Channel */}
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Channel</label>
            <select
              className="input w-full"
              value={channel}
              onChange={e => setChannel(e.target.value)}
            >
              {CHANNELS.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Message */}
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Message sent (optional)</label>
            <textarea
              className="input w-full resize-none"
              rows={4}
              placeholder="Paste or summarise the message you sent…"
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary btn-sm">
              Cancel
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="btn-primary btn-sm"
            >
              {mutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Logging…</>
              ) : (
                <><Send className="w-4 h-4" /> Log Outreach</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Inline Response Input ────────────────────────────────────────────────────

interface InlineResponseProps {
  profile: ShadowProfile;
  onRecorded: () => void;
}

function InlineResponse({ profile, onRecorded }: InlineResponseProps) {
  const [open, setOpen]   = useState(false);
  const [text, setText]   = useState('');
  const [logId, setLogId] = useState('');
  const qc = useQueryClient();

  // Fetch outreach logs once the user opens the response input to get the logId
  const { data: logs, isFetching: loadingLogs } = useQuery({
    queryKey: ['shadow-log', profile.id],
    queryFn: () => getOutreachLog(profile.id),
    enabled: open,
  });

  // Pick the most recent log entry that has no response recorded
  useEffect(() => {
    if (Array.isArray(logs)) {
      const noResponse = logs.find(
        (l): l is Record<string, unknown> =>
          typeof l === 'object' && l !== null && !l['response']
      );
      if (noResponse && typeof noResponse['id'] === 'string') {
        setLogId(noResponse['id']);
      }
    }
  }, [logs]);

  const mutation = useMutation({
    mutationFn: () => recordResponse(logId, text.trim()),
    onSuccess: () => {
      toast.success('Response recorded');
      qc.invalidateQueries({ queryKey: ['shadows'] });
      qc.invalidateQueries({ queryKey: ['outreach-stats'] });
      qc.invalidateQueries({ queryKey: ['shadow-log', profile.id] });
      setOpen(false);
      setText('');
      onRecorded();
    },
    onError: () => toast.error('Failed to record response'),
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-secondary btn-sm text-amber-300 border-amber-700/60 hover:border-amber-500/60"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        Responded
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {loadingLogs ? (
        <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
      ) : (
        <>
          <input
            className="input text-sm py-1.5 w-40"
            placeholder="Response summary…"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && text.trim() && mutation.mutate()}
            autoFocus
          />
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !text.trim() || !logId}
            className="btn-primary btn-sm"
          >
            {mutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
          </button>
          <button onClick={() => { setOpen(false); setText(''); }} className="btn-secondary btn-sm px-2">
            <X className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

// ─── Delete Confirmation ──────────────────────────────────────────────────────

interface DeleteConfirmProps {
  profile: ShadowProfile;
  onClose: () => void;
  onDeleted: () => void;
}

function DeleteConfirmModal({ profile, onClose, onDeleted }: DeleteConfirmProps) {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => deleteShadowProfile(profile.id),
    onSuccess: () => {
      toast.success(`@${profile.handle} removed`);
      qc.invalidateQueries({ queryKey: ['shadows'] });
      qc.invalidateQueries({ queryKey: ['outreach-stats'] });
      onDeleted();
    },
    onError: () => toast.error('Failed to delete profile'),
  });

  const backdropRef = useRef<HTMLDivElement>(null);
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleBackdrop}
    >
      <div className="card w-full max-w-xs p-6 space-y-4">
        <h2 className="text-base font-semibold text-white">Remove Profile?</h2>
        <p className="text-sm text-gray-400">
          Are you sure you want to remove <span className="text-white font-medium">@{profile.handle}</span>? This will also delete all outreach logs for this profile.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="btn-sm bg-red-600 hover:bg-red-500 text-white rounded-lg px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OutreachPage() {
  const [search, setSearch]         = useState('');
  const [platform, setPlatform]     = useState('all');
  const [status, setStatus]         = useState('all');
  const [showAddModal, setShowAddModal]     = useState(false);
  const [logTarget, setLogTarget]           = useState<ShadowProfile | null>(null);
  const [deleteTarget, setDeleteTarget]     = useState<ShadowProfile | null>(null);

  const qc = useQueryClient();

  // Build filter params
  const filterParams: Record<string, string> = {};
  if (search.trim())      filterParams['search']   = search.trim();
  if (platform !== 'all') filterParams['platform'] = platform;
  if (status !== 'all')   filterParams['status']   = status;

  // ─── Queries ───────────────────────────────────────────────────────────────

  const {
    data: shadowData,
    isLoading: loadingProfiles,
    isError: profilesError,
  } = useQuery({
    queryKey: ['shadows', filterParams],
    queryFn: () => getShadowProfiles(filterParams),
    staleTime: 30_000,
  });

  const {
    data: statsData,
    isLoading: loadingStats,
  } = useQuery({
    queryKey: ['outreach-stats'],
    queryFn: getOutreachStats,
    staleTime: 60_000,
  });

  const profiles: ShadowProfile[] = (shadowData?.profiles ?? []) as unknown as ShadowProfile[];
  const stats = statsData as OutreachStats | undefined;

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleInvalidate = () => {
    qc.invalidateQueries({ queryKey: ['shadows'] });
    qc.invalidateQueries({ queryKey: ['outreach-stats'] });
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-6xl">

      {/* ── Page title ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Outreach Pipeline</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track and contact influencers who aren&apos;t on the platform yet
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          Add Profile
        </button>
      </div>

      {/* ── Stats row ────────────────────────────────────────────────────── */}
      {loadingStats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-5 flex items-start gap-4">
              <div className="skeleton w-10 h-10 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3 w-20" />
                <div className="skeleton h-7 w-12" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Profiles"
            value={stats?.total_profiles ?? 0}
            icon={Users}
            iconColor="text-[#e8c97a]"
            iconBg="bg-[#d4a017]/10"
          />
          <StatCard
            label="Contacted"
            value={stats?.contacted ?? 0}
            icon={Mail}
            iconColor="text-blue-400"
            iconBg="bg-blue-500/10"
          />
          <StatCard
            label="Responded"
            value={stats?.responded ?? 0}
            icon={MessageSquare}
            iconColor="text-amber-400"
            iconBg="bg-amber-500/10"
          />
          <StatCard
            label="Response Rate"
            value={`${stats?.response_rate != null ? Math.round(stats.response_rate) : 0}%`}
            icon={TrendingUp}
            iconColor="text-emerald-400"
            iconBg="bg-emerald-500/10"
          />
        </div>
      )}

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              className="input pl-9 w-full"
              placeholder="Search by name or handle…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Platform filter */}
          <div className="relative">
            <select
              className="input w-44 appearance-none pr-8"
              value={platform}
              onChange={e => setPlatform(e.target.value)}
            >
              {PLATFORMS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>

          {/* Status filter */}
          <div className="relative">
            <select
              className="input w-44 appearance-none pr-8"
              value={status}
              onChange={e => setStatus(e.target.value)}
            >
              {STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>

          {/* Count pill */}
          {!loadingProfiles && (
            <span className="text-xs text-gray-500 ml-auto">
              {profiles.length} profile{profiles.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      {loadingProfiles ? (
        <div className="card overflow-hidden">
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="skeleton w-9 h-9 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-3.5 w-32" />
                  <div className="skeleton h-3 w-20" />
                </div>
                <div className="skeleton h-5 w-16 rounded-full" />
                <div className="skeleton h-5 w-12" />
                <div className="skeleton h-7 w-24 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      ) : profilesError ? (
        <div className="card p-12 text-center">
          <p className="text-red-400 font-medium">Failed to load profiles</p>
          <p className="text-xs text-gray-500 mt-1">Check your connection and try again</p>
          <button
            onClick={handleInvalidate}
            className="btn-secondary btn-sm mt-4"
          >
            Retry
          </button>
        </div>
      ) : profiles.length === 0 ? (
        <div className="card p-16 text-center">
          <Users className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <p className="text-gray-300 font-medium mb-1">No profiles found</p>
          <p className="text-sm text-gray-500 max-w-xs mx-auto">
            {search || platform !== 'all' || status !== 'all'
              ? 'No profiles match your filters. Try adjusting your search.'
              : 'Add one to start tracking outreach.'}
          </p>
          {!search && platform === 'all' && status === 'all' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary btn-sm mt-5"
            >
              <Plus className="w-4 h-4" /> Add Profile
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="text-left px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Name / Handle
                  </th>
                  <th className="text-left px-4 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Platform
                  </th>
                  <th className="text-left px-4 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Followers
                  </th>
                  <th className="text-left px-4 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-left px-4 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Contacts
                  </th>
                  <th className="text-right px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {profiles.map(profile => {
                  const canRespond =
                    (profile.outreach_count ?? 0) > 0 &&
                    profile.claim_status !== 'responded' &&
                    profile.claim_status !== 'claimed';

                  return (
                    <tr
                      key={profile.id}
                      className="group hover:bg-surface-subtle/50 transition-colors"
                    >
                      {/* Name / Handle */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-surface-subtle border border-surface-border flex items-center justify-center text-sm font-semibold text-gray-400 shrink-0">
                            {(profile.name || profile.handle)[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-white truncate">
                              {profile.name || `@${profile.handle}`}
                            </p>
                            {profile.name && (
                              <p className="text-xs text-gray-500 truncate">@{profile.handle}</p>
                            )}
                            {profile.category && (
                              <p className="text-xs text-gray-600 truncate">{profile.category}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Platform */}
                      <td className="px-4 py-4">
                        <span className={cn('flex items-center gap-1.5 text-sm font-medium', platformColor(profile.platform))}>
                          <PlatformIcon platform={profile.platform} />
                          <span className="capitalize">{profile.platform}</span>
                        </span>
                      </td>

                      {/* Followers */}
                      <td className="px-4 py-4">
                        <span className="text-white font-medium tabular-nums">
                          {formatFollowers(profile.follower_count)}
                        </span>
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-4">
                        <span className={cn(
                          'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                          STATUS_STYLES[profile.claim_status]
                        )}>
                          {STATUS_LABELS[profile.claim_status]}
                        </span>
                      </td>

                      {/* Contact attempts */}
                      <td className="px-4 py-4">
                        <span className="text-gray-400 tabular-nums">
                          {profile.outreach_count ?? 0}
                          {(profile.response_count ?? 0) > 0 && (
                            <span className="text-amber-400 ml-1">
                              · {profile.response_count} response{(profile.response_count ?? 0) !== 1 ? 's' : ''}
                            </span>
                          )}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          {/* Log Outreach */}
                          <button
                            onClick={() => setLogTarget(profile)}
                            className="btn-secondary btn-sm"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Log Outreach
                          </button>

                          {/* Record Response — inline */}
                          {canRespond && (
                            <InlineResponse
                              profile={profile}
                              onRecorded={handleInvalidate}
                            />
                          )}

                          {/* Delete */}
                          <button
                            onClick={() => setDeleteTarget(profile)}
                            className="btn-secondary btn-sm px-2 text-gray-500 hover:text-red-400 hover:border-red-800/60 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remove profile"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────── */}

      {showAddModal && (
        <AddProfileModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => setShowAddModal(false)}
        />
      )}

      {logTarget && (
        <LogOutreachModal
          profile={logTarget}
          onClose={() => setLogTarget(null)}
          onLogged={() => setLogTarget(null)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          profile={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
