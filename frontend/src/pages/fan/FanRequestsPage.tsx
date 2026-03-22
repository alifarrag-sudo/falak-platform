import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Heart, Clock, CheckCircle, XCircle, ExternalLink, Search } from 'lucide-react';
import { fanGetRequests, fanCancelRequest } from '../../utils/api';
import { formatDate } from '../../utils/helpers';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:   { label: 'Pending',   color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', icon: Clock },
  accepted:  { label: 'Accepted',  color: 'text-blue-400 bg-blue-400/10 border-blue-400/20', icon: CheckCircle },
  fulfilled: { label: 'Fulfilled', color: 'text-green-400 bg-green-400/10 border-green-400/20', icon: CheckCircle },
  declined:  { label: 'Declined',  color: 'text-red-400 bg-red-400/10 border-red-400/20', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'text-gray-500 bg-gray-500/10 border-gray-500/20', icon: XCircle },
};

const TYPE_ICONS: Record<string, string> = {
  shoutout: '📣', video_message: '🎥', photo: '📸', meetup: '🤝', live_chat: '📹', custom: '✨',
};

export default function FanRequestsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filter, setFilter] = useState('all');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['fan-requests'],
    queryFn: fanGetRequests,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => fanCancelRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fan-requests'] });
      toast.success('Request cancelled');
    },
    onError: () => toast.error('Failed to cancel'),
  });

  const filtered = filter === 'all' ? requests : requests.filter((r: any) => r.status === filter);
  const FILTERS = ['all', 'pending', 'accepted', 'fulfilled', 'declined'];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">My Requests</h1>
          <p className="text-gray-500 text-sm mt-0.5">Track all your fan requests</p>
        </div>
        <button
          onClick={() => navigate('/fan/discover')}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity"
        >
          + New Request
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap transition-all ${
              filter === f
                ? 'bg-white text-[#0f0f0f] border-white'
                : 'bg-[#1c1c1c] border-[#2a2a2a] text-gray-400 hover:border-[#3a3a3a]'
            }`}
          >
            {f === 'all' ? 'All' : STATUS_CONFIG[f]?.label} {f === 'all' ? `(${requests.length})` : `(${requests.filter((r: any) => r.status === f).length})`}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-[#1c1c1c] rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Heart className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-white font-semibold">
            {filter === 'all' ? 'No requests yet' : `No ${filter} requests`}
          </p>
          <p className="text-gray-500 text-sm mt-1">
            {filter === 'all' ? 'Discover creators and send your first request!' : 'Your requests will appear here'}
          </p>
          {filter === 'all' && (
            <button
              onClick={() => navigate('/fan/discover')}
              className="mt-4 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-500 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity"
            >
              Discover Creators
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((req: any) => {
            const statusCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG['pending'];
            const StatusIcon = statusCfg.icon;

            return (
              <div key={req.id} className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-5 hover:border-[#3a3a3a] transition-colors">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="text-2xl mt-0.5">{TYPE_ICONS[req.request_type] || '✨'}</span>
                    <div className="min-w-0">
                      <h3 className="text-white font-semibold truncate">{req.title}</h3>
                      <button
                        onClick={() => navigate(`/fan/influencers/${req.influencer_id}`)}
                        className="text-purple-400 text-sm hover:underline"
                      >
                        {req.influencer_name || req.influencer_handle}
                      </button>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium shrink-0 ${statusCfg.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {statusCfg.label}
                  </span>
                </div>

                {req.message && (
                  <p className="text-gray-500 text-sm mb-3 line-clamp-2">{req.message}</p>
                )}

                <div className="flex items-center gap-4 text-xs text-gray-600">
                  <span>{req.request_type?.replace('_', ' ')}</span>
                  {req.budget && <span className="text-purple-400 font-medium">SAR {Number(req.budget).toLocaleString()}</span>}
                  {req.deadline && <span>Due {formatDate(req.deadline)}</span>}
                  <span className="ml-auto">{formatDate(req.submitted_at)}</span>
                </div>

                {/* Influencer response */}
                {req.influencer_note && (
                  <div className="mt-3 pt-3 border-t border-[#2a2a2a] bg-[#252525] rounded-xl px-3 py-2">
                    <p className="text-gray-500 text-xs font-medium mb-0.5">Creator's note:</p>
                    <p className="text-gray-300 text-sm">{req.influencer_note}</p>
                  </div>
                )}

                {/* Delivery */}
                {req.status === 'fulfilled' && req.delivery_url && (
                  <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
                    <a
                      href={req.delivery_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-green-400 text-sm hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View Delivery
                    </a>
                    {req.delivery_note && <p className="text-gray-500 text-xs mt-1">{req.delivery_note}</p>}
                  </div>
                )}

                {/* Cancel button */}
                {['pending', 'accepted'].includes(req.status) && (
                  <button
                    onClick={() => cancelMutation.mutate(req.id)}
                    disabled={cancelMutation.isPending}
                    className="mt-3 text-gray-600 hover:text-red-400 text-xs transition-colors"
                  >
                    Cancel request
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
