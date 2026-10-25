import { z } from 'zod';
import { api } from '@/lib/api';

const scopeSchema = z.enum(['course', 'chapter', 'episode']);
const nonNegativeInteger = z.number().int().nonnegative();
const quizListItemSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  passScore: nonNegativeInteger,
  timeLimitSec: z.number().int().positive().nullable(),
  scope: scopeSchema,
  attachedTo: z.object({
    type: scopeSchema,
    id: z.string().min(1),
    title: z.string(),
    chapterId: z.string().optional(),
    chapterTitle: z.string().optional(),
    chapterPosition: nonNegativeInteger.optional(),
    episodePosition: nonNegativeInteger.optional(),
  }),
  course: z.object({ id: z.string().min(1), title: z.string() }).optional(),
  questionCount: nonNegativeInteger,
  totalPoints: nonNegativeInteger,
  attemptCount: nonNegativeInteger,
  passRate: z.number().min(0).max(100).nullable(),
  averageScore: z.number().nonnegative().nullable(),
}).refine((quiz) => quiz.scope === quiz.attachedTo.type);
const pageSchema = z.object({
  data: z.array(quizListItemSchema),
  meta: z.object({ page: z.number().int().positive(), limit: z.number().int().positive(), total: nonNegativeInteger }),
});
export type QuizScope = z.infer<typeof scopeSchema>;
export type QuizSort = 'newest' | 'title' | 'attempts' | 'passRate';
export type QuizListItem = z.infer<typeof quizListItemSchema>;
export type CourseQuizInput = { title: string; passScore: number; timeLimitSec: number | null } & (
  | { courseId: string; chapterId?: never; episodeId?: never }
  | { chapterId: string; courseId?: never; episodeId?: never }
  | { episodeId: string; courseId?: never; chapterId?: never }
);

export async function getCourseQuizzes(courseId: string): Promise<QuizListItem[]> {
  const quizzes: QuizListItem[] = [];
  for (let page = 1; ; page += 1) {
    const response = await api.get<unknown>(`/admin/courses/${courseId}/quizzes`, { params: { page, limit: 100 } });
    const result = pageSchema.parse(response.data);
    quizzes.push(...result.data);
    if (quizzes.length >= result.meta.total || result.data.length === 0) return quizzes;
  }
}

export async function getQuizzes(params: { courseId?: string; scope?: QuizScope; search?: string; page: number; limit: number; sort?: QuizSort }): Promise<{ data: QuizListItem[]; meta: { page: number; limit: number; total: number } }> {
  const response = await api.get<unknown>('/admin/quizzes', { params });
  return pageSchema.parse(response.data);
}

export async function createCourseQuiz(input: CourseQuizInput): Promise<{ id: string }> {
  const response = await api.post<unknown>('/admin/quizzes', input);
  return z.object({ id: z.string().min(1) }).parse(response.data);
}

export async function deleteCourseQuiz(id: string) {
  return api.delete<unknown>(`/admin/quizzes/${id}`);
}
