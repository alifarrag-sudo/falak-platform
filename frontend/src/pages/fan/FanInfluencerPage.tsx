import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Users, TrendingUp, CheckCircle, Clock, ExternalLink } from 'lucide-react';
import { fanGetInfluencer, fanGetRequestTypes, fanSubmitRequest } from '../../utils/api';

function formatNum(n: number) {
  if (!n) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

const PRICE_MAP: Record<string, string> = {
  shoutout: 'fan_shoutout_price',
  video_message: 'fan_video_price',
  photo: 'fan_photo_price',
  meetup: 'fan_meetup_price',
  live_chat: 'fan_live_chat_price',
  custom: 'fan_custom_price',
};

export default function FanInfluencerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [selectedType, setSelectedType] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [budget, setBudget] = useState('');
  const [platform, setPlatform] = useState('');
  const [deadline, setDeadline] = useState('');
  const [showForm, setShowForm] = useState(false);

  const { data: inf, isLoading } = useQuery({
    queryKey: ['fan-influencer', id],
    queryFn: () => fanGetInfluencer(id!),
    enabled: !!id,
  });

  const { data: requestTypes = [] } = useQuery({
    queryKey: ['fan-request-types'],
    queryFn: fanGetRequestTypes,
  });

  const submitMutation = useMutation({
    mutationFn: () => fanSubmitRequest({
      influencer_id: id!,
      request_type: selectedType,
      title: title.trim(),
      message: message.trim() || undefined,
      budget: budget ? Number(budget) : undefined,
      currency: 'SAR',
      platform: platform || undefined,
      deadline: deadline || undefined,
    }),
    onSuccess: () => {
      toast.success('Request submitted! The creator will respond soon.');
      qc.invalidateQueries({ queryKey: ['fan-requests'] });
      setShowForm(false);
      setSelectedType(''); setTitle(''); setMessage(''); setBudget(''); setPlatform(''); setDeadline('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to submit request'),
  });

  const handleSelectType = (type: string) => {
    setSelectedType(type);
    const rt = requestTypes.find((r: any) => r.key === type);
    if (rt) setTitle(rt.label);
    setShowForm(true);
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-40 bg-[#1c1c1c] rounded-2xl" />
          <div className="h-20 bg-[#1c1c1c] rounded-2xl" />
          <div className="h-60 bg-[#1c1c1c] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!inf) return <div className="text-center py-20 text-gray-400">Creator not found</div>;

  const availableTypes = requestTypes.filter((rt: any) => inf[PRICE_MAP[rt.key]]);
  const hasAnyPrices = availableTypes.length > 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-500 hover:text-white text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Discover
      </button>

      {/* Profile card */}
      <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-600/30 to-pink-500/30 border border-purple-500/20 rounded-full flex items-center justify-center shrink-0">
            {inf.profile_image_url ? (
              <img src={inf.profile_image_url} alt={inf.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-purple-300">
                {(inf.name || inf.handle || '?')[0].toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-white text-xl font-bold">{inf.name || inf.handle}</h1>
            {inf.handle && <p className="text-gray-500 text-sm">@{inf.handle}</p>}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {inf.platform && <span className="bg-[#252525] border border-[#2a2a2a] text-gray-400 text-xs px-2 py-0.5 rounded-full capitalize">{inf.platform}</span>}
              {inf.category && <span className="bg-[#252525] border border-[#2a2a2a] text-gray-400 text-xs px-2 py-0.5 rounded-full capitalize">{inf.category}</span>}
              {inf.city && <span className="text-gray-600 text-xs">📍 {inf.city}</span>}
            </div>
            {inf.profile_url && (
              <a href={inf.profile_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-purple-400 text-xs mt-2 hover:underline">
                View Profile <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {(inf.fan_bio || inf.bio) && (
          <p className="text-gray-400 text-sm mt-4 leading-relaxed">{inf.fan_bio || inf.bio}</p>
        )}

        {/* Stats */}
        <div className="flex gap-6 mt-4 pt-4 border-t border-[#2a2a2a]">
          {inf.followers_count && (
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-white text-sm font-semibold">{formatNum(inf.followers_count)}</p>
                <p className="text-gray-600 text-xs">Followers</p>
              </div>
            </div>
          )}
          {inf.engagement_rate && (
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-white text-sm font-semibold">{inf.engagement_rate}%</p>
                <p className="text-gray-600 text-xs">Engagement</p>
              </div>
            </div>
          )}
          {inf.completed_requests > 0 && (
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <div>
                <p className="text-white text-sm font-semibold">{inf.completed_requests}</p>
                <p className="text-gray-600 text-xs">Fulfilled</p>
              </div>
            </div>
          )}
          {inf.fan_response_time && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-white text-sm font-semibold">{inf.fan_response_time}</p>
                <p className="text-gray-600 text-xs">Avg Response</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Request types */}
      {!showForm && (
        <div className="space-y-3">
          <h2 className="text-white font-semibold mb-4">Choose a Request Type</h2>

          {!hasAnyPrices ? (
            <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-6 text-center">
              <p className="text-gray-500">This creator hasn't set up fan requests yet.</p>
            </div>
          ) : (
            requestTypes.map((rt: any) => {
              const priceKey = PRICE_MAP[rt.key];
              const price = inf[priceKey];
              if (!price) return null;
              return (
                <button
                  key={rt.key}
                  onClick={() => handleSelectType(rt.key)}
                  className="w-full bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-4 flex items-center gap-4 hover:border-purple-500/50 hover:bg-[#222] transition-all text-left group"
                >
                  <span className="text-3xl">{rt.icon}</span>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold group-hover:text-purple-300 transition-colors">{rt.label}</h3>
                    <p className="text-gray-500 text-sm">{rt.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-purple-400 font-semibold">SAR {Number(price).toLocaleString()}</p>
                    <p className="text-gray-600 text-xs">per request</p>
                  </div>
                </button>
              );
            })
          )}

          {/* Custom with no price set */}
          {!inf[PRICE_MAP['custom']] && (
            <button
              onClick={() => handleSelectType('custom')}
              className="w-full bg-[#1c1c1c] border border-dashed border-[#2a2a2a] rounded-2xl p-4 flex items-center gap-4 hover:border-purple-500/30 transition-all text-left"
            >
              <span className="text-3xl">✨</span>
              <div>
                <h3 className="text-white font-semibold">Custom Request</h3>
                <p className="text-gray-500 text-sm">Have a unique idea? Send a custom request!</p>
              </div>
              <span className="ml-auto text-gray-600 text-sm">Price on request</span>
            </button>
          )}
        </div>
      )}

      {/* Request Form */}
      {showForm && (
        <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-semibold">
              {requestTypes.find((r: any) => r.key === selectedType)?.icon} {' '}
              {requestTypes.find((r: any) => r.key === selectedType)?.label}
            </h2>
            <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white text-sm">← Back</button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-gray-400 text-sm mb-1 block">Request Title *</label>
              <input
                className="w-full bg-[#252525] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500"
                placeholder="e.g. Shoutout for my birthday"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="text-gray-400 text-sm mb-1 block">Details & Message</label>
              <textarea
                className="w-full bg-[#252525] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500 resize-none h-28"
                placeholder="Tell the creator exactly what you're looking for, any specific details, personal note, etc."
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Your Budget (SAR)</label>
                <input
                  type="number"
                  className="w-full bg-[#252525] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500"
                  placeholder={inf[PRICE_MAP[selectedType]] ? `Min ${inf[PRICE_MAP[selectedType]]}` : 'Amount'}
                  value={budget}
                  onChange={e => setBudget(e.target.value)}
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Preferred Deadline</label>
                <input
                  type="date"
                  className="w-full bg-[#252525] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                />
              </div>
            </div>

            {['shoutout', 'video_message'].includes(selectedType) && (
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Platform</label>
                <select
                  className="w-full bg-[#252525] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500"
                  value={platform}
                  onChange={e => setPlatform(e.target.value)}
                >
                  <option value="">Any Platform</option>
                  {['instagram', 'tiktok', 'youtube', 'twitter', 'snapchat'].map(p => (
                    <option key={p} value={p} className="capitalize">{p}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => {
                if (!title.trim()) { toast.error('Please add a title for your request'); return; }
                submitMutation.mutate();
              }}
              disabled={submitMutation.isPending}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitMutation.isPending ? 'Submitting...' : '✨ Submit Request'}
            </button>

            <p className="text-gray-600 text-xs text-center">
              The creator will review your request and respond. Payment is arranged after acceptance.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
