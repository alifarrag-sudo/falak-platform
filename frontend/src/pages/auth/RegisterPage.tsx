/**
 * Role-specific registration pages.
 * Route param :role = 'influencer' | 'agency' | 'brand' | 'public'
 * On success, redirects to the role's home path.
 */
import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { UserPlus, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { authRegister } from '../../utils/api';
import type { UserRole } from '../../contexts/AuthContext';

const ROLE_CONFIG: Record<string, {
  label: string;
  subtitle: string;
  extraFields: Array<{ key: string; label: string; placeholder: string; type?: string }>;
}> = {
  influencer: {
    label: 'Creator Account',
    subtitle: 'Receive brand offers, manage campaigns, grow your career',
    extraFields: [
      { key: 'display_name', label: 'Full Name *', placeholder: 'Your name' },
      { key: 'handle',       label: 'Primary Handle', placeholder: '@yourhandle' },
    ],
  },
  agency: {
    label: 'Agency Account',
    subtitle: 'Manage influencer campaigns, proposals, and client relationships',
    extraFields: [
      { key: 'display_name', label: 'Your Name *',  placeholder: 'Your name' },
      { key: 'agency_name',  label: 'Agency Name *', placeholder: 'Your Agency' },
    ],
  },
  brand: {
    label: 'Brand Account',
    subtitle: 'Launch direct campaigns, discover creators, track performance',
    extraFields: [
      { key: 'display_name', label: 'Your Name *',  placeholder: 'Your name' },
      { key: 'brand_name',   label: 'Brand Name *', placeholder: 'Your brand' },
    ],
  },
  public: {
    label: 'Fan Account',
    subtitle: 'Book personalised content from your favourite creators',
    extraFields: [
      { key: 'display_name', label: 'Your Name *', placeholder: 'Your name' },
    ],
  },
};

function CpLogo() {
  return (
    <div className="flex flex-col items-center gap-3 mb-8">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <path d="M24 24 L24 3 A21 21 0 0 1 45 24 Z" fill="white" />
        <path d="M24 24 L45 24 A21 21 0 0 1 24 45 Z" fill="white" opacity="0.5" />
        <path d="M24 24 L24 45 A21 21 0 0 1 3 24 Z" fill="white" />
        <path d="M24 24 L3 24 A21 21 0 0 1 24 3 Z" fill="white" opacity="0.5" />
      </svg>
    </div>
  );
}

export default function RegisterPage() {
  const { role = 'influencer' } = useParams<{ role: string }>();
  const navigate = useNavigate();
  const { login, homePath } = useAuth();
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.influencer;

  const [form, setForm] = useState<Record<string, string>>({
    email: '', password: '', display_name: '', agency_name: '', brand_name: '', handle: '',
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.display_name) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (role === 'agency' && !form.agency_name) { toast.error('Agency name is required'); return; }
    if (role === 'brand'  && !form.brand_name)  { toast.error('Brand name is required');  return; }

    setLoading(true);
    try {
      await authRegister({
        email: form.email,
        password: form.password,
        role: role as UserRole,
        display_name: form.display_name,
        agency_name: form.agency_name || undefined,
        brand_name:  form.brand_name  || undefined,
      });
      // Log in automatically
      await login(form.email, form.password);
      toast.success('Account created!');
      navigate(homePath(), { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || 'Registration failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#111] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <CpLogo />
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-white">{config.label}</h1>
          <p className="text-sm text-gray-500 mt-1">{config.subtitle}</p>
        </div>

        <div className="card p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Role-specific fields first */}
            {config.extraFields.map(f => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                <input
                  className="input"
                  type={f.type || 'text'}
                  placeholder={f.placeholder}
                  value={form[f.key] || ''}
                  onChange={set(f.key)}
                  dir="auto"
                />
              </div>
            ))}

            <div>
              <label className="label">Email *</label>
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                value={form.email}
                onChange={set('email')}
              />
            </div>
            <div>
              <label className="label">Password * (min 6 chars)</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Create a password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={set('password')}
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
              {loading ? 'Creating account...' : <><UserPlus className="w-4 h-4" /> Create Account</>}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500 pt-2">
            Already have an account?{' '}
            <Link to="/login" className="text-gray-300 hover:text-white transition-colors">
              Sign in
            </Link>
          </p>
        </div>

        {/* Other role options */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-600 mb-2">Register as a different role?</p>
          <div className="flex gap-3 justify-center">
            {Object.entries(ROLE_CONFIG)
              .filter(([r]) => r !== role)
              .map(([r, c]) => (
                <Link
                  key={r}
                  to={`/register/${r}`}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {c.label}
                </Link>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
