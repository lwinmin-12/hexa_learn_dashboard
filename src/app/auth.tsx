import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setTokenGetter } from '@/lib/api';
import { clearAdminSession, getAdminToken, readAdminSession, startAdminSession } from '@/lib/admin-session';
import { DEMO_ROLE_KEY, USE_MOCKS } from '@/lib/constants';
import type { AdminRole, AdminUser } from '@/lib/domain';
import { messageFromError } from '@/lib/utils';
import { getAdminProfile, loginAdmin } from '@/features/auth/api';
import type { AdminCredentials } from '@/features/auth/types';
import { AuthContext, type AuthContextValue } from './auth-context';

function isAdminRole(role: AdminUser['role']): role is AdminRole {
  return role === 'super_admin' || role === 'page_admin';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const client = useQueryClient();

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const profile = await getAdminProfile();
      if (!isAdminRole(profile.role) || profile.status !== 'active') throw new Error('No admin access');
      setUser(profile);
    } catch (error) {
      clearAdminSession();
      localStorage.removeItem(DEMO_ROLE_KEY);
      client.clear();
      setUser(null);
      setAuthError(messageFromError(error));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    setTokenGetter(async (forceRefresh = false) => {
      if (USE_MOCKS) {
        const role = localStorage.getItem(DEMO_ROLE_KEY);
        return role ? `mock-${role}` : null;
      }
      try {
        return await getAdminToken(forceRefresh);
      } catch (error) {
        client.clear();
        setUser(null);
        setAuthError('Your session expired. Please sign in again.');
        throw error;
      }
    });
    return () => setTokenGetter(async () => null);
  }, [client]);

  useEffect(() => {
    const savedRole = localStorage.getItem(DEMO_ROLE_KEY);
    if (USE_MOCKS ? savedRole === 'super_admin' || savedRole === 'page_admin' : Boolean(readAdminSession())) {
      void loadProfile();
    } else {
      setLoading(false);
    }
  }, [loadProfile]);

  async function signInDemo(role: AdminRole) {
    if (!USE_MOCKS) return;
    client.clear();
    localStorage.setItem(DEMO_ROLE_KEY, role);
    await loadProfile();
  }

  async function signInWithPassword(input: AdminCredentials) {
    setAuthError(null);
    try {
      const session = await loginAdmin(input);
      if (!isAdminRole(session.user.role) || session.user.status !== 'active') throw new Error('No admin access');
      clearAdminSession();
      client.clear();
      startAdminSession(session);
      setUser(session.user);
    } catch (error) {
      setAuthError(messageFromError(error));
    }
  }

  async function logout() {
    clearAdminSession();
    localStorage.removeItem(DEMO_ROLE_KEY);
    client.clear();
    setUser(null);
    setAuthError(null);
  }

  const value: AuthContextValue = {
    user, role: user && isAdminRole(user.role) ? user.role : null,
    isSuper: user?.role === 'super_admin', isPageAdmin: user?.role === 'page_admin',
    loading, authError, signInWithPassword, signInDemo, logout,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
