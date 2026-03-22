/**
 * BrandLayout — sidebar layout for the Brand portal.
 * Nav: Dashboard, Browse Influencers, My Campaigns, Settings
 * Follows the same dark-theme pattern as PortalLayout.
 */
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Megaphone, Settings, LogOut, Compass, FileText } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../utils/helpers';

function BrandLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="white" fillOpacity="0.1" />
      <path d="M8 10h10a6 6 0 0 1 0 12H8V10Z" fill="white" fillOpacity="0.9" />
      <circle cx="18" cy="16" r="3" fill="white" fillOpacity="0.4" />
    </svg>
  );
}

const navItems = [
  { to: '/brand/dashboard',  icon: LayoutDashboard, label: 'Dashboard'         },
  { to: '/brand/discover',   icon: Compass,         label: 'Discover'          },
  { to: '/brand/requests',   icon: FileText,        label: 'Requests'          },
  { to: '/brand/campaigns',  icon: Megaphone,       label: 'My Campaigns'      },
  { to: '/brand/settings',   icon: Settings,        label: 'Settings'          },
];

export default function BrandLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const brandName = user?.display_name || 'Brand';

  return (
    <div className="flex h-screen bg-[#111] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-[#161616] border-r border-[#2a2a2a] flex flex-col shrink-0">
        {/* Logo / Brand identity */}
        <div className="h-16 flex items-center px-4 border-b border-[#2a2a2a] gap-3">
          <BrandLogo />
          <div>
            <div className="text-sm font-bold text-white leading-tight">Brand Portal</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider truncate max-w-[100px]">
              {brandName}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                )
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-[#2a2a2a] space-y-2">
          {user && (
            <div className="flex items-center gap-2.5 px-1 min-w-0">
              {/* Avatar / initials */}
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white shrink-0">
                {(user.display_name || user.email || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate leading-tight">
                  {user.display_name || brandName}
                </p>
                <p className="text-[10px] text-gray-500 truncate leading-tight">{user.email}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Log out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top header */}
        <header className="h-16 bg-[#161616] border-b border-[#2a2a2a] flex items-center px-6 shrink-0">
          <h1 className="text-base font-semibold text-white">{brandName}</h1>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
