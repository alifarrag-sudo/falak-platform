/**
 * Public shareable fan delivery page — /fan/delivery/:token
 * No authentication required. Shows the fulfilled request delivery content.
 */
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Star, Heart, Share2 } from 'lucide-react';
import { fanGetDelivery } from '../../utils/api';

const TYPE_LABELS: Record<string, string> = {
  shoutout:      'Social Shoutout',
  video_message: 'Video Message',
  photo:         'Photo / Selfie',
  meetup:        'Meet & Greet',
  live_chat:     'Live Video Call',
  custom:        'Custom Request',
};

export default function FanDeliveryPage() {
  const { token } = useParams<{ token: string }>();

  const { data: delivery, isLoading, isError } = useQuery({
    queryKey: ['fan-delivery', token],
    queryFn: () => fanGetDelivery(token!),
    enabled: !!token,
    retry: false,
  });

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${delivery?.name_english || 'Creator'} — Fan Delivery`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href).then(() => {
        alert('Link copied to clipboard!');
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-purple-400/30 border-t-purple-400 animate-spin" />
      </div>
    );
  }

  if (isError || !delivery) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center p-6 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <h1 className="text-xl font-bold text-white mb-2">Delivery not found</h1>
        <p className="text-gray-400 text-sm mb-6">This link may have expired or the request hasn't been fulfilled yet.</p>
        <Link to="/fan" className="text-purple-400 hover:text-purple-300 text-sm">← Back to FALAK Fan</Link>
      </div>
    );
  }

  const influencerName = String(delivery.name_english || delivery.name_arabic || 'Creator');
  const handle = delivery.ig_handle
    ? `@${String(delivery.ig_handle)}`
    : delivery.tiktok_handle
    ? `@${String(delivery.tiktok_handle)}`
    : '';
  const requestTypeLabel = TYPE_LABELS[String(delivery.request_type || '')] || String(delivery.request_type || 'Request');
  const fulfilledDate = delivery.fulfilled_at
    ? new Date(String(delivery.fulfilled_at)).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* Header */}
      <header className="bg-[#161616] border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <Link to="/fan" className="text-sm text-gray-400 hover:text-white flex items-center gap-1">
          <Heart className="w-4 h-4 text-purple-400" />
          <span className="font-semibold text-purple-400">FALAK Fan</span>
        </Link>
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full transition-colors"
        >
          <Share2 className="w-3.5 h-3.5" />
          Share
        </button>
      </header>

      {/* Main content */}
      <div className="max-w-xl mx-auto px-4 py-10 space-y-6">
        {/* Creator card */}
        <div className="bg-white/5 rounded-2xl p-6 flex items-center gap-4">
          {delivery.profile_image_url ? (
            <img
              src={String(delivery.profile_image_url)}
              alt={influencerName}
              className="w-16 h-16 rounded-full object-cover ring-2 ring-purple-500/40"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-purple-900/40 ring-2 ring-purple-500/40 flex items-center justify-center text-2xl font-bold text-purple-300">
              {influencerName[0]}
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold text-white">{influencerName}</h1>
            {handle && <p className="text-sm text-gray-400">{handle}</p>}
          </div>
        </div>

        {/* Request info */}
        <div className="bg-white/5 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs bg-purple-900/40 text-purple-300 px-2.5 py-0.5 rounded-full font-medium">
              {requestTypeLabel}
            </span>
            {fulfilledDate && (
              <span className="text-xs text-gray-500">Fulfilled {fulfilledDate}</span>
            )}
          </div>
          <h2 className="text-xl font-bold text-white">{String(delivery.title || '')}</h2>
          {delivery.message ? (
            <p className="text-sm text-gray-400 leading-relaxed">{String(delivery.message)}</p>
          ) : null}
        </div>

        {/* Delivery content */}
        {Boolean(delivery.delivery_note || delivery.delivery_url) ? (
          <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/20 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-400" />
              <h3 className="text-sm font-semibold text-white">Your Delivery</h3>
            </div>
            {delivery.delivery_note ? (
              <p className="text-sm text-gray-300 leading-relaxed italic">
                "{String(delivery.delivery_note)}"
              </p>
            ) : null}
            {delivery.delivery_url ? (
              <a
                href={String(delivery.delivery_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-purple-300 hover:text-purple-200 font-medium bg-purple-900/30 hover:bg-purple-900/50 px-4 py-2.5 rounded-xl transition-colors w-fit"
              >
                <ExternalLink className="w-4 h-4" />
                View content
              </a>
            ) : null}
          </div>
        ) : null}

        {/* Footer */}
        <div className="text-center text-xs text-gray-600 pt-4">
          Powered by{' '}
          <Link to="/fan" className="text-purple-500 hover:text-purple-400">FALAK</Link>
          {' '}— Connecting fans and creators
        </div>
      </div>
    </div>
  );
}
