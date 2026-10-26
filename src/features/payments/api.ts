import { api } from '@/lib/api';
import type { Page, Payment, PaymentListItem, PaymentMethod } from '@/lib/domain';

export async function getPayments(params: { page: number; limit: number; status?: string; courseId?: string }) {
  const { data } = await api.get<Page<PaymentListItem>>('/admin/payments', { params });
  return data;
}

export async function getPayment(id: string) {
  const { data } = await api.get<Payment>(`/admin/payments/${id}`);
  return data;
}

export async function approvePayment(id: string) {
  const { data } = await api.post<Payment>(`/admin/payments/${id}/approve`);
  return data;
}

export async function rejectPayment(id: string, rejectReason: string) {
  const { data } = await api.post<Payment>(`/admin/payments/${id}/reject`, { rejectReason });
  return data;
}

export async function getPaymentMethods(page = 1, limit = 20) {
  const { data } = await api.get<Page<PaymentMethod>>('/admin/payment-methods', { params: { page, limit } });
  return data;
}

export async function savePaymentMethod(id: string | null, input: Omit<PaymentMethod, 'id'>, qrImage?: File | null) {
  const { type, name, accountName, accountNo, isActive } = input;
  const payload = { type, name, accountName, accountNo, ...(type === 'bank_transfer' ? { qrImageUrl: null } : {}), isActive };
  const upload = type === 'qr' ? qrImage : null;
  const body = upload ? (() => { const form = new FormData(); Object.entries(payload).forEach(([key, value]) => { if (value !== undefined) form.append(key, value === null ? '' : String(value)); }); form.append('file', upload); return form; })() : payload;
  const { data } = id ? await api.patch<PaymentMethod>(`/admin/payment-methods/${id}`, body) : await api.post<PaymentMethod>('/admin/payment-methods', body);
  return data;
}

export async function deletePaymentMethod(id: string) {
  const { data } = await api.delete(`/admin/payment-methods/${id}`);
  return data;
}
