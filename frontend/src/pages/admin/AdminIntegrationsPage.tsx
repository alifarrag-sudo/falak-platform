/**
 * /admin/integrations — Social platform OAuth setup guide + live config status.
 * Shows which platforms are configured and exactly what the admin needs to do.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, CheckCircle2, XCircle, ChevronDown, ChevronUp, Copy, Check, Zap, Loader2 } from 'lucide-react';
import { oauthConfigStatus } from '../../utils/api';

const BACKEND = 'http://localhost:3001'; // Change to production URL when deploying

const PLATFORMS = [
  {
    key: 'instagram',
    name: 'Instagram',
    emoji: '📸',
    color: 'text-pink-400',
    border: 'border-pink-500/20',
    envVars: [
      { key: 'INSTAGRAM_APP_ID',     label: 'App ID' },
      { key: 'INSTAGRAM_APP_SECRET', label: 'App Secret' },
    ],
    callbackUrl: `${BACKEND}/api/oauth/callback/instagram`,
    devPortal: 'https://developers.facebook.com/apps/',
    scopes: ['instagram_basic', 'instagram_content_publish', 'pages_read_engagement'],
    approxTime: '30 min',
    difficulty: 'Medium',
    notes: 'Requires a Facebook Business account. Your Instagram must be a Professional (Creator or Business) account linked to a Facebook Page.',
    steps: [
      { title: 'Create a Meta Developer Account', detail: 'Go to developers.facebook.com and click "Get Started". Verify your account with a phone number.' },
      { title: 'Create a new App', detail: 'Click "Create App" → choose "Business" type → give it a name (e.g. "CP NSM Platform").' },
      { title: 'Add Instagram Basic Display', detail: 'In your app dashboard, find "Add a Product" → add "Instagram Basic Display". Click "Set Up".' },
      { title: 'Add the Callback URL', detail: 'Under Instagram Basic Display → Settings, paste your callback URL into "Valid OAuth Redirect URIs".' },
      { title: 'Add test users', detail: 'Under Roles → Test Users, add the Instagram accounts you want to test with.' },
      { title: 'Copy credentials to .env', detail: 'Copy the App ID and App Secret from the app dashboard into your backend .env file.' },
    ],
  },
  {
    key: 'tiktok',
    name: 'TikTok',
    emoji: '🎵',
    color: 'text-cyan-400',
    border: 'border-cyan-500/20',
    envVars: [
      { key: 'TIKTOK_CLIENT_KEY',    label: 'Client Key' },
      { key: 'TIKTOK_CLIENT_SECRET', label: 'Client Secret' },
    ],
    callbackUrl: `${BACKEND}/api/oauth/callback/tiktok`,
    devPortal: 'https://developers.tiktok.com/',
    scopes: ['user.info.basic', 'video.list'],
    approxTime: '45 min',
    difficulty: 'Medium',
    notes: 'TikTok apps require a review process that can take 1–3 business days. Apply early.',
    steps: [
      { title: 'Create a TikTok Developer Account', detail: 'Go to developers.tiktok.com → click "Manage Apps" → sign in with a TikTok account.' },
      { title: 'Create a new App', detail: 'Click "Connect an app" → fill in app name, description, and category.' },
      { title: 'Configure Login Kit', detail: 'Find "Login Kit" → add your callback URL under "Redirect domain". Use the full URL including https or http.' },
      { title: 'Request Scopes', detail: 'Under "Scopes", request: user.info.basic and video.list. Save and submit for review.' },
      { title: 'Copy credentials', detail: 'After approval, copy Client Key and Client Secret from the app settings into your .env file.' },
    ],
  },
  {
    key: 'youtube',
    name: 'YouTube',
    emoji: '▶️',
    color: 'text-red-400',
    border: 'border-red-500/20',
    envVars: [
      { key: 'YOUTUBE_CLIENT_ID',     label: 'Client ID' },
      { key: 'YOUTUBE_CLIENT_SECRET', label: 'Client Secret' },
    ],
    callbackUrl: `${BACKEND}/api/oauth/callback/youtube`,
    devPortal: 'https://console.cloud.google.com/',
    scopes: ['youtube.readonly', 'yt-analytics.readonly'],
    approxTime: '20 min',
    difficulty: 'Easy',
    notes: 'Uses Google Cloud Console. The YouTube Data API v3 has a free quota of 10,000 units/day which is sufficient for most use cases.',
    steps: [
      { title: 'Create a Google Cloud Project', detail: 'Go to console.cloud.google.com → New Project → give it a name.' },
      { title: 'Enable APIs', detail: 'Go to "APIs & Services" → "Library" → search and enable: "YouTube Data API v3" and "YouTube Analytics API".' },
      { title: 'Configure OAuth Consent Screen', detail: 'Go to "OAuth consent screen" → choose "External" → fill in app name, support email, developer contact. Add the YouTube scopes.' },
      { title: 'Create OAuth Credentials', detail: 'Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs" → choose "Web application". Add your callback URL under "Authorized redirect URIs".' },
      { title: 'Copy credentials', detail: 'Download the JSON or copy Client ID and Client Secret into your .env file.' },
    ],
  },
  {
    key: 'snapchat',
    name: 'Snapchat',
    emoji: '👻',
    color: 'text-yellow-400',
    border: 'border-yellow-500/20',
    envVars: [
      { key: 'SNAPCHAT_CLIENT_ID',     label: 'Client ID' },
      { key: 'SNAPCHAT_CLIENT_SECRET', label: 'Client Secret' },
    ],
    callbackUrl: `${BACKEND}/api/oauth/callback/snapchat`,
    devPortal: 'https://kit.snapchat.com/',
    scopes: ['https://auth.snapchat.com/oauth2/api/user.profile'],
    approxTime: '25 min',
    difficulty: 'Easy',
    notes: "Snapchat's public API has limited data. It provides basic profile info. Detailed audience analytics require Snap Ads Manager access.",
    steps: [
      { title: 'Create a Snap Kit Developer Account', detail: 'Go to kit.snapchat.com → sign in with a Snapchat account → click "Create App".' },
      { title: 'Configure Login Kit', detail: 'Under your app → "Login Kit" tab → enable it and add your callback URL under "Redirect URIs".' },
      { title: 'Set permissions', detail: 'Enable the "User Profile" scope. Other scopes require review.' },
      { title: 'Copy credentials', detail: 'Find Client ID and Client Secret under "App Info" in your app settings and paste into .env.' },
    ],
  },
  {
    key: 'twitter',
    name: 'X (Twitter)',
    emoji: '𝕏',
    color: 'text-sky-400',
    border: 'border-sky-500/20',
    envVars: [
      { key: 'TWITTER_CLIENT_ID',     label: 'Client ID' },
      { key: 'TWITTER_CLIENT_SECRET', label: 'Client Secret' },
    ],
    callbackUrl: `${BACKEND}/api/oauth/callback/twitter`,
    devPortal: 'https://developer.twitter.com/en/portal/dashboard',
    scopes: ['tweet.read', 'users.read', 'offline.access'],
    approxTime: '20 min',
    difficulty: 'Easy',
    notes: 'Requires a Twitter Developer account. Free tier (Basic) is sufficient. Uses OAuth 2.0 with PKCE — already implemented.',
    steps: [
      { title: 'Apply for Developer Access', detail: 'Go to developer.twitter.com → click "Sign up" → answer questions about your use case. Free Basic tier is approved instantly.' },
      { title: 'Create a Project & App', detail: 'In the developer portal → "Projects & Apps" → "Overview" → "New Project" → create a project and add an app inside it.' },
      { title: 'Configure OAuth 2.0', detail: 'In your app → "Settings" → "User authentication settings" → Enable OAuth 2.0. Set Type of App to "Web App". Add your callback URL.' },
      { title: 'Copy credentials', detail: 'Under "Keys and tokens" → copy Client ID and Client Secret into your .env file.' },
    ],
  },
  {
    key: 'facebook',
    name: 'Facebook',
    emoji: '📘',
    color: 'text-blue-400',
    border: 'border-blue-500/20',
    envVars: [
      { key: 'FACEBOOK_APP_ID',     label: 'App ID' },
      { key: 'FACEBOOK_APP_SECRET', label: 'App Secret' },
    ],
    callbackUrl: `${BACKEND}/api/oauth/callback/facebook`,
    devPortal: 'https://developers.facebook.com/apps/',
    scopes: ['public_profile', 'pages_show_list', 'pages_read_engagement'],
    approxTime: '30 min',
    difficulty: 'Medium',
    notes: 'Uses the same Meta developer app as Instagram. If you already created an app for Instagram, you can reuse the same App ID and Secret.',
    steps: [
      { title: 'Use your existing Meta App', detail: 'If you already set up Instagram, go to your app at developers.facebook.com. Otherwise create a new Business app.' },
      { title: 'Add Facebook Login product', detail: 'In your app dashboard → "Add Product" → find "Facebook Login" → click "Set Up" → choose "Web".' },
      { title: 'Add the Callback URL', detail: 'Under Facebook Login → Settings → add your callback URL to "Valid OAuth Redirect URIs".' },
      { title: 'Enable permissions', detail: 'Under App Review → Permissions → request: public_profile (auto-approved), pages_show_list, pages_read_engagement.' },
      { title: 'Copy credentials', detail: 'Use the same App ID and App Secret as Instagram (they are the same Meta app). Paste into FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in .env.' },
    ],
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={handleCopy} className="p-1 rounded hover:bg-white/10 transition text-gray-500 hover:text-white" title="Copy">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

const DIFFICULTY_COLOR: Record<string, string> = {
  Easy:   'text-emerald-400 bg-emerald-500/10',
  Medium: 'text-yellow-400 bg-yellow-500/10',
  Hard:   'text-red-400 bg-red-500/10',
};

interface PingResult {
  ok: boolean;
  detail?: string;
  error?: string;
  latency_ms: number;
}

async function pingPlatform(platform: string): Promise<PingResult> {
  const res = await fetch(`${BACKEND}/api/oauth/ping/${platform}`, { method: 'POST' });
  return res.json();
}

export default function AdminIntegrationsPage() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pingResults, setPingResults] = useState<Record<string, PingResult & { loading?: boolean }>>({});

  const handlePing = async (platform: string) => {
    setPingResults(prev => ({ ...prev, [platform]: { ok: false, latency_ms: 0, loading: true } }));
    try {
      const result = await pingPlatform(platform);
      setPingResults(prev => ({ ...prev, [platform]: result }));
    } catch {
      setPingResults(prev => ({ ...prev, [platform]: { ok: false, error: 'Network error', latency_ms: 0 } }));
    }
  };

  const handlePingAll = async () => {
    const configured = PLATFORMS.filter(p => configStatus[p.key]);
    for (const p of configured) {
      handlePing(p.key);
    }
  };

  const { data: statusData } = useQuery({
    queryKey: ['oauth-config-status'],
    queryFn: oauthConfigStatus,
    refetchInterval: 30000,
  });

  const configStatus = statusData?.status || {};
  const configuredCount = Object.values(configStatus).filter(Boolean).length;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Social Platform Integrations</h1>
          <p className="text-sm text-gray-500 mt-1">
            Set up OAuth apps on each platform so influencers can connect their accounts and share real-time data.
          </p>
        </div>
        <div className="text-right shrink-0 space-y-2">
          <p className="text-2xl font-bold text-white">{configuredCount}<span className="text-gray-500 text-base font-normal">/{PLATFORMS.length}</span></p>
          <p className="text-xs text-gray-500">platforms configured</p>
          {configuredCount > 0 && (
            <button onClick={handlePingAll} className="btn-secondary btn-sm text-xs flex items-center gap-1.5">
              <Zap className="w-3 h-3" /> Test All Live
            </button>
          )}
        </div>
      </div>

      {/* Workflow banner */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 text-sm text-gray-400 space-y-1">
        <p className="text-blue-300 font-medium">How it works</p>
        <p>1. Register an OAuth app on each platform's developer portal using the instructions below.</p>
        <p>2. Copy your Client ID + Secret into <code className="text-amber-300 text-xs bg-black/30 px-1 rounded">backend/.env</code> and restart the backend.</p>
        <p>3. Influencers visit <code className="text-amber-300 text-xs bg-black/30 px-1 rounded">/portal/connections</code> to connect their accounts. Data syncs automatically every 72 hours.</p>
      </div>

      {/* .env template */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">backend/.env — paste these and fill in values</p>
          <CopyButton text={PLATFORMS.flatMap(p => p.envVars.map(v => `${v.key}=`)).join('\n')} />
        </div>
        <pre className="text-xs font-mono text-gray-300 bg-black/30 rounded-lg p-4 overflow-x-auto leading-relaxed">
{PLATFORMS.map(p => `# ${p.name}\n${p.envVars.map(v => `${v.key}=your_${v.label.toLowerCase().replace(/ /g,'_')}_here`).join('\n')}`).join('\n\n')}
        </pre>
      </div>

      {/* Platform cards */}
      <div className="space-y-3">
        {PLATFORMS.map(p => {
          const isConfigured = configStatus[p.key] === true;
          const isExpanded = expanded[p.key];
          const ping = pingResults[p.key];

          return (
            <div key={p.key} className={`card overflow-hidden border ${p.border}`}>
              {/* Header row */}
              <div className="flex items-center">
                <button
                  className="flex-1 flex items-center justify-between px-5 py-4 hover:bg-white/2 transition-colors"
                  onClick={() => setExpanded(prev => ({ ...prev, [p.key]: !prev[p.key] }))}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{p.emoji}</span>
                    <div className="text-left">
                      <p className={`text-sm font-semibold ${p.color}`}>{p.name}</p>
                      <p className="text-xs text-gray-500">{p.approxTime} setup</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${DIFFICULTY_COLOR[p.difficulty]}`}>{p.difficulty}</span>
                    {isConfigured
                      ? <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> Configured</span>
                      : <span className="flex items-center gap-1 text-xs text-gray-500"><XCircle className="w-3.5 h-3.5" /> Not configured</span>
                    }
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </div>
                </button>
                {/* Live ping button */}
                {isConfigured && (
                  <div className="px-4 flex items-center gap-2 shrink-0">
                    {ping && !ping.loading && (
                      <span className={`text-xs flex items-center gap-1 ${ping.ok ? 'text-emerald-400' : 'text-red-400'}`}
                        title={ping.detail || ping.error}>
                        {ping.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {ping.latency_ms}ms
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePing(p.key); }}
                      className="btn-secondary btn-sm text-xs flex items-center gap-1"
                      disabled={ping?.loading}
                      title="Test live credentials"
                    >
                      {ping?.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                      Test
                    </button>
                  </div>
                )}
              </div>

              {/* Expanded body */}
              {isExpanded && (
                <div className="border-t border-surface-border px-5 py-5 space-y-5">

                  {/* Live ping result detail */}
                  {ping && !ping.loading && (
                    <div className={`text-xs rounded-lg px-3 py-2 border flex items-start gap-2 ${ping.ok
                      ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                      : 'bg-red-500/5 border-red-500/20 text-red-300'}`}>
                      {ping.ok ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                      <div>
                        <span className="font-medium">{ping.ok ? 'Live test passed' : 'Live test failed'}</span>
                        {' · '}{ping.detail || ping.error}
                        {' · '}<span className="text-gray-500">{ping.latency_ms}ms response time</span>
                      </div>
                    </div>
                  )}

                  {/* Note */}
                  {p.notes && (
                    <div className="text-xs text-gray-400 bg-surface-overlay rounded-lg px-3 py-2 border border-surface-border">
                      💡 {p.notes}
                    </div>
                  )}

                  {/* Callback URL */}
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Callback URL — add this to your app settings</p>
                    <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2 border border-surface-border">
                      <code className="text-xs text-emerald-300 font-mono flex-1">{p.callbackUrl}</code>
                      <CopyButton text={p.callbackUrl} />
                    </div>
                  </div>

                  {/* Required .env vars */}
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Add to backend/.env</p>
                    <div className="space-y-1">
                      {p.envVars.map(v => (
                        <div key={v.key} className="flex items-center gap-2 bg-black/30 rounded px-3 py-1.5 border border-surface-border">
                          <code className="text-xs text-amber-300 font-mono flex-1">{v.key}=<span className="text-gray-500">your_{v.label.toLowerCase().replace(/ /g,'_')}_here</span></code>
                          <CopyButton text={`${v.key}=`} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Scopes */}
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Required OAuth scopes / permissions</p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.scopes.map(s => (
                        <code key={s} className="text-xs text-gray-300 bg-surface-overlay border border-surface-border px-2 py-0.5 rounded font-mono">{s}</code>
                      ))}
                    </div>
                  </div>

                  {/* Step by step */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Step-by-step setup</p>
                      <a href={p.devPortal} target="_blank" rel="noopener noreferrer"
                        className="btn-secondary btn-sm text-xs">
                        <ExternalLink className="w-3 h-3" /> Open developer portal
                      </a>
                    </div>
                    <ol className="space-y-3">
                      {p.steps.map((step, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="shrink-0 w-5 h-5 rounded-full bg-surface-overlay border border-surface-border flex items-center justify-center text-[10px] font-bold text-gray-400 mt-0.5">
                            {i + 1}
                          </span>
                          <div>
                            <p className="text-xs font-medium text-gray-200">{step.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{step.detail}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>

                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* After setup */}
      <div className="card p-5 space-y-2">
        <p className="text-sm font-semibold text-white">After adding credentials to .env</p>
        <ol className="space-y-1 text-xs text-gray-400">
          <li>1. <strong className="text-gray-300">Restart the backend</strong> — stop the server (Ctrl+C) and run <code className="text-amber-300 bg-black/30 px-1 rounded">npm run dev</code> again in the backend terminal.</li>
          <li>2. <strong className="text-gray-300">Test the connection</strong> — have an influencer log into the portal and visit <code className="text-amber-300 bg-black/30 px-1 rounded">/portal/connections</code>. The platform button will redirect to the OAuth consent screen.</li>
          <li>3. <strong className="text-gray-300">First sync</strong> — after the influencer approves access, data syncs immediately. Subsequent syncs happen automatically every 72 hours.</li>
          <li>4. <strong className="text-gray-300">Production deployment</strong> — update <code className="text-amber-300 bg-black/30 px-1 rounded">BACKEND_URL</code> in .env to your production domain, and update callback URLs in each platform's developer portal.</li>
        </ol>
      </div>

    </div>
  );
}
