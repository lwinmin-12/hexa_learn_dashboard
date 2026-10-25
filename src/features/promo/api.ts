import { api } from '@/lib/api';
import type { Page, PromoCode } from '@/lib/domain';

export type PromoInput = Omit<PromoCode, 'id' | 'usedCount'>;
export async function getPromoCodes(page = 1, limit = 20) {
  const { data } = await api.get<Page<PromoCode>>('/admin/promo-codes', { params: { page, limit } });
  return data;
}
export async function savePromo(id: string | null, input: PromoInput) {
  const { data } = id ? await api.patch<PromoCode>(`/admin/promo-codes/${id}`, input) : await api.post<PromoCode>('/admin/promo-codes', input);
  return data;
}
export async function deletePromo(id: string) {
  const { data } = await api.delete(`/admin/promo-codes/${id}`);
  return data;
}
