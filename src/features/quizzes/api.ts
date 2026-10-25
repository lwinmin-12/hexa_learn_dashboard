import { api } from '@/lib/api';
import type { Page } from '@/lib/domain';

export type Quiz = { id: string; title: string; passScore: number; timeLimitSec: number | null; courseId?: string | null; chapterId?: string | null; episodeId?: string | null; questions: { id: string; questionText: string; position: number; points: number; explanation: string | null; options: { id: string; optionText: string; isCorrect: boolean; position: number }[] }[] };
export type QuizQuestionInput = { questionText: string; points: number; explanation: string; options: { id?: string; optionText: string; isCorrect: boolean }[] };
export async function getQuiz(id: string) {
  const { data } = await api.get<Quiz>(`/admin/quizzes/${id}`);
  return data;
}
export async function getQuizAttempts(id: string) {
  const { data } = await api.get<Page<{ id: string; user: { displayName: string }; score: number; passed: boolean; submittedAt: string | null }> & { stats: { averageScore: number | null; passRate: number } }>(`/admin/quizzes/${id}/attempts`);
  return data;
}
export async function saveQuiz(id: string, input: Partial<Pick<Quiz, 'title' | 'passScore' | 'timeLimitSec'>>) {
  const { data } = await api.patch<Quiz>(`/admin/quizzes/${id}`, input);
  return data;
}

export async function createQuestion(quizId: string, input: QuizQuestionInput) {
  const { data } = await api.post(`/admin/quizzes/${quizId}/questions`, { ...input, options: input.options.map(({ optionText, isCorrect }, position) => ({ optionText, isCorrect, position })) });
  return data;
}

export async function updateQuestion(id: string, input: Omit<QuizQuestionInput, 'options'>) {
  const { data } = await api.patch(`/admin/questions/${id}`, input);
  return data;
}

export async function createOption(questionId: string, option: { optionText: string; isCorrect: boolean; position: number }) {
  const { data } = await api.post(`/admin/questions/${questionId}/options`, option);
  return data;
}

export async function updateOption(id: string, option: { optionText: string; isCorrect: boolean; position: number }) {
  const { data } = await api.patch(`/admin/options/${id}`, option);
  return data;
}

export async function deleteOption(id: string) {
  const { data } = await api.delete(`/admin/options/${id}`);
  return data;
}

export async function deleteQuestion(id: string) {
  const { data } = await api.delete(`/admin/questions/${id}`);
  return data;
}

export async function reorderQuestions(quizId: string, ids: string[]) {
  const { data } = await api.put(`/admin/quizzes/${quizId}/questions/reorder`, { ids });
  return data;
}
