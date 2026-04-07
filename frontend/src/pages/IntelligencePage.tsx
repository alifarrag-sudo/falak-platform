/**
 * /intelligence/:id — Full Audience Intelligence Report
 * Accessible to: platform_admin, agency, brand (their campaigns), influencer (own)
 * Shows: quality scorecard, demographics, content performance, sentiment, brand affinities
 */
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import {
  Shield, TrendingUp, Users, Heart, MessageCircle, Eye, Share2,
  RefreshCw, Copy, CheckCircle, AlertTriangle, Wifi, WifiOff,
  ChevronLeft, Loader2, Zap, Globe, Flag, Star,
} from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────
interface IntelligenceData {
  is_demo: boolean;
  phyllo_configured: boolean;
  phyllo_connected: boolean;
  influencer?: {
    name_english: string;
    name_arabic: string;
    ig_followers: number;
    ig_engagement_rate: number;
    account_tier: string;
  };
  demographics?: {
    platform: string;
    age_13_17: number; age_18_24: number; age_25_34: number;
    age_35_44: number; age_45_plus: number;
    gender_male: number; gender_female: number;
    top_countries: Array<{ country: string; percentage: number }>;
    top_cities: Array<{ city: string; percentage: number }>;
    updated_at?: string;
  };
  quality?: {
    real_followers_pct: number;
    suspicious_followers_pct: number;
    mass_followers_pct: number;
    credibility_score: number;
    bot_score: number;
    audience_type: string;
    updated_at?: string;
  };
  content?: {
    avg_likes: number; avg_comments: number; avg_views: number;
    avg_shares: number; avg_saves: number; avg_reach: number;
    avg_impressions: number; engagement_rate: number;
    updated_at?: string;
  };
  interests?: {
    interests: string[];
    brand_affinities: string[];
  };
  sentiment?: {
    positive_pct: number; neutral_pct: number; negative_pct: number;
    troll_count: number; spam_count: number; genuine_fan_count: number;
    top_positive_keywords: string[];
    top_negative_keywords: string[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const GOLD = '#d4a017';
const GENDER_COLORS = ['#60a5fa', '#f472b6'];
const AGE_COLOR = '#d4a017';
const QUALITY_COLORS = { real: '#22c55e', mass: '#f59e0b', bot: '#ef4444' };

const COUNTRY_FLAGS: Record<string, string> = {
  SA: '🇸🇦', AE: '🇦🇪', KW: '🇰🇼', QA: '🇶🇦', BH: '🇧🇭',
  OM: '🇴🇲', EG: '🇪🇬', JO: '🇯🇴', LB: '🇱🇧', MA: '🇲🇦',
  US: '🇺🇸', GB: '🇬🇧', TR: '🇹🇷', IQ: '🇮🇶', YE: '🇾🇪',
};

function scoreColor(score: number) {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  return 'text-red-400';
}

function scoreBg(score: number) {
  if (score >= 80) return 'bg-green-400/10 border-green-400/30';
  if (score >= 60) return 'bg-yellow-400/10 border-yellow-400/30';
  return 'bg-red-400/10 border-red-400/30';
}

function formatNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function ScoreCard({ label, value, unit = '', color, sublabel }: {
  label: string; value: number; unit?: string; color: string; sublabel?: string;
}) {
  return (
    <div className={`card p-5 border ${color} flex flex-col gap-2`}>
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-4xl font-bold ${color.includes('green') ? 'text-green-400' : color.includes('yellow') ? 'text-yellow-400' : 'text-red-400'}`}>
        {value.toFixed(1)}<span className="text-lg font-normal text-gray-400">{unit}</span>
      </p>
      {sublabel && <p className="text-xs text-gray-500">{sublabel}</p>}
    </div>
  );
}

function DemoBanner() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/30 text-yellow-300 text-sm">
      <Zap className="w-4 h-4 shrink-0" />
      <span>Showing <strong>demo data</strong> — connect Phyllo API to unlock real audience intelligence. Go to <strong>Settings</strong> to add credentials.</span>
    </div>
  );
}

export default function IntelligencePage() {
  const { id } = useParams<{ id: string }>();
  const [platform, setPlatform] = useState('instagram');
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data, isLoading, refetch } = useQuery<IntelligenceData>({
    queryKey: ['intelligence', id, platform],
    queryFn: async () => {
      const { data } = await api.get(`/intelligence/full/${id}?platform=${platform}`);
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post(`/intelligence/sync/${id}`);
      toast.success('Intelligence data synced');
      refetch();
    } catch (e) {
      toast.error('Sync failed — check Phyllo credentials in Settings');
    } finally {
      setSyncing(false);
    }
  };

  const handleCopyProposal = () => {
    if (!data) return;
    const inf = data.influencer;
    const d = data.demographics;
    const q = data.quality;
    const c = data.content;
    if (!inf || !d || !q || !c) return;

    const topCountry = d.top_countries[0];
    const topCountry2 = d.top_countries[1];
    const mainAge = d.age_18_24 > d.age_25_34 ? '18–34' : '25–34';
    const mainAgeVal = Math.round(d.age_18_24 + d.age_25_34);
    const mainGender = d.gender_female > d.gender_male ? 'female' : 'male';
    const mainGenderVal = Math.round(Math.max(d.gender_female, d.gender_male));

    const text = `${inf.name_english || inf.name_arabic}'s audience on ${platform} is primarily ${mainGender} (${mainGenderVal}%), aged ${mainAge} (${mainAgeVal}%), based in ${topCountry?.country || 'GCC'} (${topCountry?.percentage?.toFixed(0)}%)${topCountry2 ? ` and ${topCountry2.country} (${topCountry2.percentage?.toFixed(0)}%)` : ''}. True engagement rate of ${c.engagement_rate.toFixed(2)}% ${c.engagement_rate > 3 ? 'exceeds' : 'is at'} the platform benchmark. Audience quality score of ${q.credibility_score.toFixed(0)}/100 indicates ${q.real_followers_pct.toFixed(0)}% genuine followers, with minimal bot activity (${q.bot_score.toFixed(0)}%). Recommended for: ${data.interests?.interests?.slice(0, 3).join(', ') || 'lifestyle, fashion, beauty'}.`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!data) return null;

  const dem = data.demographics;
  const qual = data.quality;
  const cont = data.content;
  const sent = data.sentiment;
  const inter = data.interests;
  const inf = data.influencer;

  // Compute headline scores
  const qualityScore = qual?.credibility_score ?? 72;
  const trueEngagement = cont ? (cont.engagement_rate * (qual?.real_followers_pct ?? 80) / 100) : 2.8;
  const credibilityIndex = qual?.credibility_score ?? 72;
  const sentimentHealth = sent ? (sent.positive_pct / (sent.positive_pct + sent.negative_pct) * 100) : 85;

  // Age chart data
  const ageData = dem ? [
    { age: '13–17', pct: dem.age_13_17 },
    { age: '18–24', pct: dem.age_18_24 },
    { age: '25–34', pct: dem.age_25_34 },
    { age: '35–44', pct: dem.age_35_44 },
    { age: '45+', pct: dem.age_45_plus },
  ] : [];

  // Gender pie data
  const genderData = dem ? [
    { name: 'Male', value: dem.gender_male },
    { name: 'Female', value: dem.gender_female },
  ] : [];

  // Quality stacked data
  const qualityBar = qual ? [
    { name: 'Audience', real: qual.real_followers_pct, mass: qual.mass_followers_pct, bot: qual.suspicious_followers_pct },
  ] : [];

  // Sentiment bar
  const sentBar = sent ? [
    { name: 'Sentiment', positive: sent.positive_pct, neutral: sent.neutral_pct, negative: sent.negative_pct },
  ] : [];

  const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'snapchat'];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to={`/influencers/${id}`} className="p-1.5 rounded-lg hover:bg-surface-overlay text-gray-400 hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Audience Intelligence</h1>
            <p className="text-sm text-gray-500">{inf?.name_english || inf?.name_arabic || 'Influencer'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data.phyllo_connected ? (
            <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-400/10 border border-green-400/30 px-2 py-1 rounded-full">
              <Wifi className="w-3 h-3" /> Connected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-gray-500 bg-surface-overlay border border-surface-border px-2 py-1 rounded-full">
              <WifiOff className="w-3 h-3" /> Not Connected
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>

      {/* Demo Banner */}
      {data.is_demo && <DemoBanner />}

      {/* Platform Tabs */}
      <div className="flex gap-1 p-1 bg-[#1c1c1c] rounded-lg w-fit">
        {PLATFORMS.map(p => (
          <button
            key={p}
            onClick={() => setPlatform(p)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-all ${
              platform === p ? 'bg-[#d4a017] text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* SECTION 1 — Scorecard */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Overview Scorecard</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className={`card p-5 border ${scoreBg(qualityScore)}`}>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-gray-400" />
              <p className="text-xs text-gray-500 uppercase tracking-wider">Audience Quality</p>
            </div>
            <p className={`text-4xl font-bold ${scoreColor(qualityScore)}`}>{qualityScore.toFixed(0)}<span className="text-base text-gray-500">/100</span></p>
            <p className="text-xs text-gray-500 mt-1">{qualityScore >= 80 ? 'Excellent' : qualityScore >= 60 ? 'Good' : 'Needs Review'}</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-gray-400" />
              <p className="text-xs text-gray-500 uppercase tracking-wider">True Engagement</p>
            </div>
            <p className="text-4xl font-bold text-white">{trueEngagement.toFixed(2)}<span className="text-base text-gray-500">%</span></p>
            <p className="text-xs text-gray-500 mt-1">From real followers only</p>
          </div>
          <div className={`card p-5 border ${scoreBg(credibilityIndex)}`}>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-gray-400" />
              <p className="text-xs text-gray-500 uppercase tracking-wider">Credibility Index</p>
            </div>
            <p className={`text-4xl font-bold ${scoreColor(credibilityIndex)}`}>{credibilityIndex.toFixed(0)}<span className="text-base text-gray-500">%</span></p>
            <p className="text-xs text-gray-500 mt-1">{qual?.audience_type || 'MIXED'}</p>
          </div>
          <div className={`card p-5 border ${scoreBg(sentimentHealth)}`}>
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-gray-400" />
              <p className="text-xs text-gray-500 uppercase tracking-wider">Sentiment Health</p>
            </div>
            <p className={`text-4xl font-bold ${scoreColor(sentimentHealth)}`}>{sentimentHealth.toFixed(0)}<span className="text-base text-gray-500">%</span></p>
            <p className="text-xs text-gray-500 mt-1">Positive / (Pos + Neg)</p>
          </div>
        </div>
      </div>

      {/* SECTION 2 — Demographics */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Audience Demographics</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Age */}
          <div className="card p-5 col-span-1">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">Age Breakdown</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={ageData} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" domain={[0, 50]} tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="age" tick={{ fill: '#9ca3af', fontSize: 12 }} width={45} />
                <Tooltip
                  formatter={(v: number) => [`${v.toFixed(1)}%`, 'Share']}
                  contentStyle={{ background: '#1c1c1c', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="pct" fill={AGE_COLOR} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Gender */}
          <div className="card p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">Gender Split</p>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={genderData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value">
                    {genderData.map((_, i) => (
                      <Cell key={i} fill={GENDER_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`]} contentStyle={{ background: '#1c1c1c', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-400" /><span className="text-xs text-gray-400">Male {dem?.gender_male?.toFixed(0)}%</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-pink-400" /><span className="text-xs text-gray-400">Female {dem?.gender_female?.toFixed(0)}%</span></div>
            </div>
          </div>

          {/* Top Countries */}
          <div className="card p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">Top Countries</p>
            <div className="space-y-2">
              {(dem?.top_countries || []).slice(0, 6).map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-base w-6">{COUNTRY_FLAGS[c.country] || '🌐'}</span>
                  <span className="text-xs text-gray-300 flex-1">{c.country}</span>
                  <div className="flex-1 bg-surface-overlay rounded-full h-1.5">
                    <div className="h-1.5 rounded-full" style={{ width: `${c.percentage}%`, background: GOLD }} />
                  </div>
                  <span className="text-xs text-gray-500 w-10 text-right">{c.percentage?.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Cities */}
        {dem?.top_cities && dem.top_cities.length > 0 && (
          <div className="card p-4 mt-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Top Cities</p>
            <div className="flex flex-wrap gap-2">
              {dem.top_cities.slice(0, 8).map((c, i) => (
                <span key={i} className="px-2.5 py-1 rounded-full bg-surface-overlay border border-surface-border text-xs text-gray-300">
                  {c.city} <span className="text-gray-500">{c.percentage?.toFixed(0)}%</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3 — Audience Quality */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Audience Quality Breakdown</h2>
        <div className="card p-5">
          <div className="grid grid-cols-3 gap-4 mb-5">
            {[
              { label: 'Real Followers', pct: qual?.real_followers_pct ?? 78, color: 'text-green-400', bg: 'bg-green-400' },
              { label: 'Mass Followers', pct: qual?.mass_followers_pct ?? 10, color: 'text-yellow-400', bg: 'bg-yellow-400' },
              { label: 'Suspicious / Bot', pct: qual?.suspicious_followers_pct ?? 12, color: 'text-red-400', bg: 'bg-red-400' },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <p className={`text-3xl font-bold ${item.color}`}>{item.pct?.toFixed(0)}%</p>
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <div className={`w-2 h-2 rounded-full ${item.bg}`} />
                  <p className="text-xs text-gray-500">{item.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Stacked bar */}
          <div className="h-6 rounded-full overflow-hidden flex">
            <div style={{ width: `${qual?.real_followers_pct ?? 78}%`, background: '#22c55e' }} />
            <div style={{ width: `${qual?.mass_followers_pct ?? 10}%`, background: '#f59e0b' }} />
            <div style={{ width: `${qual?.suspicious_followers_pct ?? 12}%`, background: '#ef4444' }} />
          </div>

          {/* Plain-English interpretation */}
          <p className="text-sm text-gray-400 mt-4 leading-relaxed p-3 bg-surface-overlay rounded-lg border border-surface-border">
            <span className="text-white font-medium">{(qual?.real_followers_pct ?? 78).toFixed(0)}%</span> of this influencer's audience are genuine, engaged followers.
            This means a campaign reaching <span className="text-white font-medium">{formatNum(inf?.ig_followers || 50000)}</span> followers
            effectively reaches ~<span className="text-green-400 font-medium">{formatNum(Math.round((inf?.ig_followers || 50000) * ((qual?.real_followers_pct ?? 78) / 100)))}</span> real people.
          </p>
        </div>
      </div>

      {/* SECTION 4 — Content Performance */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Content Performance</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            { icon: Heart, label: 'Avg Likes', value: cont?.avg_likes ?? 0 },
            { icon: MessageCircle, label: 'Avg Comments', value: cont?.avg_comments ?? 0 },
            { icon: Eye, label: 'Avg Views', value: cont?.avg_views ?? 0 },
            { icon: Share2, label: 'Avg Shares', value: cont?.avg_shares ?? 0 },
          ].map(({ icon: Icon, label, value }, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-3.5 h-3.5 text-gray-500" />
                <p className="text-xs text-gray-500">{label}</p>
              </div>
              <p className="text-2xl font-bold text-white">{formatNum(value)}</p>
            </div>
          ))}
        </div>

        <div className="card p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">Engagement Breakdown</p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={[{
              name: 'Avg Post',
              likes: cont?.avg_likes ?? 0,
              comments: cont?.avg_comments ?? 0,
              shares: cont?.avg_shares ?? 0,
              saves: cont?.avg_saves ?? 0,
            }]}>
              <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={formatNum} />
              <Tooltip formatter={(v: number) => [formatNum(v)]} contentStyle={{ background: '#1c1c1c', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="likes" fill="#f472b6" name="Likes" radius={[4, 4, 0, 0]} />
              <Bar dataKey="comments" fill="#60a5fa" name="Comments" radius={[4, 4, 0, 0]} />
              <Bar dataKey="shares" fill="#34d399" name="Shares" radius={[4, 4, 0, 0]} />
              <Bar dataKey="saves" fill="#fbbf24" name="Saves" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SECTION 5 — Sentiment */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Sentiment Analysis</h2>

        {/* Troll alert */}
        {sent && sent.troll_count > sent.genuine_fan_count * 0.05 && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-4">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>This creator has elevated troll activity ({((sent.troll_count / (sent.genuine_fan_count + sent.troll_count)) * 100).toFixed(1)}%). Review comments before campaign launch.</span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Positive', pct: sent?.positive_pct ?? 71, color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/20', keywords: sent?.top_positive_keywords ?? [] },
            { label: 'Neutral', pct: sent?.neutral_pct ?? 22, color: 'text-gray-400', bg: 'bg-surface-overlay border-surface-border', keywords: [] },
            { label: 'Negative', pct: sent?.negative_pct ?? 7, color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20', keywords: sent?.top_negative_keywords ?? [] },
          ].map((col, i) => (
            <div key={i} className={`card p-4 border ${col.bg}`}>
              <p className={`text-3xl font-bold ${col.color}`}>{col.pct?.toFixed(0)}%</p>
              <p className="text-xs text-gray-500 mt-1 mb-3">{col.label}</p>
              <div className="flex flex-wrap gap-1">
                {col.keywords.map((kw, j) => (
                  <span key={j} className="px-2 py-0.5 rounded text-[10px] bg-black/30 text-gray-400 border border-white/5">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="card p-4 mt-4">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-green-400" /><span className="text-gray-300">{sent?.genuine_fan_count ?? 180} Genuine Fans</span></div>
            <div className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-yellow-400" /><span className="text-gray-300">{sent?.troll_count ?? 12} Trolls</span></div>
            <div className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-gray-500" /><span className="text-gray-300">{sent?.spam_count ?? 8} Spam</span></div>
          </div>
        </div>
      </div>

      {/* SECTION 6 — Interests & Brand Affinities */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Audience Interests & Brand Affinities</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Top Interests</p>
            <div className="flex flex-wrap gap-2">
              {(inter?.interests || ['Fashion', 'Beauty', 'Travel', 'Lifestyle', 'Food']).map((interest, i) => (
                <span key={i} className="px-3 py-1.5 rounded-full border border-[#d4a017]/40 text-[#e8c97a] text-sm bg-[#d4a017]/10">
                  {interest}
                </span>
              ))}
            </div>
          </div>
          <div className="card p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Brand Affinities</p>
            <p className="text-xs text-gray-500 mb-3">This audience also engages with:</p>
            <div className="flex flex-wrap gap-2">
              {(inter?.brand_affinities || ['Nike', 'H&M', 'Sephora', 'Zara']).map((brand, i) => (
                <span key={i} className="px-3 py-1.5 rounded-full bg-surface-overlay border border-surface-border text-sm text-gray-300">
                  {brand}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 7 — Media Planning Summary */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Media Planning Summary</h2>
        <div className="card p-5">
          {dem && qual && cont ? (
            <>
              <p className="text-sm text-gray-300 leading-relaxed">
                <span className="text-white font-medium">{inf?.name_english || inf?.name_arabic}</span>'s audience on {platform} is primarily{' '}
                <span className="text-white">{dem.gender_female > dem.gender_male ? 'female' : 'male'} ({Math.max(dem.gender_female, dem.gender_male).toFixed(0)}%)</span>, aged{' '}
                <span className="text-white">18–34 ({(dem.age_18_24 + dem.age_25_34).toFixed(0)}%)</span>, based in{' '}
                <span className="text-white">{dem.top_countries[0]?.country || 'GCC'} ({dem.top_countries[0]?.percentage?.toFixed(0)}%)</span>
                {dem.top_countries[1] && <span> and <span className="text-white">{dem.top_countries[1].country} ({dem.top_countries[1].percentage?.toFixed(0)}%)</span></span>}.{' '}
                True engagement rate of <span className="text-white">{trueEngagement.toFixed(2)}%</span> {trueEngagement > 3 ? 'exceeds' : 'meets'} the platform benchmark.{' '}
                Audience quality score of <span className={scoreColor(qualityScore)}>{qualityScore.toFixed(0)}/100</span> indicates{' '}
                <span className="text-white">{qual.real_followers_pct?.toFixed(0)}% genuine followers</span>, with minimal bot activity ({qual.bot_score?.toFixed(0)}%).{' '}
                Recommended for: <span className="text-[#e8c97a]">{inter?.interests?.slice(0, 3).join(', ') || 'lifestyle, fashion, beauty'}</span>.
              </p>
              <button
                onClick={handleCopyProposal}
                className="mt-4 flex items-center gap-2 btn-secondary text-sm"
              >
                {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy for Proposal'}
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-500">Connect Phyllo to generate a media planning summary.</p>
          )}
        </div>
      </div>

      {/* SECTION 8 — Sync Status */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Data Sync Status</h2>
        <div className="card p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {PLATFORMS.map(p => (
              <div key={p} className="text-center p-3 rounded-lg bg-surface-overlay border border-surface-border">
                <div className={`w-2.5 h-2.5 rounded-full mx-auto mb-2 ${data.phyllo_connected ? 'bg-green-400' : 'bg-gray-600'}`} />
                <p className="text-xs text-white capitalize font-medium">{p}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{data.phyllo_connected ? 'Connected' : 'Not Connected'}</p>
              </div>
            ))}
          </div>
          {!data.phyllo_configured && (
            <div className="mt-4 p-3 rounded-lg bg-surface-overlay border border-surface-border text-sm text-gray-400">
              <Globe className="w-4 h-4 inline mr-2" />
              Add your <span className="text-white">PHYLLO_CLIENT_ID</span> and <span className="text-white">PHYLLO_CLIENT_SECRET</span> to unlock real data.
              <Link to="/settings" className="text-[#e8c97a] hover:underline ml-1">Go to Settings →</Link>
            </div>
          )}
          {dem?.updated_at && (
            <p className="text-xs text-gray-600 mt-3">Last synced: {new Date(dem.updated_at).toLocaleString()}</p>
          )}
        </div>
      </div>
    </div>
  );
}
