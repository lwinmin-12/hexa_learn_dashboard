import { api } from '@/lib/api';
import { AdminSessionSchema, AdminUserSchema, type AdminCredentials } from './types';

export async function loginAdmin(input: AdminCredentials) {
  const { data } = await api.post<unknown>('/admin/auth/login', input);
  return AdminSessionSchema.parse(data);
}

export async function refreshAdminSession(refreshToken: string) {
  const { data } = await api.post<unknown>('/admin/auth/refresh', { refreshToken });
  return AdminSessionSchema.parse(data);
}

export async function getAdminProfile() {
  const { data } = await api.get<unknown>('/me');
  return AdminUserSchema.parse(data);
}
