import { useNavigate } from 'react-router-dom';
import { Shield, Phone } from 'lucide-react';
import type { Influencer } from '../../types';
import Avatar from '../ui/Avatar';
import PlatformBadge from '../ui/PlatformBadge';
import { formatRate, getPrimaryRate, getDisplayName, cn } from '../../utils/helpers';

interface InfluencerCardProps {
  influencer: Influencer;
  selected?: boolean;
  onSelect?: (id: string) => void;
  currency?: string;
}

export default function InfluencerCard({ influencer: inf, selected, onSelect, currency = 'SAR' }: InfluencerCardProps) {
  const navigate = useNavigate();
  const name = getDisplayName(inf);
  const primaryRate = getPrimaryRate(inf);

  return (
    <div
      className={cn(
        'card p-4 cursor-pointer transition-all hover:border-white/20 hover:bg-surface-overlay',
        selected && 'ring-1 ring-white/40 border-white/20'
      )}
      onClick={() => navigate(`/influencers/${inf.id}`)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {onSelect && (
            <input
              type="checkbox"
              checked={selected || false}
              onChange={(e) => { e.stopPropagation(); onSelect(inf.id); }}
              className="w-4 h-4 rounded accent-white cursor-pointer"
              onClick={e => e.stopPropagation()}
            />
          )}
          <Avatar src={inf.profile_photo_url} name={name} size="lg" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-white text-sm leading-tight">{name}</span>
              {inf.mawthouq_certificate === 1 && (
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </div>
            {inf.name_arabic && inf.name_english && (
              <p className="text-xs text-gray-500 arabic-text mt-0.5">{inf.name_arabic}</p>
            )}
            {inf.main_category && (
              <span className="text-xs text-gray-400 font-medium">{inf.main_category}</span>
            )}
          </div>
        </div>

        {inf.account_tier && (
          <span className="badge badge-blue text-xs">{inf.account_tier}</span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {inf.ig_handle && (
          <PlatformBadge platform="instagram" handle={inf.ig_handle} followers={inf.ig_followers} />
        )}
        {inf.tiktok_handle && (
          <PlatformBadge platform="tiktok" handle={inf.tiktok_handle} followers={inf.tiktok_followers} />
        )}
        {inf.snap_handle && (
          <PlatformBadge platform="snapchat" handle={inf.snap_handle} followers={inf.snap_followers} />
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-surface-border">
        <div className="flex items-center gap-2">
          {inf.phone_number && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Phone className="w-3 h-3" />
            </span>
          )}
          {inf.country && (
            <span className="text-xs text-gray-500">{inf.country}</span>
          )}
        </div>
        {primaryRate && (
          <span className="text-sm font-bold text-white">{formatRate(primaryRate, currency)}</span>
        )}
      </div>
    </div>
  );
}
