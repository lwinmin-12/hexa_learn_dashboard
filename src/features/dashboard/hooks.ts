import { useQuery } from '@tanstack/react-query';
import { getRevenue, getScheduledContent, getSummary, getTopCourses } from './api';
import { queryKeys } from '@/lib/query-keys';

export function useSummary() {
  return useQuery({ queryKey: queryKeys.dashboard.summary, queryFn: getSummary });
}

export function useRevenue(from: string, to: string) {
  return useQuery({ queryKey: queryKeys.dashboard.revenue(from, to), queryFn: () => getRevenue(from, to), enabled: Boolean(from && to) });
}

export function useTopCourses() {
  return useQuery({ queryKey: queryKeys.dashboard.topCourses, queryFn: getTopCourses });
}

export function useScheduledContent(page = 1, limit = 20) {
  return useQuery({ queryKey: [...queryKeys.scheduled, page, limit], queryFn: () => getScheduledContent(page, limit) });
}
