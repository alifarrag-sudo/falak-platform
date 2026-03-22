import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Heart, Star, CheckCircle, XCircle, Clock, Send, Settings } from 'lucide-react';
import { portalGetFanRequests, portalRespondToFanRequest, portalGetFanSettings, portalUpdateFanSettings } from '../../utils/api';
import { formatDate } from '../../utils/helpers';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pending',   color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
  accepted:  { label: 'Accepted',  color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  fulfilled: { label: 'Fulfilled', color: 'text-green-400 bg-green-400/10 border-green-400/20' },
  declined:  { label: 'Declined',  color: 'text-red-400 bg-red-400/10 border-red-400/20' },
  cancelled: { label: 'Cancelled', color: 'text-gray-500 bg-gray-500/10 border-gray-500/20' },
};

const TYPE_ICONS: Record<string, string> = {
  shoutout: '📣', video_message: '🎥', photo: '📸', meetup: '🤝', live_chat: '📹', custom: '✨',
};

const PRICE_FIELDS = [
  { key: 'fan_shoutout_price',  label: 'Shoutout',      icon: '📣' },
  { key: 'fan_video_price',     label: 'Video Message',  icon: '🎥' },
  { key: 'fan_photo_price',     label: 'Photo',          icon: '📸' },
  { key: 'fan_meetup_price',    label: 'Meet & Greet',   icon: '🤝' },
  { key: 'fan_live_chat_price', label: 'Live Video Call', icon: '📹' },
  { key: 'fan_custom_price',    label: 'Custom Request', icon: '✨' },
];

