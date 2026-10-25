export const queryKeys = {
  me: ['me'] as const,
  dashboard: {
    summary: ['dashboard', 'summary'] as const,
    revenue: (from: string, to: string) => ['dashboard', 'revenue', from, to] as const,
    topCourses: ['dashboard', 'top-courses'] as const,
  },
  courses: {
    all: ['courses'] as const,
    quizNames: ['courses', 'quiz-names'] as const,
    list: (params: object) => ['courses', 'list', params] as const,
    detail: (id: string) => ['courses', id] as const,
    learners: (id: string) => ['courses', id, 'learners'] as const,
    stats: (id: string) => ['courses', id, 'stats'] as const,
  },
  payments: {
    all: ['payments'] as const,
    list: (params: object) => ['payments', 'list', params] as const,
    detail: (id: string) => ['payments', id] as const,
  },
  promos: ['promo-codes'] as const,
  paymentMethods: ['payment-methods'] as const,
  scheduled: ['scheduled-content'] as const,
  channel: (courseId: string) => ['channel', courseId] as const,
  quizzes: {
    all: ['quizzes'] as const,
    course: (id: string) => ['quizzes', 'course', id] as const,
    list: (params: object) => ['quizzes', 'list', params] as const,
  },
  flashcards: (chapterId: string) => ['flashcards', chapterId] as const,
  audio: (chapterId: string) => ['audio', chapterId] as const,
  books: {
    course: (courseId: string) => ['books', 'course', courseId] as const,
    detail: (id: string) => ['books', id] as const,
  },
} as const;
