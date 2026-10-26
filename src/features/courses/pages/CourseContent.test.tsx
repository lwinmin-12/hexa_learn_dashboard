import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { API_URL } from '@/lib/constants';
import type { Course } from '@/lib/domain';
import { queryKeys } from '@/lib/query-keys';
import { COURSE_IDS, contentPreviewCourse, seedCourses } from '@/mocks/data';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { CourseEditorPage } from './CourseEditorPage';

async function openContent(id: string = COURSE_IDS.beginner) {
  const user = userEvent.setup();
  const result = renderWithProviders(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[`/courses/${id}`]}><Routes><Route path="/courses/:id" element={<CourseEditorPage />} /></Routes></MemoryRouter>);
  await user.click(await screen.findByRole('tab', { name: 'Content' }));
  return { ...result, user };
}

describe('course content', () => {
  it.each([false, true])('reorders chapters using the keyboard and restores on API failure (%s)', async (fail) => {
    let submitted: string[] = [];
    server.use(http.put(`${API_URL}/admin/courses/${COURSE_IDS.beginner}/chapters/reorder`, async ({ request }) => {
      const body: unknown = await request.json();
      if (typeof body === 'object' && body !== null && 'ids' in body && Array.isArray(body.ids)) submitted = body.ids.filter((id): id is string => typeof id === 'string');
      return fail ? new HttpResponse(null, { status: 500 }) : HttpResponse.json({ success: true });
    }));
    const { user } = await openContent();
    const layout = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const card = this.closest('[data-testid="chapter-card"]');
      const index = Array.from(document.querySelectorAll('[data-testid="chapter-card"]')).indexOf(card ?? this);
      return new DOMRect(0, Math.max(0, index) * 200, 800, 180);
    });
    try {
      const handle = screen.getByRole('button', { name: 'Reorder chapter 1: Hiragana' });
      handle.focus();
      await user.keyboard('[Space]');
      await user.keyboard('[ArrowDown]');
      await user.keyboard('[Space]');
      await waitFor(() => expect(submitted).toEqual((seedCourses[0].chapters ?? []).map((chapter) => chapter.id).reverse()));
      if (fail) {
        expect(await screen.findByText('Could not reorder chapters. Your changes were restored.')).toBeInTheDocument();
        await waitFor(() => expect(within(screen.getAllByTestId('chapter-card')[0]).getByText('Hiragana')).toBeInTheDocument());
      }
    } finally { layout.mockRestore(); }
  });
  it('restores episode order when nested keyboard reordering fails', async () => {
    const chapter = seedCourses[0].chapters?.[0];
    if (!chapter) throw new Error('Fixture chapter missing');
    let submitted = false;
    server.use(http.put(`${API_URL}/admin/chapters/${chapter.id}/episodes/reorder`, () => { submitted = true; return new HttpResponse(null, { status: 500 }); }));
    const { user } = await openContent();
    const layout = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const row = this.closest('[data-episode-id]');
      const index = Array.from(document.querySelectorAll('[data-episode-id]')).indexOf(row ?? this);
      return new DOMRect(0, Math.max(0, index) * 100, 800, 80);
    });
    try {
      screen.getByRole('button', { name: 'Reorder episode 1.1: Meet the vowels' }).focus();
      await user.keyboard('[Space]');
      await user.keyboard('[ArrowDown]');
      await user.keyboard('[Space]');
      await waitFor(() => expect(submitted).toBe(true));
      expect(await screen.findByText('Could not reorder episodes. Your changes were restored.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reorder episode 1.1: Meet the vowels' })).toBeInTheDocument();
    } finally { layout.mockRestore(); }
  });

  it('renames a chapter and deletes it only after confirmation', async () => {
    const { user } = await openContent();
    await user.click(screen.getByRole('button', { name: 'Chapter actions for First conversations' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const field = screen.getByLabelText('Chapter title');
    await user.clear(field);
    await user.type(field, 'Daily conversations{Enter}');
    await screen.findByText('Daily conversations');
    await user.click(screen.getByRole('button', { name: 'Chapter actions for Daily conversations' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Daily conversations');
    expect(screen.getByText('2 chapters, 2 episodes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete chapter' }));
    await waitFor(() => expect(screen.queryByText('Daily conversations')).not.toBeInTheDocument());
    expect(screen.getByText('1 chapter, 2 episodes')).toBeInTheDocument();
  });

  it('changes a chapter status through its actions menu', async () => {
    const { user } = await openContent();
    const chapter = screen.getAllByTestId('chapter-card')[1];
    expect(within(chapter).getByText('draft')).toBeInTheDocument();
    await user.click(within(chapter).getByRole('button', { name: 'Chapter actions for First conversations' }));
    await user.click(screen.getByRole('menuitem', { name: 'Set status to Published' }));
    await waitFor(() => expect(within(chapter).getByText('published')).toBeInTheDocument());
    expect(await screen.findByText('Chapter status updated.')).toBeInTheDocument();
  });

  it('keeps the current chapter status when the status update fails', async () => {
    const chapterId = '75c861e5-45da-4d30-8682-49c533b1bd5e';
    server.use(http.patch(`${API_URL}/admin/chapters/${chapterId}`, () => new HttpResponse(null, { status: 500 })));
    const { user } = await openContent();
    const chapter = screen.getAllByTestId('chapter-card')[1];
    await user.click(within(chapter).getByRole('button', { name: 'Chapter actions for First conversations' }));
    await user.click(screen.getByRole('menuitem', { name: 'Set status to Published' }));
    expect(await screen.findByText('Could not update chapter status. Please try again.')).toBeInTheDocument();
    expect(within(chapter).getByText('draft')).toBeInTheDocument();
  });

  it('creates a chapter from the header dialog with Enter and expands it', async () => {
    const { user } = await openContent();
    expect(screen.queryByPlaceholderText('Add a chapter title')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New chapter' }));
    const dialog = screen.getByRole('dialog');
    const title = within(dialog).getByLabelText('Chapter title');
    expect(title).toHaveAttribute('required');
    expect(title).toHaveAttribute('maxlength', '120');
    await user.type(title, 'Practice together{Enter}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Practice together')).toBeInTheDocument();
    expect(screen.getByText('3 chapters, 2 episodes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Collapse Practice together/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('traps dialog focus and returns it to the create action on Escape', async () => {
    const { user } = await openContent();
    const trigger = screen.getByRole('button', { name: 'New chapter' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(screen.getByLabelText('Chapter title')).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('shows a centered empty state with the same create action', async () => {
    const { user } = await openContent(COURSE_IDS.conversation);
    expect(screen.getByText('No chapters yet')).toBeInTheDocument();
    const actions = screen.getAllByRole('button', { name: 'New chapter' });
    expect(actions).toHaveLength(2);
    await user.click(actions[1]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('numbers chapters and episodes by display order after reordering', async () => {
    const { client } = await openContent(COURSE_IDS.contentPreview);
    expect(screen.getByText('3 chapters, 8 episodes')).toBeInTheDocument();
    const chapters = contentPreviewCourse.chapters ?? [];
    const first = chapters[0];
    const reordered = [chapters[2], chapters[1], { ...first, episodes: [...first.episodes].reverse() }];
    await act(async () => client.setQueryData<Course>(queryKeys.courses.detail(COURSE_IDS.contentPreview), { ...contentPreviewCourse, chapters: reordered }));
    await waitFor(() => expect(within(screen.getAllByTestId('chapter-card')[0]).getByText('Put it into practice')).toBeInTheDocument());
    const cards = screen.getAllByTestId('chapter-card');
    expect(within(cards[0]).getByText('1', { exact: true })).toBeInTheDocument();
    expect(within(cards[0]).getByText('Put it into practice')).toBeInTheDocument();
    expect(within(cards[2]).getByText('3.1', { exact: true })).toBeInTheDocument();
    expect(within(cards[2]).getByText('Read your first words')).toBeInTheDocument();
    expect(screen.getByText('Video: Pending')).toBeInTheDocument();
    expect(screen.getAllByText('Video: No video')).toHaveLength(2);
  });

  it('keeps a collapsed chapter collapsed after switching tabs', async () => {
    const { user } = await openContent();
    await user.click(screen.getByRole('button', { name: /Collapse Hiragana/ }));
    expect(screen.queryByRole('button', { name: 'Meet the vowels' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Details' }));
    await user.click(screen.getByRole('tab', { name: 'Content' }));
    expect(screen.getByRole('button', { name: /Expand Hiragana/ })).toHaveAttribute('aria-expanded', 'false');
  });

  it('creates an episode and opens its existing editor', async () => {
    const { user } = await openContent();
    await user.click(within(screen.getAllByTestId('chapter-card')[0]).getByRole('button', { name: /Add episode to/ }));
    await user.type(screen.getByLabelText('Episode title'), 'A new lesson{Enter}');
    expect(await screen.findByRole('heading', { name: 'A new lesson' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title', { exact: true })).toHaveValue('A new lesson');
  });

  it('shows Retry when the course cannot load and recovers', async () => {
    let failing = true;
    server.use(http.get(`${API_URL}/admin/courses/${COURSE_IDS.beginner}`, () => failing ? new HttpResponse(null, { status: 500 }) : HttpResponse.json(seedCourses[0])));
    const user = userEvent.setup();
    renderWithProviders(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[`/courses/${COURSE_IDS.beginner}`]}><Routes><Route path="/courses/:id" element={<CourseEditorPage />} /></Routes></MemoryRouter>);
    const retry = await screen.findByRole('button', { name: 'Retry' });
    failing = false;
    await user.click(retry);
    expect(await screen.findByRole('tab', { name: 'Content' })).toBeInTheDocument();
  });
});
