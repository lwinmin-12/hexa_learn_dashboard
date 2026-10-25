import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { API_URL } from '@/lib/constants';
import { queryKeys } from '@/lib/query-keys';
import { COURSE_IDS, seedCourses } from '@/mocks/data';
import { server } from '@/test/server';
import { useReorderChapters } from './hooks';

describe('chapter reorder', () => {
  it('restores the previous order if the API rejects the reorder', async () => {
    const course = structuredClone(seedCourses[0]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const key = queryKeys.courses.detail(COURSE_IDS.beginner);
    client.setQueryData(key, course);
    server.use(http.put(`${API_URL}/admin/courses/${COURSE_IDS.beginner}/chapters/reorder`, () => HttpResponse.error()));
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useReorderChapters(COURSE_IDS.beginner), { wrapper });
    const reorderedIds = [...(course.chapters ?? [])].reverse().map((chapter) => chapter.id);

    await expect(result.current.mutateAsync({ ids: reorderedIds })).rejects.toThrow();
    await waitFor(() => expect(client.getQueryData<typeof course>(key)?.chapters?.map((chapter) => chapter.id)).toEqual(course.chapters?.map((chapter) => chapter.id)));
  });
});
