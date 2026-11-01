import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { can, type Permission } from '@shared/config';
import type { User } from '@shared/types';
import { api, setAuthProblemHandler } from '../api/client';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.auth
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setAuthProblemHandler((code) => {
      if (code === 'UNAUTHENTICATED') setUser(null);
      if (code === 'PASSWORD_CHANGE_REQUIRED') setUser((u) => (u ? { ...u, mustChangePassword: true } : u));
    });
    return () => setAuthProblemHandler(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await api.auth.login(email, password);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout().catch(() => undefined);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser, can: (p) => can(user?.role, p) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

// Use inside a page that is already behind RequireAuth.
export function useUser(): User {
  return useAuth().user!;
}

function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>
  );
}

// Route guard: signed-in users only, and anyone with a temporary password is
// sent to the change-password page first.
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  return <Outlet />;
}

// Route guard for pages limited to some roles (see PERMISSIONS).
export function RequirePermission({ permission }: { permission: Permission }) {
  const { can } = useAuth();
  return can(permission) ? <Outlet /> : <Navigate to="/app/dashboard" replace />;
}
