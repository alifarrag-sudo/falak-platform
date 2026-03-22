/**
 * Role-aware sidebar navigation.
 * Nav items change based on the authenticated user's role.
 * Falls back to agency nav if no user is authenticated (backward compat).
 */
import { NavLink } from 'react-router-dom';
import {
  Users, Megaphone, Settings, Compass, FileText,
  LayoutDashboard, ShieldCheck, BarChart2, Globe, Briefcase,
  UserCheck, Star, CreditCard, GitMerge, Kanban, CalendarDays, Handshake,
} from 'lucide-react';
import { cn } from '../../utils/helpers';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../contexts/AuthContext';

type NavItem = { to: string; icon: React.ElementType; label: string };

const NAV_ITEMS: Record<UserRole | 'default', NavItem[]> = {
  platform_admin: [
    { to: '/admin/dashboard',   icon: LayoutDashboard, label: 'Dashboard'    },
    { to: '/admin/analytics',   icon: BarChart2,       label: 'Analytics'    },
    { to: '/admin/users',       icon: Users,           label: 'Users'        },
    { to: '/admin/influencers', icon: Star,            label: 'Influencers'  },
    { to: '/admin/agencies',    icon: Briefcase,       label: 'Agencies'     },
    { to: '/admin/brands',      icon: Globe,           label: 'Brands'       },
    { to: '/admin/payments',    icon: BarChart2,       label: 'Payments'     },
    { to: '/admin/deduplicate', icon: GitMerge,        label: 'Deduplicate'  },
    { to: '/admin/integrations',icon: ShieldCheck,     label: 'Integrations' },
    { to: '/admin/settings',    icon: Settings,        label: 'Settings'     },
  ],
  agency: [
    { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard'   },
    { to: '/influencers', icon: Users,            label: 'Influencers' },
    { to: '/campaigns',   icon: Megaphone,        label: 'Campaigns'   },
    { to: '/pipeline',    icon: Kanban,           label: 'Pipeline'    },
    { to: '/calendar',    icon: CalendarDays,     label: 'Calendar'    },
    { to: '/discover',    icon: Compass,        label: 'Discover'    },
    { to: '/offers',      icon: FileText,       label: 'Offers'      },
    { to: '/deals',       icon: Handshake,      label: 'Deals'       },
    { to: '/payments',    icon: CreditCard,     label: 'Payments'    },
    { to: '/billing',     icon: CreditCard,     label: 'Billing'     },
    { to: '/deduplicate', icon: GitMerge,       label: 'Deduplicate' },
    { to: '/settings',    icon: Settings,       label: 'Settings'    },
  ],
  brand: [
    { to: '/brand/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/brand/discover',  icon: Compass,         label: 'Discover'  },
    { to: '/brand/requests',  icon: FileText,        label: 'Requests'  },
    { to: '/brand/campaigns', icon: Megaphone,       label: 'Campaigns' },
  ],
  talent_manager: [
    { to: '/manager/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/manager/roster',    icon: UserCheck,       label: 'My Roster' },
    { to: '/manager/offers',    icon: FileText,        label: 'Offers'    },
    { to: '/manager/earnings',  icon: BarChart2,       label: 'Earnings'  },
  ],
  influencer: [
    { to: '/portal/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/portal/offers',    icon: FileText,        label: 'Offers'    },
    { to: '/portal/profile',   icon: Users,           label: 'Profile'   },
  ],
  public: [
    { to: '/creators',  icon: Star,     label: 'Browse Creators' },
    { to: '/settings',  icon: Settings, label: 'Settings'        },
  ],
  // Fallback for unauthenticated users (agency dashboard is the default)
  default: [
    { to: '/influencers', icon: Users,     label: 'Influencers' },
    { to: '/campaigns',   icon: Megaphone, label: 'Campaigns'   },
    { to: '/discover',    icon: Compass,   label: 'Discover'    },
    { to: '/offers',      icon: FileText,  label: 'Offers'      },
    { to: '/settings',    icon: Settings,  label: 'Settings'    },
  ],
};

function FalakLogo({ size = 32 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.25,
      background: 'linear-gradient(135deg, #d4a017, #e8c97a)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <span style={{ fontFamily: 'serif', fontSize: size * 0.55, color: '#080808', fontWeight: 700, lineHeight: 1 }}>ف</span>
    </div>
  );
}

export default function Sidebar() {
  const { user } = useAuth();
  const navItems = user
    ? (NAV_ITEMS[user.role] || NAV_ITEMS.default)
    : NAV_ITEMS.default;

  const roleLabel: Record<string, string> = {
    platform_admin: 'Admin',
    agency:         'Agency',
    brand:          'Brand',
    influencer:     'Influencer',
    public:         'Fan',
    talent_manager: 'Manager',
  };

  return (
    <aside className="w-60 bg-[#161616] border-r border-surface-border flex flex-col shrink-0">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <FalakLogo size={30} />
          <div>
            <div className="text-sm font-bold leading-tight tracking-tight" style={{ color: '#e8c97a' }}>FALAK</div>
            <div className="text-[10px] text-gray-500 leading-tight uppercase tracking-widest">
              {user ? roleLabel[user.role] : 'Platform'}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => cn('sidebar-link', isActive && 'active')}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-surface-border">
        <p className="text-[10px] text-gray-600 uppercase tracking-widest">
          {user ? `${user.email.split('@')[0]}` : 'Influencer Platform'}
        </p>
      </div>
    </aside>
  );
}
