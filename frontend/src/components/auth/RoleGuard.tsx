/**
 * RoleGuard — wraps routes that require authentication and optionally a specific role.
 * Shows loading spinner while auth state resolves.
 * Redirects to /login if unauthenticated.
 * Redirects to /unauthorized if wrong role.
 * Usage:
 *   <RoleGuard roles={['platform_admin']}>
 *     <AdminPage />
 *   </RoleGuard>
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, type UserRole } from '../../contexts/AuthContext';

interface Props {
  roles?: UserRole[];
  children: React.ReactNode;
  redirectTo?: string;
}

export default function RoleGuard({ roles, children, redirectTo = '/login' }: Props) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate(redirectTo, { replace: true });
      return;
    }
    if (roles && roles.length > 0 && !roles.includes(user.role)) {
      navigate('/unauthorized', { replace: true });
    }
  }, [user, isLoading, roles, navigate, redirectTo]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-xs text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;
  if (roles && roles.length > 0 && !roles.includes(user.role)) return null;

  return <>{children}</>;
}
