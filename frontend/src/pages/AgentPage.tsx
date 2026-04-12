/**
 * FALAK AI Agent Page — /agent route (agency + admin roles)
 * Three tabs: AI Match | Outreach Writer | Briefings
 */
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  Bot,
  Zap,
  Mail,
  FileText,
  AlertTriangle,
  Copy,
  RefreshCw,
  CheckCircle2,
  Users,
  Megaphone,
  ChevronDown,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getAgentStatus,
  generateOutreachMessage,
  matchInfluencers,
  getCachedMatches,
  generateBriefing,
  getBriefings,
} from '../utils/api';
import api from '../utils/api';
import type { Influencer, Campaign } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Match {
  rank: number;
  influencer_id: string;
  name: string;
  handle: string;
  followers: number;
  engagement_rate: number;
  match_score: number;
  match_reason: string;
  is_demo: boolean;
}

interface Briefing {
  id: string;
  content: string;
  generated_at: string;
}

type TabId = 'match' | 'outreach' | 'briefings';
type Channel = 'Email' | 'Instagram DM' | 'TikTok DM' | 'WhatsApp' | 'LinkedIn';
type Tone = 'Professional' | 'Friendly' | 'Casual' | 'Urgent';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function getInfluencerDisplayName(inf: Influencer): string {
  return inf.name_english || inf.name_arabic || inf.ig_handle || inf.tiktok_handle || 'Unknown';
}

function getInfluencerHandle(inf: Influencer): string {
  if (inf.ig_handle) return `@${inf.ig_handle}`;
  if (inf.tiktok_handle) return `@${inf.tiktok_handle}`;
  if (inf.snap_handle) return `@${inf.snap_handle}`;
  return '';
}

function getInfluencerFollowers(inf: Influencer): number {
  return inf.ig_followers ?? inf.tiktok_followers ?? inf.snap_followers ?? inf.youtube_followers ?? 0;
}

function scoreColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-yellow-500';
  return 'bg-red-500';
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function DemoBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-yellow-700/50 bg-yellow-900/20 px-4 py-3 text-sm text-yellow-300">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
      <span>{message}</span>
    </div>
  );
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };
  return (
    <button onClick={handleCopy} className="btn-secondary btn-sm flex items-center gap-1.5">
      {copied ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {copied ? 'Copied!' : label}
    </button>
  );
}

// ─── Searchable influencer dropdown ──────────────────────────────────────────

