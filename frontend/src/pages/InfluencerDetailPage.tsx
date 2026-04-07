import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Edit2, Save, X, Shield, Phone, Mail, MapPin,
  RefreshCw, ExternalLink, History, Megaphone, Plus, Send,
  CheckCircle2, AlertCircle, Clock, TrendingUp, Eye, Link2, UserPlus,
  MessageCircle, Copy, QrCode, Brain,
} from 'lucide-react';
import QRCodeSVG from 'react-qr-code';
import toast from 'react-hot-toast';
import { getInfluencer, updateInfluencer, enrichInfluencer, getInfluencerHistory, getCampaigns, addInfluencerToCampaign, createOffer, getInfluencerPosts, getOffers, generateInviteLink, getInfluencerPerformance } from '../utils/api';
import type { InfluencerPerformance } from '../utils/api';
import type { PlatformStat, InfluencerPost } from '../types';
import Avatar from '../components/ui/Avatar';
import PlatformBadge from '../components/ui/PlatformBadge';
import Modal from '../components/ui/Modal';
import { formatRate, formatDate, formatFollowers, cn } from '../utils/helpers';
import type { Campaign } from '../types';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">{children}</h2>;
}

export default function InfluencerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Record<string, unknown>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [showAddCampaign, setShowAddCampaign] = useState(false);
  const [showSendOffer, setShowSendOffer] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [offerForm, setOfferForm] = useState({
    title: '', brief: '', platform: '', deliverables: '',
    rate: '', currency: 'EGP', deadline: '', agency_notes: '',
  });

  const { data: inf, isLoading } = useQuery({
    queryKey: ['influencer', id],
    queryFn: () => getInfluencer(id!),
    enabled: !!id,
  });

  const { data: history } = useQuery({
    queryKey: ['influencer-history', id],
    queryFn: () => getInfluencerHistory(id!),
    enabled: showHistory && !!id,
  });

  const { data: campaigns } = useQuery({
    queryKey: ['campaigns'],
    queryFn: getCampaigns,
    enabled: showAddCampaign,
  });

  const { data: postsData } = useQuery({
    queryKey: ['influencer-posts', id],
    queryFn: () => getInfluencerPosts(id!),
    enabled: !!id,
  });

  const { data: offersData } = useQuery({
    queryKey: ['influencer-offers', id],
    queryFn: () => getOffers({ influencer_id: id as string, limit: '50' }),
    enabled: !!id,
  });

  const { data: performance } = useQuery<InfluencerPerformance>({
    queryKey: ['influencer-performance', id],
    queryFn: () => getInfluencerPerformance(id!),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (updates: Record<string, unknown>) => updateInfluencer(id!, updates as never),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['influencer', id] });
      qc.invalidateQueries({ queryKey: ['influencers'] });
      setEditMode(false);
      toast.success('Saved');
    },
    onError: () => toast.error('Failed to save'),
  });

  const sendOfferMutation = useMutation({
    mutationFn: () => createOffer({
      influencer_id: id,
      title: offerForm.title,
      brief: offerForm.brief || undefined,
      platform: offerForm.platform || undefined,
      deliverables: offerForm.deliverables || undefined,
      rate: offerForm.rate ? Number(offerForm.rate) : undefined,
      currency: offerForm.currency,
      deadline: offerForm.deadline || undefined,
      agency_notes: offerForm.agency_notes || undefined,
      status: 'sent',
    }),
    onSuccess: () => {
      toast.success('Offer sent!');
      setShowSendOffer(false);
      setOfferForm({ title: '', brief: '', platform: '', deliverables: '', rate: '', currency: 'SAR', deadline: '', agency_notes: '' });
      qc.invalidateQueries({ queryKey: ['offers'] });
    },
    onError: () => toast.error('Failed to send offer'),
  });

  const enrichMutation = useMutation({
    mutationFn: () => enrichInfluencer(id!),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['influencer', id] });
      toast.success(
        Object.keys(result.updated).length > 0
          ? `Updated ${Object.keys(result.updated).length} fields from ${result.source}`
          : 'Lookup completed — no new data found'
      );
    },
    onError: () => toast.error('Enrichment failed'),
  });

  const handleEdit = (field: string, value: unknown) => setEditData(prev => ({ ...prev, [field]: value }));
  const handleSave = () => {
    if (Object.keys(editData).length > 0) updateMutation.mutate(editData);
    else setEditMode(false);
  };
  const handleCancelEdit = () => { setEditMode(false); setEditData({}); };

  const Field = ({ label, field, type = 'text', arabic = false }: {
    label: string; field: string; type?: string; arabic?: boolean;
  }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = editMode
      ? (editData[field] !== undefined ? editData[field] : (inf as any)?.[field])
      : (inf as any)?.[field];

    if (editMode) {
      return (
        <div>
          <label className="label">{label}</label>
          <input
            type={type}
            className={cn('input text-sm', arabic && 'arabic-text')}
            value={String(value || '')}
            onChange={e => handleEdit(field, e.target.value)}
            dir={arabic ? 'rtl' : undefined}
          />
        </div>
      );
    }
    if (!value) return null;
    return (
      <div>
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className={cn('text-sm text-gray-200', arabic && 'arabic-text')}>{String(value)}</p>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="skeleton h-8 w-32 mb-6" />
        <div className="card p-6 space-y-4">
          <div className="flex gap-4">
            <div className="skeleton w-20 h-20 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-6 w-48" />
              <div className="skeleton h-4 w-32" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!inf) return <div className="text-gray-400">Influencer not found</div>;

  const name = inf.name_english || inf.name_arabic || 'Unknown';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/influencers')} className="btn-ghost btn-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex gap-2">
          <button onClick={() => enrichMutation.mutate()} disabled={enrichMutation.isPending} className="btn-secondary btn-sm">
            <RefreshCw className={cn('w-4 h-4', enrichMutation.isPending && 'animate-spin')} />
            Refresh Data
          </button>
          <button onClick={() => setShowHistory(true)} className="btn-secondary btn-sm">
            <History className="w-4 h-4" /> History
          </button>
          <button onClick={() => setShowAddCampaign(true)} className="btn-secondary btn-sm">
            <Megaphone className="w-4 h-4" /> Add to Campaign
          </button>
          <button
            onClick={async () => {
              try {
                const result = await generateInviteLink(id!);
                await navigator.clipboard.writeText(result.invite_url);
                toast.success('Invite link copied to clipboard!');
              } catch {
                toast.error('Failed to generate invite link');
              }
            }}
            className="btn-secondary btn-sm"
            title="Generate & copy portal invite link"
          >
            <UserPlus className="w-4 h-4" /> Invite
          </button>
          <Link to={`/intelligence/${id}`} className="btn-secondary btn-sm flex items-center gap-1.5">
            <Brain className="w-4 h-4" /> Intelligence
          </Link>
          <Link to={`/influencers/${id}/mediakit`} className="btn-secondary btn-sm flex items-center gap-1.5">
            <Eye className="w-4 h-4" /> Media Kit
          </Link>
          <button onClick={() => setShowSendOffer(true)} className="btn-primary btn-sm">
            <Send className="w-4 h-4" /> Send Offer
          </button>
          {editMode ? (
            <>
              <button onClick={handleCancelEdit} className="btn-secondary btn-sm"><X className="w-4 h-4" /></button>
              <button onClick={handleSave} disabled={updateMutation.isPending} className="btn-primary btn-sm">
                <Save className="w-4 h-4" /> Save
              </button>
            </>
          ) : (
            <button onClick={() => setEditMode(true)} className="btn-primary btn-sm">
              <Edit2 className="w-4 h-4" /> Edit
            </button>
          )}
        </div>
      </div>

      {/* Profile header */}
      <div className="card p-6">
        <div className="flex items-start gap-5">
          <Avatar src={inf.profile_photo_url} name={name} size="xl" />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold text-white">{name}</h1>
                  {inf.mawthouq_certificate === 1 && (
                    <span className="badge badge-green">
                      <Shield className="w-3 h-3" /> Mawthouq
                    </span>
                  )}
                </div>
                {inf.name_arabic && inf.name_english && (
                  <p className="text-lg text-gray-500 arabic-text mb-2">{inf.name_arabic}</p>
                )}
                {inf.nickname && <p className="text-sm text-gray-500 mb-2">@{inf.nickname}</p>}
                <div className="flex flex-wrap gap-2">
                  {inf.main_category && <span className="badge badge-blue">{inf.main_category}</span>}
                  {inf.sub_category_1 && <span className="badge badge-gray">{inf.sub_category_1}</span>}
                  {inf.account_tier && <span className="badge badge-purple">{inf.account_tier}</span>}
                </div>
              </div>
              <div className="text-right shrink-0 space-y-1.5">
                {/* Trust score badge */}
                {inf.trust_tier && (
                  <div className="flex justify-end">
                    {(() => {
                      const cfg: Record<string, { cls: string }> = {
                        TRUSTED:  { cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
                        VERIFIED: { cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
                        CAUTION:  { cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
                        FLAGGED:  { cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
                      };
                      const c = cfg[inf.trust_tier!] || cfg.CAUTION;
                      return (
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${c.cls}`}>
                          <CheckCircle2 className="w-3 h-3" />
                          {inf.trust_tier} {inf.trust_score != null ? `${Math.round(inf.trust_score as number)}/100` : ''}
                        </span>
                      );
                    })()}
                  </div>
                )}
                {/* Data freshness */}
                {(() => {
                  const age = inf.last_enriched_at ? (Date.now() - new Date(inf.last_enriched_at).getTime()) / 86400000 : Infinity;
                  const Icon = age < 7 ? CheckCircle2 : age < 30 ? Clock : AlertCircle;
                  const color = age < 7 ? 'text-emerald-400' : age < 30 ? 'text-yellow-400' : 'text-orange-400';
                  const label = age < 7 ? 'Fresh data' : age < 30 ? 'Updated this month' : inf.last_enriched_at ? 'Stale data' : 'No sync yet';
                  return (
                    <div className={`flex items-center gap-1 justify-end text-xs ${color}`}>
                      <Icon className="w-3 h-3" /> {label}
                    </div>
                  );
                })()}
                {inf.supplier_source && <p className="text-xs text-gray-500">From: {inf.supplier_source}</p>}
                <p className="text-xs text-gray-500">Added: {formatDate(inf.created_at)}</p>
                {/* Public profile link + QR */}
                <div className="flex items-center gap-2">
                  <a href={`/p/${inf.id}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors">
                    <Link2 className="w-3 h-3" /> Public profile
                  </a>
                  <button
                    onClick={() => setShowQR(true)}
                    title="Show QR code"
                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors"
                  >
                    <QrCode className="w-3 h-3" /> QR
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Social Accounts */}
        <div className="card p-5">
          <SectionTitle>Social Accounts</SectionTitle>
          <div className="space-y-3">
            {[
              { platform: 'instagram' as const, handle: inf.ig_handle, url: inf.ig_url, followers: inf.ig_followers, rate: inf.ig_rate },
              { platform: 'tiktok' as const, handle: inf.tiktok_handle, url: inf.tiktok_url, followers: inf.tiktok_followers, rate: inf.tiktok_rate },
              { platform: 'snapchat' as const, handle: inf.snap_handle, url: inf.snap_url, followers: inf.snap_followers, rate: inf.snapchat_rate },
              { platform: 'facebook' as const, handle: inf.fb_handle, url: inf.fb_url, followers: inf.fb_followers, rate: inf.facebook_rate },
              { platform: 'youtube' as const, handle: inf.youtube_handle, url: inf.youtube_url, followers: inf.youtube_followers, rate: undefined },
              { platform: 'twitter' as const, handle: inf.twitter_handle, url: inf.twitter_handle ? `https://twitter.com/${inf.twitter_handle}` : undefined, followers: undefined, rate: undefined },
            ].filter(p => p.handle || p.url).map(p => (
              <div key={p.platform} className="flex items-center justify-between py-2 border-b border-surface-border last:border-0">
                <PlatformBadge platform={p.platform} handle={p.handle || undefined} followers={p.followers || undefined} />
                <div className="flex items-center gap-3">
                  {p.rate && <span className="text-sm font-semibold text-white">{formatRate(p.rate)}</span>}
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
            {!inf.ig_handle && !inf.tiktok_handle && !inf.snap_handle && !inf.fb_handle && (
              <p className="text-sm text-gray-500">No social accounts</p>
            )}
          </div>
        </div>

        {/* Contact Info */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>Contact Information</SectionTitle>
            {(inf.phone_number || inf.email) && (
              <button
                onClick={() => {
                  const name = inf.name_english || inf.name_arabic || inf.ig_handle || 'there';
                  const handle = inf.ig_handle ? `@${inf.ig_handle}` : inf.tiktok_handle ? `@${inf.tiktok_handle}` : '';
                  const msg = `Hi ${name}${handle ? ` (${handle})` : ''},\n\nI'm reaching out from FALAK regarding a brand collaboration opportunity that we think would be a great fit for your content.\n\nWould you be open to hearing more details?\n\nLooking forward to hearing from you!`;
                  navigator.clipboard.writeText(msg).then(() => toast.success('Outreach message copied!')).catch(() => toast.error('Copy failed'));
                }}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors"
                title="Copy outreach message"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Copy Message
              </button>
            )}
          </div>
          <div className="space-y-3">
            {inf.phone_number && (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-200">{inf.phone_number}</p>
                    {inf.way_of_contact && <p className="text-xs text-gray-500">{inf.way_of_contact}</p>}
                  </div>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(inf.phone_number!).then(() => toast.success('Phone copied')).catch(() => {})}
                  className="text-gray-600 hover:text-gray-300 transition-colors"
                  title="Copy phone number"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {inf.email && (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <p className="text-sm text-gray-200">{inf.email}</p>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(inf.email!).then(() => toast.success('Email copied')).catch(() => {})}
                  className="text-gray-600 hover:text-gray-300 transition-colors"
                  title="Copy email"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {(inf.city || inf.country) && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-500" />
                <p className="text-sm text-gray-200">
                  {[inf.city, inf.country, inf.nationality].filter(Boolean).join(', ')}
                </p>
              </div>
            )}
            {!inf.phone_number && !inf.email && !inf.country && (
              <p className="text-sm text-gray-500">No contact info</p>
            )}
          </div>
        </div>

        {/* Rate Card */}
        <div className="card p-5">
          <SectionTitle>Rate Card</SectionTitle>
          {editMode ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Instagram Rate" field="ig_rate" type="number" />
              <Field label="TikTok Rate" field="tiktok_rate" type="number" />
              <Field label="Snapchat Rate" field="snapchat_rate" type="number" />
              <Field label="Facebook Rate" field="facebook_rate" type="number" />
              <Field label="Package Rate" field="package_rate" type="number" />
              <Field label="Rate/Deliverable" field="rate_per_deliverable" type="number" />
            </div>
          ) : (
            <div className="space-y-2">
              {[
                { label: 'Instagram', rate: inf.ig_rate },
                { label: 'TikTok', rate: inf.tiktok_rate },
                { label: 'Snapchat', rate: inf.snapchat_rate },
                { label: 'Facebook', rate: inf.facebook_rate },
                { label: 'Package', rate: inf.package_rate },
              ].filter(r => r.rate).map(r => (
                <div key={r.label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{r.label}</span>
                  <span className="font-semibold text-white">{formatRate(r.rate)}</span>
                </div>
              ))}
              {!inf.ig_rate && !inf.tiktok_rate && !inf.snapchat_rate && !inf.package_rate && (
                <p className="text-sm text-gray-500">No rates on file</p>
              )}
            </div>
          )}
        </div>

        {/* Identity */}
        <div className="card p-5">
          <SectionTitle>Identity</SectionTitle>
          {editMode ? (
            <div className="space-y-3">
              <Field label="Name (English)" field="name_english" />
              <Field label="Name (Arabic)" field="name_arabic" arabic />
              <Field label="Nickname / Handle" field="nickname" />
              <Field label="Main Category" field="main_category" />
              <Field label="Sub Category" field="sub_category_1" />
              <Field label="Account Tier" field="account_tier" />
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              {inf.nationality && <div className="flex justify-between"><span className="text-gray-500">Nationality</span><span className="text-gray-200">{inf.nationality}</span></div>}
              {inf.national_id && <div className="flex justify-between"><span className="text-gray-500">National ID</span><span className="text-gray-200">{inf.national_id}</span></div>}
              {inf.media_kit_link && (
                <a href={inf.media_kit_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-gray-300 hover:text-white transition-colors">
                  <ExternalLink className="w-3 h-3" /> Media Kit
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Performance Score */}
      {performance && performance.total_offers > 0 && (
        <div className="card p-5">
          <SectionTitle>Performance Score</SectionTitle>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {performance.score !== null && (
              <div className="lg:col-span-1 flex flex-col items-center justify-center bg-surface-overlay rounded-xl p-4 border border-surface-border">
                <div className={cn(
                  'text-4xl font-bold',
                  performance.score >= 80 ? 'text-emerald-400' :
                  performance.score >= 60 ? 'text-blue-400' :
                  performance.score >= 40 ? 'text-amber-400' : 'text-red-400'
                )}>
                  {performance.score}
                </div>
                <div className="text-xs text-gray-500 mt-1">Performance Score</div>
              </div>
            )}
            <div className="space-y-3 col-span-1 lg:col-span-3">
              {[
                { label: 'Response Rate', value: performance.response_rate },
                { label: 'Completion Rate', value: performance.completion_rate },
                { label: 'Deliverable Approval', value: performance.deliverable_approval_rate },
              ].map(({ label, value }) => value !== null && (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">{label}</span>
                    <span className="text-xs font-semibold text-gray-200">{value}%</span>
                  </div>
                  <div className="h-1.5 bg-surface-overlay rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', value >= 80 ? 'bg-emerald-500' : value >= 60 ? 'bg-blue-500' : value >= 40 ? 'bg-amber-500' : 'bg-red-500')}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
            <span>{performance.total_offers} offers total</span>
            <span>{performance.accepted_offers} accepted</span>
            <span>{performance.completed_offers} completed</span>
            {performance.declined_offers > 0 && <span className="text-red-400">{performance.declined_offers} declined</span>}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="card p-5">
        <SectionTitle>Notes &amp; Tags</SectionTitle>
        {editMode ? (
          <div className="space-y-3">
            <div>
              <label className="label">Internal Notes</label>
              <textarea
                className="input text-sm h-24 resize-none"
                value={String(editData.internal_notes ?? inf.internal_notes ?? '')}
                onChange={e => handleEdit('internal_notes', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Tags (comma-separated)</label>
              <input
                className="input text-sm"
                value={String(editData.tags ?? inf.tags ?? '')}
                onChange={e => handleEdit('tags', e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div>
            {inf.internal_notes && <p className="text-sm text-gray-300 whitespace-pre-wrap mb-3">{inf.internal_notes}</p>}
            {inf.tags && (
              <div className="flex flex-wrap gap-1">
                {inf.tags.split(',').map(t => (
                  <span key={t} className="badge badge-gray">{t.trim()}</span>
                ))}
              </div>
            )}
            {!inf.internal_notes && !inf.tags && <p className="text-sm text-gray-500">No notes</p>}
          </div>
        )}
      </div>

      {/* Platform Stats (from OAuth sync) */}
      {inf.platform_stats && (inf.platform_stats as PlatformStat[]).length > 0 && (
        <div className="card p-5">
          <SectionTitle>Live Platform Stats</SectionTitle>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {(inf.platform_stats as PlatformStat[]).map(s => (
              <div key={s.platform} className="bg-surface-subtle rounded-lg p-3 border border-surface-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold capitalize text-gray-300">{s.platform}</span>
                  {s.data_source === 'oauth' && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded uppercase">Official</span>
                  )}
                </div>
                <div className="space-y-1 text-xs">
                  {!!s.follower_count && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Followers</span>
                      <span className="text-white font-semibold">{formatFollowers(s.follower_count)}</span>
                    </div>
                  )}
                  {!!s.avg_engagement_rate && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Engagement</span>
                      <span className="text-white">{s.avg_engagement_rate.toFixed(2)}%</span>
                    </div>
                  )}
                  {!!s.avg_views && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 flex items-center gap-1"><Eye className="w-3 h-3" /> Avg Views</span>
                      <span className="text-white">{formatFollowers(s.avg_views)}</span>
                    </div>
                  )}
                  {s.captured_at && (
                    <div className="text-gray-600 text-[10px] mt-1">
                      Updated {formatDate(s.captured_at)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Posts */}
      {postsData?.posts && postsData.posts.length > 0 && (
        <div className="card p-5">
          <SectionTitle>Top Content</SectionTitle>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {(postsData.posts as InfluencerPost[]).map(post => (
              <a
                key={post.id}
                href={post.post_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative aspect-square rounded-lg overflow-hidden bg-surface-subtle border border-surface-border hover:border-white/20 transition-all"
              >
                {post.thumbnail_url ? (
                  <img src={post.thumbnail_url} alt={post.caption?.slice(0,30) || 'post'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">{post.platform}</div>
                )}
                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-1.5 gap-0.5">
                  <div className="flex gap-2 text-[10px] text-gray-300">
                    {(post.likes || 0) > 0 && <span>♥ {formatFollowers(post.likes)}</span>}
                    {(post.views || 0) > 0 && <span>▶ {formatFollowers(post.views)}</span>}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Offers Section */}
      {(() => {
        const offers: Record<string, unknown>[] = Array.isArray(offersData)
          ? offersData
          : ((offersData as { data?: Record<string, unknown>[] })?.data ?? []);
        if (offers.length === 0) return null;
        const totalValue = offers.reduce((s, o) => s + (Number(o.rate) || 0), 0);
        const acceptedCount = offers.filter(o => ['accepted','in_progress','submitted','approved','completed'].includes(String(o.status))).length;
        const STATUS_COLORS: Record<string, string> = {
          pending:     'bg-surface-subtle text-gray-400 border border-surface-border',
          sent:        'bg-blue-900/40 text-blue-300 border border-blue-800/40',
          accepted:    'bg-emerald-900/40 text-emerald-300 border border-emerald-800/40',
          declined:    'bg-red-900/40 text-red-300 border border-red-800/40',
          in_progress: 'bg-amber-900/40 text-amber-300 border border-amber-800/40',
          submitted:   'bg-purple-900/40 text-purple-300 border border-purple-800/40',
          approved:    'bg-emerald-900/60 text-emerald-200 border border-emerald-700/40',
          completed:   'bg-gray-700 text-gray-300 border border-gray-600',
        };
        return (
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-surface-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SectionTitle>Offer History</SectionTitle>
                <span className="badge bg-surface-overlay text-gray-400 border border-surface-border -mt-4">{offers.length}</span>
              </div>
              <div className="flex gap-4 text-xs text-gray-500 -mt-4">
                <span>Total: <span className="text-white font-medium">SAR {totalValue.toLocaleString()}</span></span>
                <span>Accepted: <span className="text-emerald-400 font-medium">{offers.length > 0 ? Math.round(acceptedCount / offers.length * 100) : 0}%</span></span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-border">
                    <th className="text-left text-xs font-medium text-gray-500 px-5 py-2">Title</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-5 py-2">Campaign</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-5 py-2">Platform</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-5 py-2">Rate</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-5 py-2">Status</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-5 py-2">Sent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/50">
                  {offers.map(o => (
                    <tr key={String(o.id)} className="hover:bg-surface-overlay transition-colors">
                      <td className="px-5 py-2.5 text-white font-medium">{String(o.title || '—')}</td>
                      <td className="px-5 py-2.5 text-gray-400">{String(o.campaign_name || '—')}</td>
                      <td className="px-5 py-2.5 text-gray-400 capitalize">{String(o.platform || '—')}</td>
                      <td className="px-5 py-2.5 text-gray-300">{o.rate ? `${String(o.currency || 'SAR')} ${Number(o.rate).toLocaleString()}` : '—'}</td>
                      <td className="px-5 py-2.5">
                        <span className={cn('badge text-xs capitalize', STATUS_COLORS[String(o.status)] || STATUS_COLORS.pending)}>
                          {String(o.status || 'pending').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-gray-500 text-xs">{o.sent_at ? formatDate(String(o.sent_at)) : o.created_at ? formatDate(String(o.created_at)) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* History Modal */}
      <Modal open={showHistory} onClose={() => setShowHistory(false)} title="Edit History" size="lg">
        <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
          {(history as Array<Record<string, string>>)?.map((entry: Record<string, string>) => (
            <div key={entry.id} className="flex items-start gap-3 py-2 border-b border-surface-border text-sm">
              <div className="text-xs text-gray-500 w-32 shrink-0">{formatDate(entry.edited_at)}</div>
              <div>
                <span className="font-medium text-gray-300">{entry.field_name}</span>
                <span className="text-gray-500"> changed from </span>
                <span className="text-red-400 line-through">{entry.old_value || '—'}</span>
                <span className="text-gray-500"> to </span>
                <span className="text-emerald-400">{entry.new_value || '—'}</span>
              </div>
            </div>
          )) || <p className="text-sm text-gray-500 py-4 text-center">No history yet</p>}
        </div>
      </Modal>

      {/* Send Offer Modal */}
      <Modal open={showSendOffer} onClose={() => setShowSendOffer(false)} title={`Send Offer to ${name}`} size="md">
        <div className="p-5 space-y-3">
          <div>
            <label className="label">Offer Title *</label>
            <input className="input" placeholder="e.g. Instagram Reel – Ramadan Campaign" value={offerForm.title}
              onChange={e => setOfferForm(p => ({ ...p, title: e.target.value }))} />
          </div>
          <div>
            <label className="label">Brief</label>
            <textarea className="input resize-none h-24 text-sm" placeholder="Campaign brief and deliverables description..."
              value={offerForm.brief} onChange={e => setOfferForm(p => ({ ...p, brief: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Platform</label>
              <select className="input" value={offerForm.platform} onChange={e => setOfferForm(p => ({ ...p, platform: e.target.value }))}>
                <option value="">Any</option>
                <option value="Instagram">Instagram</option>
                <option value="TikTok">TikTok</option>
                <option value="Snapchat">Snapchat</option>
                <option value="Facebook">Facebook</option>
                <option value="YouTube">YouTube</option>
              </select>
            </div>
            <div>
              <label className="label">Deliverables</label>
              <input className="input text-sm" placeholder="e.g. 1 Reel + 2 Stories" value={offerForm.deliverables}
                onChange={e => setOfferForm(p => ({ ...p, deliverables: e.target.value }))} />
            </div>
            <div>
              <label className="label">Rate</label>
              <input className="input" type="number" placeholder="0" value={offerForm.rate}
                onChange={e => setOfferForm(p => ({ ...p, rate: e.target.value }))} />
            </div>
            <div>
              <label className="label">Currency</label>
              <select className="input" value={offerForm.currency} onChange={e => setOfferForm(p => ({ ...p, currency: e.target.value }))}>
                <option value="SAR">SAR</option>
                <option value="USD">USD</option>
                <option value="AED">AED</option>
                <option value="EGP">EGP</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Deadline</label>
            <input className="input" type="date" value={offerForm.deadline}
              onChange={e => setOfferForm(p => ({ ...p, deadline: e.target.value }))} />
          </div>
          <div>
            <label className="label">Agency Notes (private)</label>
            <input className="input text-sm" placeholder="Internal notes for the offer..." value={offerForm.agency_notes}
              onChange={e => setOfferForm(p => ({ ...p, agency_notes: e.target.value }))} />
          </div>
          <button
            onClick={() => sendOfferMutation.mutate()}
            disabled={sendOfferMutation.isPending || !offerForm.title.trim()}
            className="btn-primary w-full mt-2"
          >
            <Send className="w-4 h-4" />
            {sendOfferMutation.isPending ? 'Sending...' : 'Send Offer'}
          </button>
        </div>
      </Modal>

      {/* Add to Campaign Modal */}
      <Modal open={showAddCampaign} onClose={() => setShowAddCampaign(false)} title="Add to Campaign" size="md">
        <div className="p-4 space-y-2">
          {(campaigns as Campaign[])?.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400 mb-3">No campaigns yet</p>
              <Link to="/campaigns" className="btn-primary btn-sm">
                <Plus className="w-4 h-4" /> Create Campaign
              </Link>
            </div>
          )}
          {(campaigns as Campaign[])?.map((c: Campaign) => (
            <button
              key={c.id}
              className="w-full text-left p-3 rounded-lg border border-surface-border hover:border-white/20 hover:bg-surface-overlay transition-all"
              onClick={async () => {
                await addInfluencerToCampaign(c.id, { influencer_id: inf.id });
                toast.success(`Added to "${c.name}"`);
                setShowAddCampaign(false);
              }}
            >
              <p className="font-medium text-sm text-white">{c.name}</p>
              <p className="text-xs text-gray-500">{c.client_name} · {c.status}</p>
            </button>
          ))}
        </div>
      </Modal>

      {/* QR Code Modal */}
      <Modal open={showQR} onClose={() => setShowQR(false)} title="Public Profile QR Code" size="sm">
        {inf && (() => {
          const publicUrl = `${window.location.origin}/p/${inf.id}`;
          return (
            <div className="flex flex-col items-center gap-5 py-4">
              <div className="bg-white p-4 rounded-2xl shadow-inner">
                <QRCodeSVG value={publicUrl} size={200} level="M" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-white">{inf.name_english || inf.name_arabic || inf.ig_handle}</p>
                <p className="text-xs text-gray-500 break-all">{publicUrl}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(publicUrl).then(() => toast.success('Link copied!')).catch(() => {})}
                  className="btn-secondary btn-sm"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy Link
                </button>
                <a
                  href={`/p/${inf.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary btn-sm flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open Profile
                </a>
              </div>
              <p className="text-xs text-gray-600 text-center">Scan to view public profile · Screenshot for print</p>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
