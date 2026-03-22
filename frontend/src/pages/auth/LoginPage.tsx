/**
 * Unified login page for all roles.
 * On success, redirects to the role's home path.
 * Existing /portal/login is kept as a redirect alias.
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

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
  const { login, homePath } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Email and password required'); return; }
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.display_name || user.email.split('@')[0]}!`);
      // Redirect based on role
      const home = homePath();
      navigate(home, { replace: true });
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
