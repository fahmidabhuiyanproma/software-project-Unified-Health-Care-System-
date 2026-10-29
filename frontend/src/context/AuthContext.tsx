import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AUTH_EXPIRED_EVENT, apiRequest } from '../lib/api';

export type Role = 'patient' | 'doctor' | 'hospital' | 'lab' | 'pharmacy' | 'admin';

export interface AuthUser {
  id: number;
  name: string;
  email: string | null;
  phone: string;
  role: Role;
  avatar: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** Still checking GET /api/me on boot — render nothing/a loader until this clears. */
  loading: boolean;
  login: (identifier: string, password: string) => Promise<{ ok: true; user: AuthUser } | { ok: false; message: string }>;
  logout: () => Promise<void>;
  /** Merge fresh fields (name/avatar) into the cached user after a profile edit, without a round-trip. */
  updateUser: (partial: Partial<AuthUser>) => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const result = await apiRequest<{ user: AuthUser }>('get', '/api/me');
    setUser(result.ok ? result.data.user : null);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    const onExpired = () => {
      setUser((prev) => {
        if (!prev) return prev;
        window.location.href = '/auth/login?expired=1';
        return null;
      });
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const result = await apiRequest<{ user: AuthUser }>('post', '/api/login', { identifier, password });
    if (result.ok) {
      setUser(result.data.user);
      return { ok: true as const, user: result.data.user };
    }
    return { ok: false as const, message: result.data.message ?? 'Unable to sign in. Please try again.' };
  }, []);

  const logout = useCallback(async () => {
    await apiRequest('post', '/api/logout');
    setUser(null);
  }, []);

  const updateUser = useCallback((partial: Partial<AuthUser>) => {
    setUser((prev) => (prev ? { ...prev, ...partial } : prev));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