function RequestCard({ req, onRefresh }: { req: any; onRefresh: () => void }) {
  const qc = useQueryClient();
  const [showRespond, setShowRespond] = useState(false);
  const [note, setNote] = useState('');
  const [deliveryUrl, setDeliveryUrl] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const statusCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;

  const respondMutation = useMutation({
    mutationFn: (decision: 'accepted' | 'declined' | 'fulfilled') =>
      portalRespondToFanRequest(req.id, { decision, influencer_note: note, delivery_url: deliveryUrl, delivery_note: deliveryNote }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal-fan-requests'] });
      toast.success('Response sent!');
      setShowRespond(false);
    },
    onError: () => toast.error('Failed to respond'),
  });

  return (
    <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl p-4 hover:border-[#3a3a3a] transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="text-2xl">{TYPE_ICONS[req.request_type] || '✨'}</span>
          <div className="min-w-0">
            <h4 className="text-white font-medium truncate">{req.title}</h4>
            <p className="text-purple-400 text-xs">
              from {req.fan_name || req.fan_email}
              {req.fan_username && ` (@${req.fan_username})`}
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium shrink-0 ${statusCfg.color}`}>
          {statusCfg.label}
        </span>
      </div>

      {req.message && <p className="text-gray-400 text-sm mb-2 ml-9 line-clamp-2">{req.message}</p>}

      <div className="flex items-center gap-3 text-xs text-gray-600 ml-9 mb-3">
        {req.budget && <span className="text-purple-400 font-medium">SAR {Number(req.budget).toLocaleString()}</span>}
        {req.deadline && <span>Due {formatDate(req.deadline)}</span>}
        {req.platform && <span className="capitalize">{req.platform}</span>}
        <span className="ml-auto">{formatDate(req.submitted_at)}</span>
      </div>

      {/* Actions */}
      {req.status === 'pending' && (
        <div className="ml-9 flex gap-2">
          <button
            onClick={() => respondMutation.mutate('accepted')}
            disabled={respondMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 border border-green-600/30 text-green-400 rounded-lg text-xs font-medium hover:bg-green-600/30 transition-colors"
          >
            <CheckCircle className="w-3.5 h-3.5" /> Accept
          </button>
          <button
            onClick={() => setShowRespond(p => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#252525] border border-[#2a2a2a] text-gray-400 rounded-lg text-xs hover:border-[#3a3a3a] transition-colors"
          >
            <Send className="w-3.5 h-3.5" /> Respond
          </button>
          <button
            onClick={() => respondMutation.mutate('declined')}
            disabled={respondMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/10 border border-red-600/20 text-red-400 rounded-lg text-xs hover:bg-red-600/20 transition-colors"
          >
            <XCircle className="w-3.5 h-3.5" /> Decline
          </button>
        </div>
      )}

      {req.status === 'accepted' && (
        <div className="ml-9">
          <button
            onClick={() => setShowRespond(p => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 border border-green-600/30 text-green-400 rounded-lg text-xs font-medium hover:bg-green-600/30 transition-colors"
          >
            <CheckCircle className="w-3.5 h-3.5" /> Mark as Fulfilled
          </button>
        </div>
      )}

      {/* Response form */}
      {showRespond && (
        <div className="ml-9 mt-3 space-y-3 border-t border-[#2a2a2a] pt-3">
          <textarea
            className="w-full bg-[#252525] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500 resize-none h-20"
            placeholder="Add a note for the fan (optional)..."
            value={note}
            onChange={e => setNote(e.target.value)}
          />
          {req.status === 'accepted' && (
            <>
              <input
                className="w-full bg-[#252525] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500"
                placeholder="Delivery URL (link to the content, video, etc.)"
                value={deliveryUrl}
                onChange={e => setDeliveryUrl(e.target.value)}
              />
              <input
                className="w-full bg-[#252525] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500"
                placeholder="Delivery note (optional)"
                value={deliveryNote}
                onChange={e => setDeliveryNote(e.target.value)}
              />
              <button
                onClick={() => respondMutation.mutate('fulfilled')}
                disabled={respondMutation.isPending}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                ✓ Mark Fulfilled
              </button>
            </>
          )}
          {req.status === 'pending' && (
            <button
              onClick={() => respondMutation.mutate('declined')}
              disabled={respondMutation.isPending}
              className="px-4 py-2 bg-red-600/20 border border-red-600/30 text-red-400 text-sm rounded-lg hover:bg-red-600/30 disabled:opacity-50"
            >
              Decline with Note
            </button>
          )}
        </div>
      )}

      {req.influencer_note && (
        <p className="text-gray-500 text-xs mt-2 ml-9">Your note: {req.influencer_note}</p>
      )}
    </div>
  );
}

export default function PortalFanRequestsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [showSettings, setShowSettings] = useState(false);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [responseTime, setResponseTime] = useState('');
  const [fanBio, setFanBio] = useState('');

  const { data: requests = [], isLoading, refetch } = useQuery({
    queryKey: ['portal-fan-requests', filter],
    queryFn: () => portalGetFanRequests(filter !== 'all' ? filter : undefined),
  });

  const { data: settings } = useQuery({
    queryKey: ['portal-fan-settings'],
    queryFn: portalGetFanSettings,
  });

  useEffect(() => {
    if (!settings) return;
    const p: Record<string, string> = {};
    PRICE_FIELDS.forEach(f => { if ((settings as any)[f.key]) p[f.key] = String((settings as any)[f.key]); });
    setPrices(p);
    setResponseTime((settings as any).fan_response_time || '');
    setFanBio((settings as any).fan_bio || '');
  }, [settings]);

  const saveSettingsMutation = useMutation({
    mutationFn: () => portalUpdateFanSettings({
      ...Object.fromEntries(PRICE_FIELDS.map(f => [f.key, prices[f.key] ? Number(prices[f.key]) : null])),
      fan_response_time: responseTime || null,
      fan_bio: fanBio || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal-fan-settings'] });
      toast.success('Fan settings saved!');
      setShowSettings(false);
    },
    onError: () => toast.error('Failed to save settings'),
  });

  const filters = ['all', 'pending', 'accepted', 'fulfilled', 'declined'];
  const counts: Record<string, number> = { all: requests.length };
  filters.slice(1).forEach(f => { counts[f] = requests.filter((r: any) => r.status === f).length; });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white text-xl font-bold flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-500" /> Fan Requests
          </h2>
          <p className="text-gray-500 text-sm mt-0.5">Requests from your fans</p>
        </div>
        <button
          onClick={() => setShowSettings(p => !p)}
          className="flex items-center gap-2 px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] text-gray-400 rounded-xl text-sm hover:border-[#3a3a3a] transition-colors"
        >
          <Settings className="w-4 h-4" /> Settings
        </button>
      </div>

      {/* Fan Settings Panel */}
      {showSettings && (
        <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Star className="w-4 h-4 text-purple-400" /> Fan Request Pricing (SAR)
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {PRICE_FIELDS.map(f => (
              <div key={f.key}>
                <label className="text-gray-500 text-xs mb-1 block">{f.icon} {f.label}</label>
                <input
                  type="number"
                  className="w-full bg-[#252525] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500"
                  placeholder="Leave empty to disable"
                  value={prices[f.key] || ''}
                  onChange={e => setPrices(prev => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div>
            <label className="text-gray-500 text-xs mb-1 block">⏱️ Typical Response Time</label>
            <input
              className="w-full bg-[#252525] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500"
              placeholder="e.g. 1-3 days, 48 hours..."
              value={responseTime}
              onChange={e => setResponseTime(e.target.value)}
            />
          </div>
          <div>
            <label className="text-gray-500 text-xs mb-1 block">📝 Fan Access Bio</label>
            <textarea
              className="w-full bg-[#252525] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500 resize-none h-20"
              placeholder="What fans should know before requesting (guidelines, availability, etc.)"
              value={fanBio}
              onChange={e => setFanBio(e.target.value)}
            />
          </div>
          <button
            onClick={() => saveSettingsMutation.mutate()}
            disabled={saveSettingsMutation.isPending}
            className="px-4 py-2.5 bg-white text-[#0f0f0f] text-sm font-semibold rounded-xl hover:bg-gray-100 disabled:opacity-50"
          >
            Save Settings
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap transition-all ${
              filter === f ? 'bg-white text-[#0f0f0f] border-white' : 'bg-[#1c1c1c] border-[#2a2a2a] text-gray-400 hover:border-[#3a3a3a]'
            }`}
          >
            {f === 'all' ? 'All' : STATUS_CONFIG[f]?.label} ({counts[f] || 0})
          </button>
        ))}
      </div>

      {/* Requests list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-28 bg-[#1c1c1c] rounded-xl animate-pulse" />)}
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl">
          <Heart className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-white font-medium">No fan requests yet</p>
          <p className="text-gray-500 text-sm mt-1">
            Set your prices above to start accepting fan requests.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req: any) => <RequestCard key={req.id} req={req} onRefresh={refetch} />)}
        </div>
      )}
    </div>
  );
}
