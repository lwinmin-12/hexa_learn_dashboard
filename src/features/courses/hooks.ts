import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addChapter, deleteCourse, getCourse, getCourses, reorderChapters, reorderEpisodes, saveCourse, type CourseFilters } from './api';
import { queryKeys } from '@/lib/query-keys';

export function useCourses(filters: CourseFilters) {
  return useQuery({ queryKey: queryKeys.courses.list(filters), queryFn: () => getCourses(filters) });
}

export function useCourse(id: string) {
  return useQuery({ queryKey: queryKeys.courses.detail(id), queryFn: () => getCourse(id), enabled: Boolean(id) });
}

export function useSaveCourse(id: string | null) {
  const client = useQueryClient();
  return useMutation({ mutationFn: (input: Parameters<typeof saveCourse>[1]) => saveCourse(id, input), onSuccess: (course) => { void client.invalidateQueries({ queryKey: queryKeys.courses.all }); if (id) void client.setQueryData(queryKeys.courses.detail(id), course); } });
}

export function useDeleteCourse() {
  const client = useQueryClient();
  return useMutation({ mutationFn: deleteCourse, onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.courses.all }) });
}

export function useAddChapter(courseId: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: (title: string) => addChapter(courseId, title), onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.courses.detail(courseId) }) });
}

export function useReorderChapters(courseId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ ids }: { ids: string[] }) => reorderChapters(courseId, ids),
    onMutate: async ({ ids }: { ids: string[] }) => {
      const key = queryKeys.courses.detail(courseId);
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<Awaited<ReturnType<typeof getCourse>>>(key);
      client.setQueryData(key, (current: Awaited<ReturnType<typeof getCourse>> | undefined) => current ? { ...current, chapters: ids.flatMap((id, position) => { const chapter = current.chapters?.find((item) => item.id === id); return chapter ? [{ ...chapter, position }] : []; }) } : current);
      return { previous };
    },
    onError: (_error, _variables, context) => { if (context?.previous) client.setQueryData(queryKeys.courses.detail(courseId), context.previous); },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.courses.detail(courseId) }),
  });
}

export function useReorderEpisodes(courseId: string, chapterId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => reorderEpisodes(chapterId, ids),
    onMutate: async (ids) => {
      const key = queryKeys.courses.detail(courseId);
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<Awaited<ReturnType<typeof getCourse>>>(key);
      client.setQueryData(key, (current: Awaited<ReturnType<typeof getCourse>> | undefined) => current ? { ...current, chapters: (current.chapters ?? []).map((chapter) => chapter.id !== chapterId ? chapter : { ...chapter, episodes: ids.flatMap((id, position) => { const episode = chapter.episodes.find((item) => item.id === id); return episode ? [{ ...episode, position }] : []; }) }) } : current);
      return { previous };
    },
    onError: (_error, _ids, context) => { if (context?.previous) client.setQueryData(queryKeys.courses.detail(courseId), context.previous); },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.courses.detail(courseId) }),
  });
}
