/**
 * Unified login page for all roles.
 * On success, redirects to the role's home path.
 * Existing /portal/login is kept as a redirect alias.
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { portalLogin, fanLogin } from '../../utils/api';

type DemoAccount = {
  label: string; emoji: string; desc: string;
  type: 'main' | 'portal' | 'fan';
  email: string; password: string; path: string;
};

const DEMO_ACCOUNTS: DemoAccount[] = [
  { label: 'Admin',           emoji: '⚙️', desc: 'Platform control',  type: 'main',   email: 'admin@demo.falak.io',   password: 'Falak@Demo2026', path: '/admin/dashboard' },
  { label: 'Agency',          emoji: '🏢', desc: 'Manage campaigns',  type: 'main',   email: 'agency@demo.falak.io',  password: 'Falak@Demo2026', path: '/influencers' },
  { label: 'Content Creator', emoji: '🎬', desc: 'Creator portal',    type: 'portal', email: 'creator@demo.falak.io', password: 'Falak@Demo2026', path: '/portal/dashboard' },
  { label: 'Fan',             emoji: '⭐', desc: 'Fan marketplace',   type: 'fan',    email: 'fan@demo.falak.io',     password: 'Falak@Demo2026', path: '/fan/discover' },
];

function FalakLogo() {
  return (
    <div className="flex flex-col items-center gap-3 mb-8">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center"
           style={{ background: 'linear-gradient(135deg, #d4a017, #e8c97a)' }}>
        <span style={{ fontFamily: 'serif', fontSize: 24, color: '#080808', fontWeight: 700 }}>ف</span>
      </div>
      <div className="text-center">
        <div className="text-xl font-bold text-white tracking-tight">FALAK</div>
        <div className="text-xs text-gray-500 uppercase tracking-widest">Influencer Platform</div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, logout, homePath } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedDemo, setSelectedDemo] = useState<DemoAccount | null>(null);

  // Clicking a demo card pre-fills credentials so user can review then press Sign In
  const handleDemoSelect = (account: DemoAccount) => {
    logout();
    setEmail(account.email);
    setPassword(account.password);
    setSelectedDemo(account);
    setShowPass(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Email and password required'); return; }
    setLoading(true);
    try {
      if (selectedDemo?.type === 'portal') {
        await portalLogin(email, password);
        toast.success(`Welcome to the Creator Portal!`);
        navigate(selectedDemo.path, { replace: true });
      } else if (selectedDemo?.type === 'fan') {
        await fanLogin(email, password);
        toast.success(`Welcome to the Fan Marketplace!`);
        navigate(selectedDemo.path, { replace: true });
      } else {
        const u = await login(email, password);
        toast.success(`Welcome back, ${u.display_name || u.email.split('@')[0]}!`);
        navigate(homePath(), { replace: true });
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || 'Invalid email or password';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#111] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <FalakLogo />
        <div className="card p-6 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
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
              {loading ? 'Signing in...' : <><LogIn className="w-4 h-4" /> Sign In</>}
            </button>
            <div className="text-right">
              <Link to="/forgot-password" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                Forgot password?
              </Link>
            </div>
          </form>

          {/* Demo quick access */}
          <div className="border-t border-surface-border pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <p className="text-xs text-gray-400 font-medium">Demo Access — try any role instantly</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map(acc => {
                const isSelected = selectedDemo?.label === acc.label;
                return (
                  <button
                    key={acc.label}
                    onClick={() => handleDemoSelect(acc)}
                    disabled={loading}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-left disabled:opacity-50 ${
                      isSelected
                        ? 'bg-white/10 border-white/40 ring-1 ring-white/20'
                        : 'bg-surface-overlay border-surface-border hover:border-white/20 hover:bg-surface-subtle'
                    }`}
                  >
                    <span className="text-base leading-none">{acc.emoji}</span>
                    <div>
                      <p className="text-xs font-medium text-white">{acc.label}</p>
                      <p className="text-[10px] text-gray-500">{acc.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-surface-border pt-4 text-center space-y-2">
            <p className="text-xs text-gray-500">Don't have an account?</p>
            <div className="flex gap-2 justify-center flex-wrap">
              <Link to="/register/influencer" className="text-xs text-gray-400 hover:text-white transition-colors">
                Join as Influencer
              </Link>
              <span className="text-gray-600">·</span>
              <Link to="/register/agency" className="text-xs text-gray-400 hover:text-white transition-colors">
                Agency Account
              </Link>
              <span className="text-gray-600">·</span>
              <Link to="/register/brand" className="text-xs text-gray-400 hover:text-white transition-colors">
                Brand Account
              </Link>
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-gray-600 mt-4">
          FALAK Platform · فلك
        </p>
      </div>
    </div>
  );
}
