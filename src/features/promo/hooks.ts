import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deletePromo, getPromoCodes, savePromo, type PromoInput } from './api';
import { queryKeys } from '@/lib/query-keys';

export function usePromoCodes() {
  return useQuery({ queryKey: queryKeys.promos, queryFn: () => getPromoCodes() });
}

export function useSavePromo() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (input: { id: string | null; values: PromoInput }) => savePromo(input.id, input.values), onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.promos }) });
}

export function useDeletePromo() {
  const client = useQueryClient();
  return useMutation({ mutationFn: deletePromo, onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.promos }) });
}
