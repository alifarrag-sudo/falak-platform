import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { Star, Search, Heart, User, LogOut } from 'lucide-react';
import { fanLogout } from '../../utils/api';

export default function FanLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('cp_fan_token');
    const userData = localStorage.getItem('cp_fan_user');
    if (!token) { navigate('/fan/login'); return; }
    if (userData) setUser(JSON.parse(userData));
  }, []);

  const handleLogout = () => {
    fanLogout();
    navigate('/fan/login');
  };

  const nav = [
    { to: '/fan/discover', icon: Search, label: 'Discover' },
    { to: '/fan/requests', icon: Heart, label: 'My Requests' },
    { to: '/fan/profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col">
      {/* Top nav */}
      <header className="border-b border-[#2a2a2a] px-6 py-3 flex items-center justify-between sticky top-0 bg-[#0f0f0f] z-10">
        <Link to="/fan/discover" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-500 rounded-lg flex items-center justify-center">
            <Star className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="text-white font-semibold text-sm">Fan Portal</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {nav.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                location.pathname.startsWith(to)
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <span className="text-gray-500 text-sm hidden md:block">{user?.name || user?.email}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-gray-500 hover:text-white text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden md:block">Logout</span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden border-t border-[#2a2a2a] bg-[#161616] px-4 py-2 flex justify-around sticky bottom-0">
        {nav.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
              location.pathname.startsWith(to) ? 'text-purple-400' : 'text-gray-500'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px]">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
