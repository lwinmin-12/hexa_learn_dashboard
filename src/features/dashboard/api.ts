import { api } from '@/lib/api';
import type { Course, Page } from '@/lib/domain';

export type DashboardSummary = { totalLearners: number; totalCourses: number; totalRevenue: string; pendingPayments: number };
export type RevenuePoint = { date: string; revenue: string };
export type TopCourse = { courseId: string; title: string; enrollmentCount: number; revenue: string };
export type ScheduledItem = { id: string; title: string; type: 'course' | 'episode'; scheduledAt: string | null };

export async function getSummary() {
  const { data } = await api.get<DashboardSummary>('/admin/dashboard/summary');
  return data;
}

export async function getRevenue(from: string, to: string) {
  const { data } = await api.get<{ data: RevenuePoint[] }>('/admin/dashboard/revenue', { params: { from, to } });
  return data.data;
}

export async function getTopCourses() {
  const { data } = await api.get<{ data: TopCourse[] }>('/admin/dashboard/top-courses');
  return data.data;
}

export async function getScheduledContent(page = 1, limit = 20) {
  const { data } = await api.get<Page<ScheduledItem>>('/admin/scheduled-content', { params: { page, limit } });
  return data;
}

export async function getCourseStats(id: string) {
  const { data } = await api.get<{ enrollmentCount: number; completionRate: number; averageProgressPct: string; quizzes: { id: string; title: string; averageScore: number | null; passRate: number }[] }>(`/admin/courses/${id}/stats`);
  return data;
}

export async function getCourseLearners(id: string, page = 1, limit = 20) {
  const { data } = await api.get<Page<{ id: string; user: { id: string; displayName: string; avatarUrl: string | null }; progressPct: number; enrolledAt: string; lastActivityAt: string | null }>>(`/admin/courses/${id}/learners`, { params: { page, limit } });
  return data;
}

export type DashboardCourse = Course;