function InfluencerPicker({
  influencers,
  value,
  onChange,
  placeholder = 'Select influencer…',
}: {
  influencers: Influencer[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const selected = influencers.find((inf) => inf.id === value);

  const filtered = useMemo(() => {
    if (!search.trim()) return influencers.slice(0, 60);
    const q = search.toLowerCase();
    return influencers
      .filter(
        (inf) =>
          getInfluencerDisplayName(inf).toLowerCase().includes(q) ||
          (inf.ig_handle && inf.ig_handle.toLowerCase().includes(q)) ||
          (inf.tiktok_handle && inf.tiktok_handle.toLowerCase().includes(q))
      )
      .slice(0, 60);
  }, [influencers, search]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input flex w-full items-center justify-between text-left"
      >
        <span className={selected ? 'text-white' : 'text-gray-500'}>
          {selected
            ? `${getInfluencerDisplayName(selected)} ${getInfluencerHandle(selected)} · ${formatFollowers(getInfluencerFollowers(selected))}`
            : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-[#2a2a2a] bg-[#1c1c1c] shadow-xl">
          <div className="flex items-center gap-2 border-b border-[#2a2a2a] px-3 py-2">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              autoFocus
              className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
              placeholder="Search by name or handle…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-sm text-gray-500">No results</li>
            )}
            {filtered.map((inf) => (
              <li key={inf.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(inf.id);
                    setOpen(false);
                    setSearch('');
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-[#252525]"
                >
                  <div className="flex-1 min-w-0">
                    <span className="block truncate font-medium text-white">
                      {getInfluencerDisplayName(inf)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {getInfluencerHandle(inf)} · {formatFollowers(getInfluencerFollowers(inf))} followers
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}
    </div>
  );
}

// ─── Tab 1: AI Match ──────────────────────────────────────────────────────────

function AiMatchTab({ campaigns }: { campaigns: Campaign[] }) {
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const { data: cached, isLoading: cachedLoading } = useQuery({
    queryKey: ['agent-matches-cached', selectedCampaignId],
    queryFn: () => getCachedMatches(selectedCampaignId),
    enabled: !!selectedCampaignId,
    staleTime: 5 * 60 * 1000,
  });

  const matchMutation = useMutation({
    mutationFn: () => matchInfluencers(selectedCampaignId),
    onSuccess: (data) => {
      const typedMatches = data.matches as unknown as Match[];
      setMatches(typedMatches);
      setIsDemo(data.is_demo);
      toast.success(`Found ${typedMatches.length} matches`);
    },
    onError: () => toast.error('Failed to find matches'),
  });

  const displayMatches = matches ?? (cached?.matches as unknown as Match[] | null);
  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);

  return (
    <div className="space-y-5">
      {/* Campaign selector */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 text-[#e8c97a]">
          <Megaphone className="h-5 w-5" />
          <h3 className="font-semibold">Select Campaign</h3>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <select
              className="input w-full"
              value={selectedCampaignId}
              onChange={(e) => {
                setSelectedCampaignId(e.target.value);
                setMatches(null);
              }}
            >
              <option value="">Choose a campaign…</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.client_name ? `— ${c.client_name}` : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn-primary flex items-center gap-2 whitespace-nowrap"
            disabled={!selectedCampaignId || matchMutation.isPending}
            onClick={() => matchMutation.mutate()}
          >
            {matchMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {matchMutation.isPending ? 'Matching…' : 'Find Matches'}
          </button>
        </div>

        {/* Cached info */}
        {selectedCampaignId && cached?.generated_at && !matches && (
          <p className="text-xs text-gray-500">
            Last generated: {formatDate(cached.generated_at)} — showing cached results below.
          </p>
        )}
      </div>

      {/* Demo banner */}
      {isDemo && (
        <DemoBanner message='AI matching unavailable — ranked by engagement (add OPENAI_API_KEY to enable)' />
      )}

      {/* Loading state */}
      {(matchMutation.isPending || (cachedLoading && selectedCampaignId)) && !displayMatches && (
        <div className="flex items-center justify-center gap-3 py-16 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin text-[#d4a017]" />
          <span>Analysing influencers…</span>
        </div>
      )}

      {/* Results table */}
      {displayMatches && displayMatches.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2a2a2a] flex items-center justify-between">
            <h3 className="font-semibold text-white">
              {displayMatches.length} matches
              {selectedCampaign ? ` for "${selectedCampaign.name}"` : ''}
            </h3>
            <span className="text-xs text-gray-500">Sorted by match score</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a] text-xs text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left w-12">#</th>
                  <th className="px-4 py-3 text-left">Creator</th>
                  <th className="px-4 py-3 text-right">Followers</th>
                  <th className="px-4 py-3 text-right">Eng. Rate</th>
                  <th className="px-4 py-3 text-left min-w-[160px]">Match Score</th>
                  <th className="px-4 py-3 text-left">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e1e]">
                {displayMatches.map((m) => (
                  <tr key={m.influencer_id} className="hover:bg-[#1e1e1e] transition-colors">
                    <td className="px-4 py-3 text-gray-400 font-mono">{m.rank}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-white">{m.name}</p>
                        <p className="text-xs text-gray-500">{m.handle}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 font-mono">
                      {formatFollowers(m.followers)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 font-mono">
                      {(m.engagement_rate * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-[#2a2a2a] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${scoreColor(m.match_score)}`}
                            style={{ width: `${Math.min(100, Math.max(0, m.match_score))}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-gray-300 w-8 text-right">
                          {m.match_score}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-xs">
                      {m.match_reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!displayMatches && !matchMutation.isPending && !cachedLoading && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-500">
          <Users className="h-12 w-12 opacity-20" />
          <p className="text-sm">Select a campaign to find matching influencers</p>
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: Outreach Writer ───────────────────────────────────────────────────

function OutreachWriterTab({
  influencers,
  campaigns,
}: {
  influencers: Influencer[];
  campaigns: Campaign[];
}) {
  const [influencerId, setInfluencerId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [channel, setChannel] = useState<Channel>('Email');
  const [tone, setTone] = useState<Tone>('Professional');
  const [result, setResult] = useState<{ message: string; subject?: string; is_demo: boolean } | null>(null);

  const CHANNELS: Channel[] = ['Email', 'Instagram DM', 'TikTok DM', 'WhatsApp', 'LinkedIn'];
  const TONES: Tone[] = ['Professional', 'Friendly', 'Casual', 'Urgent'];

  const generateMutation = useMutation({
    mutationFn: () =>
      generateOutreachMessage({
        influencer_id: influencerId,
        campaign_id: campaignId || undefined,
        channel,
        tone,
      }),
    onSuccess: (data) => {
      setResult(data);
      toast.success('Message generated');
    },
    onError: () => toast.error('Failed to generate message'),
  });

  const canGenerate = !!influencerId && !generateMutation.isPending;

  return (
    <div className="space-y-5">
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 text-[#e8c97a]">
          <Mail className="h-5 w-5" />
          <h3 className="font-semibold">Configure Message</h3>
        </div>

        {/* Influencer picker */}
        <div>
          <label className="label mb-1.5 block">Influencer *</label>
          <InfluencerPicker
            influencers={influencers}
            value={influencerId}
            onChange={(id) => {
              setInfluencerId(id);
              setResult(null);
            }}
          />
        </div>

        {/* Campaign picker (optional) */}
        <div>
          <label className="label mb-1.5 block">Campaign (optional)</label>
          <select
            className="input w-full"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
          >
            <option value="">No campaign (generic outreach)</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Channel + Tone row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label mb-1.5 block">Channel</label>
            <select
              className="input w-full"
              value={channel}
              onChange={(e) => setChannel(e.target.value as Channel)}
            >
              {CHANNELS.map((ch) => (
                <option key={ch} value={ch}>
                  {ch}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label mb-1.5 block">Tone</label>
            <select
              className="input w-full"
              value={tone}
              onChange={(e) => setTone(e.target.value as Tone)}
            >
              {TONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          className="btn-primary flex items-center gap-2 w-full justify-center"
          disabled={!canGenerate}
          onClick={() => generateMutation.mutate()}
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          {generateMutation.isPending ? 'Generating…' : 'Generate Message'}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="card p-5 space-y-4">
          {result.is_demo && (
            <DemoBanner message="AI message generation unavailable — showing template (add OPENAI_API_KEY to enable)" />
          )}

          {/* Subject line for email */}
          {channel === 'Email' && result.subject && (
            <div className="flex items-start gap-3 rounded-lg bg-[#161616] px-4 py-3">
              <span className="text-xs text-gray-500 uppercase tracking-wide w-16 shrink-0 mt-0.5">
                Subject
              </span>
              <p className="text-sm text-white font-medium flex-1">{result.subject}</p>
            </div>
          )}

          {/* Message body */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label">Message</label>
              <div className="flex items-center gap-2">
                <CopyButton
                  text={channel === 'Email' && result.subject ? `Subject: ${result.subject}\n\n${result.message}` : result.message}
                />
                <button
                  className="btn-secondary btn-sm flex items-center gap-1.5"
                  disabled={!canGenerate}
                  onClick={() => generateMutation.mutate()}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Regenerate
                </button>
              </div>
            </div>
            <div className="rounded-lg bg-[#161616] border border-[#2a2a2a] p-4">
              <pre className="whitespace-pre-wrap text-sm text-gray-300 font-mono leading-relaxed">
                {result.message}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !generateMutation.isPending && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-500">
          <Mail className="h-12 w-12 opacity-20" />
          <p className="text-sm">Select an influencer to generate a message</p>
        </div>
      )}

      {/* Loading state */}
      {generateMutation.isPending && !result && (
        <div className="flex items-center justify-center gap-3 py-16 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin text-[#d4a017]" />
          <span>Writing your message…</span>
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Briefings ────────────────────────────────────────────────────────

function BriefingsTab({ influencers }: { influencers: Influencer[] }) {
  const qc = useQueryClient();
  const [influencerId, setInfluencerId] = useState('');

  const { data: briefings = [], isLoading: briefingsLoading } = useQuery({
    queryKey: ['briefings', influencerId],
    queryFn: () => getBriefings(influencerId),
    enabled: !!influencerId,
    staleTime: 2 * 60 * 1000,
    select: (data) => data as unknown as Briefing[],
  });

  const generateMutation = useMutation({
    mutationFn: () => generateBriefing(influencerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['briefings', influencerId] });
      toast.success('Briefing generated');
    },
    onError: () => toast.error('Failed to generate briefing'),
  });

  const selectedInfluencer = influencers.find((inf) => inf.id === influencerId);

  return (
    <div className="space-y-5">
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 text-[#e8c97a]">
          <FileText className="h-5 w-5" />
          <h3 className="font-semibold">Select Creator</h3>
        </div>

        <InfluencerPicker
          influencers={influencers}
          value={influencerId}
          onChange={setInfluencerId}
          placeholder="Select a creator…"
        />

        <button
          className="btn-primary flex items-center gap-2 w-full justify-center"
          disabled={!influencerId || generateMutation.isPending}
          onClick={() => generateMutation.mutate()}
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          {generateMutation.isPending ? 'Generating briefing…' : 'Generate Briefing'}
        </button>
      </div>

      {/* Briefing history */}
      {influencerId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">
              Briefing History
              {selectedInfluencer && (
                <span className="ml-2 text-gray-500 font-normal text-sm">
                  — {getInfluencerDisplayName(selectedInfluencer)}
                </span>
              )}
            </h3>
            {briefings.length > 0 && (
              <span className="text-xs text-gray-500">{briefings.length} briefing{briefings.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {briefingsLoading ? (
            <div className="flex items-center justify-center gap-3 py-12 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin text-[#d4a017]" />
              <span className="text-sm">Loading briefings…</span>
            </div>
          ) : briefings.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500">
              <FileText className="h-10 w-10 opacity-20" />
              <p className="text-sm">No briefings yet — generate one above</p>
            </div>
          ) : (
            <div className="space-y-4">
              {briefings.map((b) => (
                <div key={b.id} className="card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{formatDate(b.generated_at)}</span>
                    <CopyButton text={b.content} />
                  </div>
                  <div className="rounded-lg bg-[#161616] border border-[#2a2a2a] p-4">
                    <pre className="whitespace-pre-wrap text-sm text-gray-300 leading-relaxed font-sans">
                      {b.content}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state (no influencer selected) */}
      {!influencerId && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-500">
          <FileText className="h-12 w-12 opacity-20" />
          <p className="text-sm">Select a creator to view or generate briefings</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AgentPage() {
  const [activeTab, setActiveTab] = useState<TabId>('match');

  // Agent status
  const { data: agentStatus } = useQuery({
    queryKey: ['agent-status'],
    queryFn: getAgentStatus,
    staleTime: 10 * 60 * 1000,
  });

  // Influencers list (for pickers)
  const { data: influencersData, isLoading: influencersLoading } = useQuery({
    queryKey: ['agent-influencers'],
    queryFn: () => api.get<{ influencers: Influencer[] }>('/influencers?limit=200'),
    staleTime: 5 * 60 * 1000,
    select: (res) => res.data.influencers,
  });

  // Campaigns list
  const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
    queryKey: ['agent-campaigns'],
    queryFn: () => api.get<{ campaigns: Campaign[] }>('/campaigns?limit=100'),
    staleTime: 5 * 60 * 1000,
    select: (res) => res.data.campaigns,
  });

  const influencers = influencersData ?? [];
  const campaigns = campaignsData ?? [];

  const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'match', label: 'AI Match', icon: Zap },
    { id: 'outreach', label: 'Outreach Writer', icon: Mail },
    { id: 'briefings', label: 'Briefings', icon: FileText },
  ];

  const isBootstrapping = influencersLoading || campaignsLoading;

  return (
    <div className="min-h-screen bg-[#161616] p-6">
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-[#d4a017]/20 flex items-center justify-center">
            <Bot className="h-5 w-5 text-[#d4a017]" />
          </div>
          <h1 className="text-2xl font-bold text-white">AI Agent</h1>
        </div>
        <p className="text-sm text-gray-500 ml-12">
          GPT-powered matching, outreach writing, and creator briefings
        </p>
      </div>

      {/* Not-configured banner */}
      {agentStatus && !agentStatus.configured && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-yellow-700/50 bg-yellow-900/20 px-4 py-3 text-sm text-yellow-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
          <span>
            AI features require <code className="bg-yellow-900/40 px-1 rounded text-yellow-200">OPENAI_API_KEY</code> — currently showing rule-based fallbacks.
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex border-b border-[#2a2a2a]">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === id
                ? 'border-[#d4a017] text-[#e8c97a]'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Loading bootstrap */}
      {isBootstrapping ? (
        <div className="flex items-center justify-center gap-3 py-24 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin text-[#d4a017]" />
          <span>Loading data…</span>
        </div>
      ) : (
        <div>
          {activeTab === 'match' && <AiMatchTab campaigns={campaigns} />}
          {activeTab === 'outreach' && (
            <OutreachWriterTab influencers={influencers} campaigns={campaigns} />
          )}
          {activeTab === 'briefings' && <BriefingsTab influencers={influencers} />}
        </div>
      )}
    </div>
  );
}
