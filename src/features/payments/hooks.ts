import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { approvePayment, deletePaymentMethod, getPayment, getPayments, getPaymentMethods, rejectPayment, savePaymentMethod } from './api';
import { queryKeys } from '@/lib/query-keys';

export function usePayments(params: { page: number; limit: number; status?: string; courseId?: string }) {
  return useQuery({ queryKey: queryKeys.payments.list(params), queryFn: () => getPayments(params) });
}

export function usePayment(id: string | null) {
  return useQuery({ queryKey: queryKeys.payments.detail(id ?? ''), queryFn: () => getPayment(id ?? ''), enabled: Boolean(id) });
}

export function useReviewPayment() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (input: { id: string; action: 'approve' } | { id: string; action: 'reject'; rejectReason: string }) => input.action === 'approve' ? approvePayment(input.id) : rejectPayment(input.id, input.rejectReason), onSuccess: () => { void client.invalidateQueries({ queryKey: queryKeys.payments.all }); void client.invalidateQueries({ queryKey: queryKeys.dashboard.summary }); } });
}

export function usePaymentMethods() {
  return useQuery({ queryKey: queryKeys.paymentMethods, queryFn: () => getPaymentMethods() });
}

export function useSavePaymentMethod() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (input: { id: string | null; values: Parameters<typeof savePaymentMethod>[1]; qrImage?: File | null }) => savePaymentMethod(input.id, input.values, input.qrImage), onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.paymentMethods }) });
}

export function useDeletePaymentMethod() {
  const client = useQueryClient();
  return useMutation({ mutationFn: deletePaymentMethod, onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.paymentMethods }) });
}
