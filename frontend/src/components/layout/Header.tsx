/**
 * App header — shows page title, notification bell, and user menu.
 * Notification bell only shown when unified auth token is present.
 */
import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, User, Settings, Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import NotificationBell from './NotificationBell';

const TITLES: Record<string, string> = {
  '/influencers':     'Influencer Database',
  '/campaigns':       'Campaigns',
  '/pipeline':        'Campaign Pipeline',
  '/calendar':        'Campaign Calendar',
  '/discover':        'Discover',
  '/offers':          'Offers',
  '/deals':           'Deal Tracker',
  '/payments':        'Payments',
  '/billing':         'Billing & Subscription',
  '/deduplicate':     'Deduplicate',
  '/settings':        'Settings',
  '/admin':           'Admin Dashboard',
  '/brand':           'Brand Dashboard',
  '/manager':         'Talent Manager',
};

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  if (!user) return null;

  const roleLabel: Record<string, string> = {
    platform_admin: 'Platform Admin',
    agency:         'Agency',
    brand:          'Brand',
    influencer:     'Influencer',
    public:         'Fan',
    talent_manager: 'Talent Manager',
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-surface-overlay transition-colors"
      >
        <div className="w-7 h-7 rounded-full bg-surface-overlay border border-surface-border flex items-center justify-center text-xs font-semibold text-white">
          {(user.display_name || user.email)[0].toUpperCase()}
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-xs font-medium text-white leading-tight max-w-[120px] truncate">
            {user.display_name || user.email.split('@')[0]}
          </p>
          <p className="text-[10px] text-gray-500 leading-tight capitalize">
            {roleLabel[user.role] || user.role}
          </p>
        </div>
        <ChevronDown className="w-3 h-3 text-gray-500 hidden sm:block" />
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-48 bg-[#1e1e1e] border border-surface-border rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-border">
            <p className="text-xs font-medium text-white truncate">{user.display_name || user.email}</p>
            <p className="text-[10px] text-gray-500 capitalize">{roleLabel[user.role] || user.role}</p>
          </div>
          <div className="py-1">
            <button
              onClick={() => { navigate('/settings'); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-gray-300 hover:bg-surface-overlay hover:text-white transition-colors"
            >
              <Settings className="w-3.5 h-3.5" /> Settings
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-red-400 hover:bg-surface-overlay hover:text-red-300 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const base = '/' + pathname.split('/')[1];
  const title = TITLES[base] || 'Dashboard';

  return (
    <header className="h-16 bg-[#161616] border-b border-surface-border flex items-center px-6 shrink-0 gap-4">
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>
      <h1 className="text-base font-semibold text-white tracking-tight flex-1">{title}</h1>
      <div className="flex items-center gap-2">
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-surface-border text-xs text-gray-500 hover:text-gray-300 hover:border-white/20 transition-colors"
        >
          <span>Search</span>
          <kbd className="text-[10px] bg-surface-overlay px-1.5 py-0.5 rounded border border-surface-border">⌘K</kbd>
        </button>
        {user && <NotificationBell />}
        {user ? <UserMenu /> : null}
      </div>
    </header>
  );
}
