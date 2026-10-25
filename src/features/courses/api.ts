import { api } from '@/lib/api';
import type { Chapter, Course, Page } from '@/lib/domain';

export type CourseListItem = Course & { chapterCount?: number; learnerCount?: number };
export type CourseFilters = { page: number; limit: number; status?: string; isPremium?: boolean; search?: string };

export async function getCourses(params: CourseFilters) {
  const { data } = await api.get<Page<CourseListItem>>('/admin/courses', { params });
  return data;
}

export async function getAllCourses() {
  const courses: CourseListItem[] = [];
  for (let page = 1; ; page += 1) {
    const result = await getCourses({ page, limit: 100 });
    courses.push(...result.data);
    if (courses.length >= result.meta.total || result.data.length === 0) return courses;
  }
}

export async function getCourse(id: string) {
  const { data } = await api.get<Course>(`/admin/courses/${id}`);
  return data;
}

export async function saveCourse(id: string | null, input: Partial<Course>) {
  const { data } = id ? await api.patch<Course>(`/admin/courses/${id}`, input) : await api.post<Course>('/admin/courses', input);
  return data;
}

export async function deleteCourse(id: string) {
  const { data } = await api.delete<{ id: string }>(`/admin/courses/${id}`);
  return data;
}

export async function addChapter(courseId: string, title: string) {
  const { data } = await api.post<Chapter>(`/admin/courses/${courseId}/chapters`, { title });
  return data;
}

export async function addEpisode(chapterId: string, title: string) {
  const { data } = await api.post(`/admin/chapters/${chapterId}/episodes`, { title });
  return data;
}

export async function reorderChapters(courseId: string, ids: string[]) {
  const { data } = await api.put(`/admin/courses/${courseId}/chapters/reorder`, { ids });
  return data;
}

export async function reorderEpisodes(chapterId: string, ids: string[]) {
  const { data } = await api.put(`/admin/chapters/${chapterId}/episodes/reorder`, { ids });
  return data;
}

export async function updateEpisode(id: string, input: { title: string; description: string; status: Course['status']; publishAt?: string | null; scheduledAt?: string | null }) {
  const { data } = await api.patch(`/admin/episodes/${id}`, input);
  return data;
}

export type VideoUploadUrl = { uploadUrl: string; storageKey: string; headers?: Record<string, string> };
export async function getEpisodeUploadUrl(id: string, ext: 'mp4' | 'mov' | 'webm') {
  const { data } = await api.post<VideoUploadUrl>(`/admin/episodes/${id}/video/upload-url`, { ext });
  return data;
}

export async function confirmEpisodeVideo(id: string, input: { storageKey: string; durationSec: number; scheduledAt?: string | null }) {
  const { data } = await api.post<{ playbackUrl?: string | null }>(`/admin/episodes/${id}/video`, input);
  return data;
}

export async function removeEpisodeVideo(id: string) {
  const { data } = await api.delete(`/admin/episodes/${id}/video`);
  return data;
}

export async function uploadCourseCover(courseId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<{ coverUrl: string }>(`/admin/courses/${courseId}/cover`, form);
  return data;
}
