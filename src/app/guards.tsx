import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './auth-context';
import { LoaderCircle } from 'lucide-react';
import type { AdminRole } from '@/lib/domain';

export function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center"><LoaderCircle className="size-6 animate-spin text-accent" aria-label="Loading" /></div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

export function RequireRole({ allow }: { allow: AdminRole[] }) {
  const { role } = useAuth();
  if (!role || !allow.includes(role)) return <Navigate to="/403" replace />;
  return <Outlet />;
}
