/**
 * /portal/connections
 * Influencer connects their social accounts via OAuth.
 * Shows: platform cards, connect/disconnect, data freshness, manual sync.
 */
import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Clock, RefreshCw, Unlink, ExternalLink, Wifi } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  oauthGetConnections, oauthGetAuthUrl, oauthDisconnect, oauthSync,
  type SocialConnection, portalGetProfile,
} from '../../utils/api';

// ── Platform meta ─────────────────────────────────────────────────────────────

const PLATFORMS: {
  key: string;
  label: string;
  color: string;
  bg: string;
  icon: string;
}[] = [
  { key: 'instagram', label: 'Instagram',  color: 'text-pink-400',   bg: 'bg-pink-400/10',   icon: '📸' },
  { key: 'tiktok',    label: 'TikTok',     color: 'text-cyan-400',   bg: 'bg-cyan-400/10',   icon: '🎵' },
  { key: 'youtube',   label: 'YouTube',    color: 'text-red-400',    bg: 'bg-red-400/10',    icon: '▶️' },
  { key: 'snapchat',  label: 'Snapchat',   color: 'text-yellow-400', bg: 'bg-yellow-400/10', icon: '👻' },
  { key: 'twitter',   label: 'X (Twitter)', color: 'text-sky-400',   bg: 'bg-sky-400/10',    icon: '𝕏'  },
  { key: 'facebook',  label: 'Facebook',    color: 'text-blue-400',   bg: 'bg-blue-400/10',   icon: '📘' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function freshnessLabel(lastSynced: string | null): {
  label: string;
  color: string;
  icon: typeof CheckCircle2;
} {
  if (!lastSynced) return { label: 'Never synced', color: 'text-gray-500', icon: Clock };
  const age = Date.now() - new Date(lastSynced).getTime();
  const hours = age / 1000 / 3600;
  if (hours < 24)   return { label: 'Fresh',         color: 'text-green-400',  icon: CheckCircle2 };
  if (hours < 72)   return { label: '1-3 days old',  color: 'text-yellow-400', icon: Clock };
  if (hours < 168)  return { label: '3-7 days old',  color: 'text-orange-400', icon: AlertCircle };
  return               { label: `${Math.floor(hours / 24)}d old`, color: 'text-red-400', icon: AlertCircle };
}

function syncStatusBadge(status: string | null) {
  if (!status) return null;
  const map: Record<string, string> = {
    synced:  'bg-green-500/20 text-green-400',
    pending: 'bg-yellow-500/20 text-yellow-400',
    error:   'bg-red-500/20 text-red-400',
  };
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide ${map[status] ?? 'bg-gray-500/20 text-gray-400'}`}>
      {status}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PortalConnectionsPage() {
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [userId, setUserId]           = useState<string | null>(null);
  const [syncing,  setSyncing]        = useState<Record<string, boolean>>({});
  const [loading,  setLoading]        = useState(true);

  // Fetch portal user id then connections
  const refresh = useCallback(async (uid: string) => {
    try {
      const res = await oauthGetConnections(uid);
      setConnections(res.connections);
    } catch {
      // silent — no connections
    }
  }, []);

  useEffect(() => {
    portalGetProfile()
      .then(profile => {
        const uid = profile.id as string;
        setUserId(uid);
        return refresh(uid);
      })
      .catch(() => {/* handled by PortalLayout redirect */})
      .finally(() => setLoading(false));
  }, [refresh]);

  const getConnection = (platform: string) =>
    connections.find(c => c.platform === platform) ?? null;

  const handleConnect = async (platform: string) => {
    if (!userId) return;
    try {
      const { url, configured } = await oauthGetAuthUrl(platform, userId);
      if (!configured) {
        toast.error(`${platform} OAuth is not configured yet. Ask your admin to set it up in /admin/integrations.`);
        return;
      }
      // Redirect to OAuth provider
      window.location.href = url!;
    } catch {
      toast.error('Failed to generate OAuth URL. Try again.');
    }
  };

  const handleDisconnect = async (platform: string) => {
    if (!userId) return;
    if (!confirm(`Disconnect your ${platform} account? Your analytics data will be preserved.`)) return;
    try {
      await oauthDisconnect(platform, userId);
      setConnections(prev => prev.filter(c => c.platform !== platform));
      toast.success(`${platform} disconnected.`);
    } catch {
      toast.error('Failed to disconnect. Try again.');
    }
  };

  const handleSync = async (platform: string) => {
    if (!userId) return;
    setSyncing(s => ({ ...s, [platform]: true }));
    try {
      const res = await oauthSync(platform, userId);
      if (res.ok) {
        toast.success(`${platform} synced successfully.`);
        await refresh(userId);
      } else {
        toast.error(res.message || 'Sync failed. Check your credentials.');
      }
    } catch {
      toast.error('Sync request failed. Try again.');
    } finally {
      setSyncing(s => ({ ...s, [platform]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Loading connections…
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Connect Your Accounts</h1>
        <p className="text-sm text-gray-400 mt-1">
          Link your social media accounts so we can verify your stats and match you with relevant campaigns.
          Your credentials are encrypted and never shared with brands.
        </p>
      </div>

      {/* Platform cards */}
      <div className="space-y-3">
        {PLATFORMS.map(p => {
          const conn = getConnection(p.key);
          const isConnected = !!conn;
          const freshness = freshnessLabel(conn?.last_synced_at ?? null);
          const FreshnessIcon = freshness.icon;

          return (
            <div
              key={p.key}
              className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl p-4 flex items-center gap-4"
            >
              {/* Platform icon */}
              <div className={`w-11 h-11 rounded-lg flex items-center justify-center text-xl shrink-0 ${p.bg}`}>
                {p.icon}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-semibold text-sm ${p.color}`}>{p.label}</span>
                  {isConnected && syncStatusBadge(conn.sync_status)}
                </div>

                {isConnected ? (
                  <div className="mt-0.5 flex items-center gap-3 flex-wrap">
                    {!!conn.platform_username && (
                      <span className="text-xs text-gray-300">@{conn.platform_username}</span>
                    )}
                    <span className={`flex items-center gap-1 text-xs ${freshness.color}`}>
                      <FreshnessIcon className="w-3 h-3" />
                      {freshness.label}
                    </span>
                    {!!conn.last_synced_at && (
                      <span className="text-xs text-gray-500">
                        Last sync: {new Date(conn.last_synced_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 mt-0.5">Not connected</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {isConnected ? (
                  <>
                    <button
                      onClick={() => handleSync(p.key)}
                      disabled={syncing[p.key]}
                      title="Sync now"
                      className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncing[p.key] ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleDisconnect(p.key)}
                      title="Disconnect"
                      className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition"
                    >
                      <Unlink className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleConnect(p.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition ${p.bg} hover:opacity-80`}
                  >
                    <ExternalLink className="w-3 h-3" />
                    Connect
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info box */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex gap-3">
        <Wifi className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-gray-400 space-y-1">
          <p className="font-medium text-blue-300">How it works</p>
          <p>Connecting an account grants read-only access to your public stats — followers, engagement, recent posts. We never post on your behalf or access your direct messages.</p>
          <p>Data is refreshed automatically every 72 hours. You can also trigger a manual sync at any time.</p>
        </div>
      </div>

    </div>
  );
}
