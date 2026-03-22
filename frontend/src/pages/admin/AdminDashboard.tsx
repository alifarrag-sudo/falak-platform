/**
 * Platform Admin dashboard — overview of the entire platform.
 */
import { useQuery } from '@tanstack/react-query';
import {
  Users, Star, Briefcase, Globe, DollarSign,
  ShieldCheck, TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: string | number; icon: React.ElementType; color: string;
}) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      // Aggregate from existing endpoints
      const [influencers, offers, users, payments] = await Promise.allSettled([
        api.get('/influencers?limit=1'),
        api.get('/offers/stats/summary'),
        api.get('/auth/users?limit=1'),
        api.get('/payments/summary'),
      ]);

      const offerRows: Array<{ status: string; count: number }> =
        offers.status === 'fulfilled' ? (offers.value.data || []) : [];

      const activeOffers = offerRows
        .filter(r => ['pending', 'sent', 'accepted'].includes(r.status))
        .reduce((sum, r) => sum + (r.count || 0), 0);

      const userCount =
        users.status === 'fulfilled' ? (users.value.data?.total || 0) : 0;

      const totalEarned =
        payments.status === 'fulfilled' ? (payments.value.data?.total_earned || 0) : 0;

      return {
        influencers: influencers.status === 'fulfilled' ? (influencers.value.data?.total || 0) : 0,
        offers:      offerRows,
        activeOffers,
        userCount,
        totalEarned,
      };
    },
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Platform Overview
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Welcome back, {user?.display_name || 'Admin'}. Here's what's happening.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Influencers in DB"  value={stats?.influencers || 0}                                                             icon={Star}      color="bg-purple-900/40 text-purple-400" />
        <StatCard label="Active Offers"       value={stats?.activeOffers ?? '—'}                                                             icon={TrendingUp} color="bg-amber-900/40 text-amber-400" />
        <StatCard label="Platform Users"      value={stats?.userCount ?? '—'}                                                                icon={Users}      color="bg-blue-900/40 text-blue-400" />
        <StatCard label="Commissions (MTD)"   value={stats?.totalEarned != null ? `SAR ${stats.totalEarned.toLocaleString()}` : '—'}        icon={DollarSign} color="bg-emerald-900/40 text-emerald-400" />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { to: '/admin/users',        icon: Users,      label: 'Manage Users',       desc: 'View all accounts by role' },
          { to: '/admin/influencers',  icon: Star,       label: 'Influencer DB',      desc: 'Full influencer database' },
          { to: '/admin/agencies',     icon: Briefcase,  label: 'Agencies',           desc: 'Agency accounts & tiers' },
          { to: '/admin/brands',       icon: Globe,      label: 'Brands',             desc: 'Brand accounts' },
          { to: '/admin/payments',     icon: DollarSign, label: 'Payments',           desc: 'Escrow & commission ledger' },
          { to: '/admin/integrations', icon: ShieldCheck,label: 'Integrations',       desc: 'OAuth & API setup guide' },
        ].map(({ to, icon: Icon, label, desc }) => (
          <Link
            key={to}
            to={to}
            className="card p-4 hover:bg-surface-overlay transition-colors group flex items-start gap-3"
          >
            <div className="w-8 h-8 rounded-lg bg-surface-overlay border border-surface-border flex items-center justify-center text-gray-400 group-hover:text-white shrink-0 transition-colors">
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">{label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
            </div>
          </Link>
        ))}
      </div>

    </div>
  );
}
