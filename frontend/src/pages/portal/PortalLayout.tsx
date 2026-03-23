import { useEffect, useState } from 'react';
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { Megaphone, User, LogOut, Link2, Heart, Trophy, Menu, X } from 'lucide-react';
import { clearPortalToken, portalGetProfile } from '../../utils/api';
import { cn } from '../../utils/helpers';

function CpLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <path d="M16 16 L16 2 A14 14 0 0 1 30 16 Z" fill="white" />
      <path d="M16 16 L30 16 A14 14 0 0 1 16 30 Z" fill="white" opacity="0.5" />
      <path d="M16 16 L16 30 A14 14 0 0 1 2 16 Z" fill="white" />
      <path d="M16 16 L2 16 A14 14 0 0 1 16 2 Z" fill="white" opacity="0.5" />
    </svg>
  );
}

const RTL_KEY = 'falak_rtl';

export default function PortalLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState<Record<string, string> | null>(null);
  const [isRtl, setIsRtl] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    portalGetProfile()
      .then(u => setUser(u))
      .catch(() => navigate('/portal/login'));
  }, [navigate]);

  useEffect(() => {
    const stored = localStorage.getItem(RTL_KEY);
    if (stored === 'true') {
      setIsRtl(true);
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
    }
  }, []);

  const toggleRtl = () => {
    const next = !isRtl;
    setIsRtl(next);
    localStorage.setItem(RTL_KEY, String(next));
    document.documentElement.dir = next ? 'rtl' : 'ltr';
    document.documentElement.lang = next ? 'ar' : 'en';
  };

  const handleLogout = () => {
    clearPortalToken();
    navigate('/portal/login');
  };

  const navItems = [
    { to: '/portal/dashboard',    icon: Megaphone, label: 'My Offers'    },
    { to: '/portal/fan-requests', icon: Heart,     label: 'Fan Requests' },
    { to: '/portal/loyalty',      icon: Trophy,    label: 'Loyalty'      },
    { to: '/portal/connections',  icon: Link2,     label: 'Connections'  },
    { to: '/portal/profile',      icon: User,      label: 'Profile'      },
  ];

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'bg-[#161616] border-r border-surface-border flex flex-col shrink-0 transition-transform duration-200',
        // Desktop: always visible, fixed width
        'md:relative md:translate-x-0 md:w-56',
        // Mobile: fixed overlay, slide in/out
        'fixed inset-y-0 left-0 w-72 z-50',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      )}>
        <div className="h-16 flex items-center px-4 border-b border-surface-border gap-3">
          <CpLogo />
          <div className="flex-1">
            <div className="text-sm font-bold text-white leading-tight">C&amp;P Portal</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Influencer</div>
          </div>
          <button
            className="ml-auto md:hidden p-1 text-gray-500 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => cn('sidebar-link', isActive && 'active')}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-surface-border">
          {user && (
            <p className="text-xs text-gray-400 truncate mb-2">{user.name || user.email}</p>
          )}
          <button
            onClick={toggleRtl}
            className="sidebar-link w-full mb-1 text-gray-400 hover:text-white"
            title={isRtl ? 'Switch to LTR (English)' : 'Switch to RTL (Arabic)'}
          >
            <span className="text-sm">{isRtl ? 'English' : 'عربي'}</span>
          </button>
          <button onClick={handleLogout} className="sidebar-link w-full text-red-400 hover:text-red-300">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <header className="h-16 bg-[#161616] border-b border-surface-border flex items-center px-6 shrink-0 gap-4">
          <button
            onClick={() => setSidebarOpen(p => !p)}
            className="md:hidden p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-base font-semibold text-white flex-1">
            {user ? `Welcome, ${user.name || user.email}` : 'Influencer Portal'}
          </h1>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
