import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LogIn, UserPlus, Eye, EyeOff, Link2, ShieldCheck } from 'lucide-react';
import { portalLogin, portalRegister, portalOAuthStart, portalOAuthComplete } from '../../utils/api';
import axios from 'axios';

function Logo() {
  return (
    <div className="flex flex-col items-center gap-3 mb-8">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center"
           style={{ background: 'linear-gradient(135deg, #d4a017, #e8c97a)' }}>
        <span style={{ fontFamily: 'serif', fontSize: 24, color: '#080808', fontWeight: 700 }}>ف</span>
      </div>
      <div className="text-center">
        <div className="text-xl font-bold text-white tracking-tight">FALAK</div>
        <div className="text-xs text-gray-500 uppercase tracking-widest">Creator Portal</div>
      </div>
    </div>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

export default function PortalLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const [mode, setMode] = useState<'login' | 'register'>(inviteToken ? 'register' : 'login');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'facebook' | 'google' | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<{ name?: string; email?: string; handle?: string } | null>(null);
  const [form, setForm] = useState({
    email: '', password: '', name: '', handle: '', phone: ''
  });

  // Pre-fill form from invite token
  useEffect(() => {
    if (!inviteToken) return;
    axios.get(`/api/portal/invite/${inviteToken}`)
      .then(r => {
        setInviteInfo(r.data);
        setForm(p => ({
          ...p,
          name: r.data.name || p.name,
          email: r.data.email || p.email,
          handle: r.data.handle || p.handle,
        }));
      })
      .catch(() => toast.error('Invite link is invalid or already used'));
  }, [inviteToken]);

  // Handle OAuth callback return (?oauth_token=xxx)
  useEffect(() => {
    const oauthToken = searchParams.get('oauth_token');
    const oauthName  = searchParams.get('oauth_name');
    const isNewUser  = searchParams.get('new_user') === '1';
    const oauthError = searchParams.get('error');

    if (oauthError) {
      const messages: Record<string, string> = {
        oauth_not_configured: 'Social login is not configured yet. Use email/password.',
        oauth_failed: 'Social login failed. Try again or use email/password.',
        invalid_state: 'Session expired. Please try again.',
      };
      toast.error(messages[oauthError] || `OAuth error: ${oauthError}`);
      return;
    }

    if (oauthToken) {
      portalOAuthComplete(oauthToken);
      toast.success(isNewUser
        ? `Welcome, ${oauthName || 'to your portal'}!`
        : `Welcome back, ${oauthName || ''}!`
      );
      navigate('/portal/dashboard', { replace: true });
    }
  }, [searchParams, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) { toast.error('Email and password required'); return; }
    setLoading(true);
    try {
      if (mode === 'login') {
        await portalLogin(form.email, form.password);
        toast.success('Welcome back!');
      } else {
        if (!form.name) { toast.error('Name is required'); setLoading(false); return; }
        await portalRegister({ email: form.email, password: form.password, name: form.name, handle: form.handle, phone: form.phone, invite_token: inviteToken || undefined });
        toast.success('Account created!');
      }
      navigate('/portal/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Something went wrong';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'facebook' | 'google') => {
    setOauthLoading(provider);
    try {
      const { url, configured } = await portalOAuthStart(provider, inviteToken || undefined);
      if (!configured || !url) {
        toast.error(`${provider === 'facebook' ? 'Facebook' : 'Google'} login is not set up yet. Use email/password.`);
        return;
      }
      // Full page redirect to OAuth provider
      window.location.href = url;
    } catch {
      toast.error('Could not start social login. Try email/password.');
    } finally {
      setOauthLoading(null);
    }
  };

  const f = (field: keyof typeof form) => ({
    value: form[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [field]: e.target.value }))
  });

  return (
    <div className="min-h-screen bg-[#111] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Logo />

        {inviteInfo && (
          <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-xl bg-emerald-900/30 border border-emerald-700/50 text-sm text-emerald-300">
            <Link2 className="w-4 h-4 shrink-0" />
            <span>You've been invited by your agency. Create your account to get started.</span>
          </div>
        )}

        <div className="card p-6 space-y-5">
          {/* Tab switcher */}
          <div className="flex rounded-lg border border-surface-border overflow-hidden">
            {(['login', 'register'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  mode === m ? 'bg-white text-[#1c1c1c]' : 'text-gray-400 hover:text-white'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          {/* Social OAuth buttons */}
          <div className="space-y-2">
            <p className="text-xs text-gray-500 text-center">
              {mode === 'register'
                ? 'Verify your identity with social media'
                : 'Sign in with social media'}
            </p>
            <button
              onClick={() => handleOAuth('facebook')}
              disabled={!!oauthLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl bg-[#1877F2] hover:bg-[#1565e8] text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              <FacebookIcon className="w-5 h-5" />
              {oauthLoading === 'facebook' ? 'Redirecting...' : 'Continue with Facebook'}
            </button>
            <button
              onClick={() => handleOAuth('google')}
              disabled={!!oauthLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl bg-white hover:bg-gray-100 text-[#1c1c1c] text-sm font-medium transition-colors disabled:opacity-50"
            >
              <GoogleIcon className="w-5 h-5" />
              {oauthLoading === 'google' ? 'Redirecting...' : 'Continue with Google'}
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-surface-border" />
            <span className="text-xs text-gray-600">or use email</span>
            <div className="flex-1 h-px bg-surface-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <>
                <div>
                  <label className="label">Full Name *</label>
                  <input className="input" placeholder="Your name" autoComplete="name" {...f('name')} />
                </div>
                <div>
                  <label className="label">Instagram / TikTok Handle</label>
                  <input className="input" placeholder="@yourhandle" {...f('handle')} />
                </div>
                <div>
                  <label className="label">Phone / WhatsApp</label>
                  <input className="input" placeholder="+966 5x xxx xxxx" type="tel" {...f('phone')} />
                </div>
              </>
            )}
            <div>
              <label className="label">Email *</label>
              <input className="input" type="email" placeholder="you@example.com" autoComplete="email" {...f('email')} />
            </div>
            <div>
              <label className="label">Password *</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Min 6 characters"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  {...f('password')}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  onClick={() => setShowPass(p => !p)}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Please wait...' : mode === 'login'
                ? <><LogIn className="w-4 h-4" /> Sign In</>
                : <><UserPlus className="w-4 h-4" /> Create Account</>
              }
            </button>
          </form>
        </div>

        {mode === 'register' && (
          <div className="flex items-start gap-2 mt-4 px-2 text-xs text-gray-600">
            <ShieldCheck className="w-4 h-4 shrink-0 text-gray-500 mt-0.5" />
            <span>We use social login to verify you are who you say you are. We never post on your behalf.</span>
          </div>
        )}

        <p className="text-center text-xs text-gray-600 mt-4">
          FALAK Platform · فلك
        </p>
      </div>
    </div>
  );
}
