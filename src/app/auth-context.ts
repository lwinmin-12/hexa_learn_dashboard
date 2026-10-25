import { createContext, useContext } from 'react';
import type { AdminRole, AdminUser } from '@/lib/domain';
import type { AdminCredentials } from '@/features/auth/types';

export type AuthContextValue = {
  user: AdminUser | null;
  role: AdminRole | null;
  isSuper: boolean;
  isPageAdmin: boolean;
  loading: boolean;
  authError: string | null;
  signInWithPassword: (input: AdminCredentials) => Promise<void>;
  signInDemo: (role: AdminRole) => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
