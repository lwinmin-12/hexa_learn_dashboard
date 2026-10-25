import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createOption, createQuestion, deleteOption, deleteQuestion, getQuiz, getQuizAttempts, reorderQuestions, saveQuiz, updateOption, updateQuestion, type QuizQuestionInput } from './api';

export function useQuiz(id: string) {
  return useQuery({ queryKey: ['quizzes', id], queryFn: () => getQuiz(id), enabled: Boolean(id) });
}

export function useQuizAttempts(id: string) {
  return useQuery({ queryKey: ['quizzes', id, 'attempts'], queryFn: () => getQuizAttempts(id), enabled: Boolean(id) });
}

export function useSaveQuiz(id: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: (input: Parameters<typeof saveQuiz>[1]) => saveQuiz(id, input), onSuccess: () => client.invalidateQueries({ queryKey: ['quizzes', id] }) });
}

export function useSaveQuestion(quizId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string | null; values: QuizQuestionInput; existingOptionIds: string[] }) => {
      const questionId = input.id;
      if (!questionId) return createQuestion(quizId, input.values);
      await updateQuestion(questionId, { questionText: input.values.questionText, points: input.values.points, explanation: input.values.explanation });
      const operations = input.values.options.map((option, position) => option.id ? updateOption(option.id, { optionText: option.optionText, isCorrect: option.isCorrect, position }) : createOption(questionId, { optionText: option.optionText, isCorrect: option.isCorrect, position }));
      const removed = input.existingOptionIds.filter((id) => !input.values.options.some((option) => option.id === id)).map(deleteOption);
      await Promise.all([...operations, ...removed]);
      return undefined;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['quizzes', quizId] }),
  });
}

export function useDeleteQuestion(quizId: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: deleteQuestion, onSuccess: () => client.invalidateQueries({ queryKey: ['quizzes', quizId] }) });
}

export function useReorderQuestions(quizId: string) {
  const client = useQueryClient();
  const key = ['quizzes', quizId] as const;
  return useMutation({
    mutationFn: (ids: string[]) => reorderQuestions(quizId, ids),
    onMutate: async (ids) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<Awaited<ReturnType<typeof getQuiz>>>(key);
      client.setQueryData(key, (current: Awaited<ReturnType<typeof getQuiz>> | undefined) => current ? { ...current, questions: ids.flatMap((id, position) => { const question = current.questions.find((item) => item.id === id); return question ? [{ ...question, position }] : []; }) } : current);
      return { previous };
    },
    onError: (_error, _ids, context) => { if (context?.previous) client.setQueryData(key, context.previous); },
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  });
}
