import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RequireAuth, RequireRole } from './guards';
import { AppLayout } from './layout';
import { ErrorPage, ForbiddenPage, NotFoundPage } from './system-pages';

export const router = createBrowserRouter([
  {
    path: '/login',
    lazy: async () => ({ Component: (await import('@/features/auth/pages/LoginPage')).LoginPage }),
    errorElement: <ErrorPage />,
  },
  {
    element: <RequireAuth />,
    errorElement: <ErrorPage />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, lazy: async () => ({ Component: (await import('@/features/dashboard/pages/DashboardPage')).DashboardPage }) },
          { path: 'courses', lazy: async () => ({ Component: (await import('@/features/courses/pages/CoursesPage')).CoursesPage }) },
          { path: 'courses/:id', lazy: async () => ({ Component: (await import('@/features/courses/pages/CourseEditorPage')).CourseEditorPage }) },
          { path: 'courses/:id/books', lazy: async () => ({ Component: (await import('@/features/courses/pages/CourseEditorPage')).CourseEditorPage }) },
          { path: 'payments', lazy: async () => ({ Component: (await import('@/features/payments/pages/PaymentsPage')).PaymentsPage }) },
          { path: 'promo-codes', lazy: async () => ({ Component: (await import('@/features/promo/pages/PromoCodesPage')).PromoCodesPage }) },
          { path: 'payment-methods', element: <RequireRole allow={['super_admin']} />, children: [{ index: true, lazy: async () => ({ Component: (await import('@/features/payments/pages/PaymentMethodsPage')).PaymentMethodsPage }) }] },
          { path: 'channels', lazy: async () => ({ Component: (await import('@/features/channels/pages/ChannelsPage')).ChannelsPage }) },
          { path: 'learners', lazy: async () => ({ Component: (await import('@/features/learners/pages/LearnersPage')).LearnersPage }) },
          { path: 'scheduled', lazy: async () => ({ Component: (await import('@/features/dashboard/pages/ScheduledPage')).ScheduledPage }) },
          { path: 'quizzes/:id', lazy: async () => ({ Component: (await import('@/features/quizzes/pages/QuizBuilderPage')).QuizBuilderPage }) },
          { path: 'quizzes', lazy: async () => ({ Component: (await import('@/features/quizzes/pages/QuizzesPage')).QuizzesPage }) },
          { path: 'users', element: <RequireRole allow={['super_admin']} />, children: [{ index: true, lazy: async () => ({ Component: (await import('@/features/users/pages/UsersPage')).UsersPage }) }] },
          { path: '403', element: <ForbiddenPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
