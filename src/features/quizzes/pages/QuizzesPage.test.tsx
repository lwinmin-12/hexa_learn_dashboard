import { useLocation, MemoryRouter, Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { setTokenGetter } from '@/lib/api';
import { API_URL } from '@/lib/constants';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { QuizzesPage } from './QuizzesPage';

function CurrentSearch() {
  const location = useLocation();
  return <output data-testid="current-search">{location.search}</output>;
}

function renderPage(initialEntry = '/quizzes') {
  return renderWithProviders(<MemoryRouter initialEntries={[initialEntry]}><CurrentSearch /><Routes><Route path="/quizzes" element={<QuizzesPage />} /><Route path="/quizzes/:id" element={<p>Quiz builder</p>} /><Route path="/courses" element={<p>Courses</p>} /></Routes></MemoryRouter>);
}

describe('global quizzes page', () => {
  it('syncs filters and sort with the URL', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByText('Course progress check');
    expect(screen.getByText(/12\s+quizzes/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Chapter' }));
    expect(screen.getByTestId('current-search')).toHaveTextContent('scope=chapter');
    await user.selectOptions(screen.getByLabelText('Sort quizzes'), 'attempts');
    expect(screen.getByTestId('current-search')).toHaveTextContent('sort=attempts');
    await user.type(screen.getByLabelText('Search quizzes by title'), 'hiragana');
    await waitFor(() => expect(screen.getByTestId('current-search')).toHaveTextContent('search=hiragana'), { timeout: 1000 });
    await user.selectOptions(screen.getByLabelText('Rows per page'), '50');
    expect(screen.getByTestId('current-search')).toHaveTextContent('limit=50');
  });

  it('shows an empty state and a distinct no-match state', async () => {
    server.use(http.get(`${API_URL}/admin/quizzes`, () => HttpResponse.json({ data: [], meta: { page: 1, limit: 20, total: 0 } })));
    const empty = renderPage();
    expect(await screen.findByText('No quizzes yet')).toBeInTheDocument();
    empty.unmount();
    server.resetHandlers();
    renderPage('/quizzes?search=missing');
    expect(await screen.findByText('No quizzes match your filters')).toBeInTheDocument();
  });

  it('limits the page-admin list to assigned courses', async () => {
    setTokenGetter(async () => 'mock-page_admin');
    renderPage();
    expect(await screen.findAllByText('Hiragana review')).toHaveLength(2);
    expect(screen.getByText(/6\s+quizzes/)).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Everyday Japanese Conversation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Content layout preview' })).not.toBeInTheDocument();
  });

  it('falls back to course details when a list item omits its course', async () => {
    server.use(http.get(`${API_URL}/admin/quizzes`, () => HttpResponse.json({ data: [{ id: 'fallback-quiz', title: 'Fallback lesson quiz', passScore: 2, timeLimitSec: null, scope: 'episode', attachedTo: { type: 'episode', id: '1b19ade0-911e-4a5f-8ed9-10d7699ade88', title: 'Meet the vowels', chapterId: '2cfcceab-bf49-48c5-a9bb-512bbd530302', chapterTitle: 'Hiragana' }, questionCount: 1, totalPoints: 2, attemptCount: 0, passRate: null, averageScore: null }], meta: { page: 1, limit: 20, total: 1 } })));
    renderPage();
    await waitFor(() => expect(screen.getAllByText('Japanese for Beginners (JLPT N5)')).toHaveLength(2));
  });

  it('creates a quiz with only the selected parent id', async () => {
    const user = userEvent.setup();
    let sentBody: Record<string, unknown> | undefined;
    server.use(http.post(`${API_URL}/admin/quizzes`, async ({ request }) => {
      sentBody = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ id: 'created-quiz' }, { status: 201 });
    }));
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'New quiz' }));
    await waitFor(() => expect(document.querySelectorAll('#quiz-course-options option')).toHaveLength(5));
    await user.type(screen.getByLabelText('Course'), 'Japanese for Beginners (JLPT N5)');
    await user.type(screen.getByLabelText('Title'), 'New beginner check');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create quiz' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Create quiz' }));
    await screen.findByText('Quiz builder');
    expect(sentBody).toMatchObject({ courseId: expect.any(String) });
    expect(['courseId', 'chapterId', 'episodeId'].filter((key) => key in (sentBody ?? {}))).toHaveLength(1);
  });

  it('requires confirmation before deleting and does not show developer notes', async () => {
    const user = userEvent.setup();
    renderPage();
    const actionMenus = await screen.findAllByRole('button', { name: 'Quiz actions for Course progress check' });
    const actionMenu = actionMenus[0];
    if (!actionMenu) throw new Error('Quiz actions menu is missing');
    await user.click(actionMenu);
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(screen.getByText(/All attempts and results for this quiz will also be deleted/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete quiz' }));
    await waitFor(() => expect(screen.queryByText('Course progress check')).not.toBeInTheDocument());
    expect(screen.queryByText(/developer note|connected api|api would need/i)).not.toBeInTheDocument();
  });
});
