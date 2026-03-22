/**
 * Unified auth context for all 6 user roles.
 * Wraps the entire app — provides user, token, login, logout, isRole.
 * Token stored in localStorage under 'cp_auth_token'.
 * On mount, validates token against /api/auth/me.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

export type UserRole =
  | 'platform_admin'
  | 'agency'
  | 'brand'
  | 'influencer'
  | 'public'
  | 'talent_manager';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  display_name: string;
  avatar_url?: string;
  linked_influencer_id?: string;
  linked_agency_id?: string;
  linked_brand_id?: string;
  status: string;
  created_at: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  isRole: (...roles: UserRole[]) => boolean;
  /** Returns the default dashboard path for the current user's role */
  homePath: () => string;
}

const TOKEN_KEY = 'cp_auth_token';

const ROLE_HOME: Record<UserRole, string> = {
  platform_admin: '/admin/dashboard',
  agency:         '/influencers',
  brand:          '/brand/dashboard',
  influencer:     '/portal/dashboard',
  public:         '/creators',
  talent_manager: '/manager/dashboard',
};

const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState(true);

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setUser(r.data.user as AuthUser))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      })
      .finally(() => setIsLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const r = await api.post('/auth/login', { email, password });
    const { token: newToken, user: newUser } = r.data as { token: string; user: AuthUser };
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
    return newUser;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const isRole = useCallback((...roles: UserRole[]): boolean => {
    return !!user && roles.includes(user.role);
  }, [user]);

  const homePath = useCallback((): string => {
    return user ? (ROLE_HOME[user.role] || '/') : '/login';
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, isRole, homePath }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export { TOKEN_KEY, ROLE_HOME };
