import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { API_URL, BOOK_MAX_MB } from '@/lib/constants';
import { api } from '@/lib/api';
import { COURSE_IDS, seedBooks } from '@/mocks/data';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { CourseEditorPage } from '@/features/courses/pages/CourseEditorPage';

afterEach(() => vi.restoreAllMocks());

function renderBooks() {
  return renderWithProviders(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[`/courses/${COURSE_IDS.beginner}/books`]}><Routes><Route path="/courses/:id" element={<CourseEditorPage />} /><Route path="/courses/:id/books" element={<CourseEditorPage />} /></Routes></MemoryRouter>);
}

describe('course books', () => {
  it('shows seeded course and chapter books from the Books route', async () => {
    renderBooks();
    expect(await screen.findByRole('heading', { name: 'Books', level: 2 })).toBeInTheDocument();
    expect(await screen.findByText('Beginner study guide')).toBeInTheDocument();
    expect(screen.getByText('5', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('Hiragana practice sheets')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Books' })).toHaveAttribute('data-state', 'active');
  });

  it('sends one multipart create request with boolean fields and the file', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const received: Array<{ title: string; canView: string; canDownload: string; status: string; file: FormDataEntryValue | null }> = [];
    vi.spyOn(api, 'post').mockImplementation(async (_url, data) => {
      const form = data as FormData;
      received.push({ title: String(form.get('title')), canView: String(form.get('canView')), canDownload: String(form.get('canDownload')), status: String(form.get('status')), file: form.get('file') });
      return { data: { ...seedBooks[0], id: 'new-book-id', title: String(form.get('title')), fileName: 'new-guide.pdf', canView: form.get('canView') === 'true', canDownload: form.get('canDownload') === 'true', status: 'draft' } } as Awaited<ReturnType<typeof api.post>>;
    });
    renderBooks();
    await user.click(await screen.findByRole('button', { name: 'Add book' }));
    const file = new File(['%PDF-1.7 sample'], 'New guide.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('Choose or drop a PDF'), file);
    await user.clear(screen.getByLabelText(/Title/));
    await user.type(screen.getByLabelText(/Title/), 'New guide');
    await user.click(screen.getByRole('button', { name: 'Save book' }));
    await waitFor(() => expect(received).toHaveLength(1));
    expect(received[0]).toMatchObject({ title: 'New guide', canView: 'true', canDownload: 'false', status: 'draft' });
    expect(received[0].file).toBeInstanceOf(File);
    if (!(received[0].file instanceof File)) throw new Error('The create request did not contain a PDF file.');
    expect(received[0].file.name).toBe('New guide.pdf');
    expect(await screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('blocks publishing when both access modes are off', async () => {
    const user = userEvent.setup();
    const post = vi.fn();
    server.use(http.post(`${API_URL}/admin/courses/${COURSE_IDS.beginner}/books`, () => { post(); return HttpResponse.json(seedBooks[0]); }));
    renderBooks();
    await user.click(await screen.findByRole('button', { name: 'Add book' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.upload(dialog.getByLabelText('Choose or drop a PDF'), new File(['%PDF-1.7'], 'blocked.pdf', { type: 'application/pdf' }));
    await user.click(dialog.getByLabelText('Learners can view'));
    await user.click(dialog.getByLabelText('Published'));
    await user.click(dialog.getByRole('button', { name: 'Save book' }));
    expect(await dialog.findByText('Published books need view or download access.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('rejects non-PDF and oversized files before sending a request', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const request = vi.fn();
    server.use(http.post(`${API_URL}/admin/courses/${COURSE_IDS.beginner}/books`, () => { request(); return HttpResponse.json(seedBooks[0]); }));
    renderBooks();
    await user.click(await screen.findByRole('button', { name: 'Add book' }));
    const input = screen.getByLabelText('Choose or drop a PDF');
    await user.upload(input, new File(['text'], 'notes.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
    expect(await screen.findByText('Choose a PDF file.')).toBeInTheDocument();
    const oversize = new File(['%PDF-1.7'], 'large.pdf', { type: 'application/pdf' });
    Object.defineProperty(oversize, 'size', { value: BOOK_MAX_MB * 1024 * 1024 + 1 });
    await user.upload(input, oversize);
    expect(await screen.findByText(`Choose a PDF that is no larger than ${BOOK_MAX_MB} MB.`)).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it('keeps the chosen file on a friendly create error so it can be retried', async () => {
    const user = userEvent.setup();
    let calls = 0;
    vi.spyOn(api, 'post').mockImplementation(async () => {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error('internal upload detail'), { isAxiosError: true, response: { data: { code: 'BOOK_INVALID_FILE' } } });
      return { data: { ...seedBooks[0], id: 'retry-book', title: 'retry', fileName: 'retry.pdf' } } as Awaited<ReturnType<typeof api.post>>;
    });
    renderBooks();
    await user.click(await screen.findByRole('button', { name: 'Add book' }));
    const file = new File(['%PDF-1.7 sample'], 'retry.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('Choose or drop a PDF'), file);
    await user.click(screen.getByRole('button', { name: 'Save book' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).not.toHaveTextContent('internal upload detail');
    expect(screen.getByText('retry.pdf')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(calls).toBe(2));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('optimistically updates a permission and rolls it back after an API error', async () => {
    const user = userEvent.setup();
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    server.use(http.patch(`${API_URL}/admin/books/${seedBooks[1].id}`, async () => { await pending; return HttpResponse.json({ message: 'failed' }, { status: 500 }); }));
    renderBooks();
    const view = await screen.findByRole('switch', { name: 'Learners can view: Hiragana practice sheets' });
    expect(view).toBeChecked();
    await user.click(view);
    await waitFor(() => expect(view).not.toBeChecked());
    await act(async () => { release?.(); });
    await waitFor(() => expect(view).toBeChecked());
    expect(await screen.findByText('Could not update learner access. Please try again.')).toBeInTheDocument();
  });

  it('restores book order after a reorder API error', async () => {
    const user = userEvent.setup();
    let submitted: string[] = [];
    server.use(http.put(`${API_URL}/admin/chapters/:id/books/reorder`, async ({ request }) => {
      const body = await request.json() as { ids: string[] };
      submitted = body.ids;
      return new HttpResponse(null, { status: 500 });
    }));
    renderBooks();
    await screen.findByText('Hiragana practice sheets');
    const layout = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const row = this.closest('article');
      const index = Array.from(document.querySelectorAll('article')).indexOf(row ?? this);
      return new DOMRect(0, Math.max(0, index) * 100, 800, 80);
    });
    try {
      const first = screen.getByRole('button', { name: 'Reorder Hiragana practice sheets' });
      first.focus();
      await user.keyboard('[Space]');
      await user.keyboard('[ArrowDown]');
      await user.keyboard('[Space]');
      await waitFor(() => expect(submitted).toEqual(['book-hiragana-strokes', 'book-hiragana-chart', 'book-hiragana-draft']));
      expect(await screen.findByText('Could not reorder books. Your changes were restored.')).toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Reorder Hiragana practice sheets' })).toBeInTheDocument());
    } finally { layout.mockRestore(); }
  });

  it('exposes the chapter count link to the Books route with a chapter filter', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[`/courses/${COURSE_IDS.beginner}`]}><Routes><Route path="/courses/:id" element={<CourseEditorPage />} /></Routes></MemoryRouter>);
    await user.click(await screen.findByRole('tab', { name: 'Content' }));
    const booksLink = await screen.findByRole('link', { name: 'Books (3)' });
    expect(booksLink).toHaveAttribute('href', `/courses/${COURSE_IDS.beginner}/books?bookScope=chapter&chapter=2cfcceab-bf49-48c5-a9bb-512bbd530302`);
  });

  it('starts upload progress at zero while a create request is pending', async () => {
    const user = userEvent.setup();
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const originalPost = api.post.bind(api);
    const post = vi.spyOn(api, 'post').mockImplementation(async (url, data, config) => {
      await pending;
      return originalPost(url, data, config);
    });
    try {
      renderBooks();
      await user.click(await screen.findByRole('button', { name: 'Add book' }));
      await user.upload(screen.getByLabelText('Choose or drop a PDF'), new File(['%PDF-1.7'], 'progress.pdf', { type: 'application/pdf' }));
      await user.click(screen.getByRole('button', { name: 'Save book' }));
      expect(await screen.findByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
      await act(async () => { release?.(); });
    } finally {
      post.mockRestore();
    }
  });
});
