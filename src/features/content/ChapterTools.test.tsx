import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { COURSE_IDS } from '@/mocks/data';
import { api } from '@/lib/api';
import { API_URL } from '@/lib/constants';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import * as contentApi from './api';
import { CourseEditorPage } from '@/features/courses/pages/CourseEditorPage';

function LocationProbe() { return <output data-testid="location">{useLocation().search}</output>; }
async function openTools(mode: 'Flashcards' | 'Audio tracks' = 'Flashcards', entry = `/courses/${COURSE_IDS.contentPreview}`) {
  const user = userEvent.setup();
  const result = renderWithProviders(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[entry]}><LocationProbe /><Routes><Route path="/courses/:id" element={<CourseEditorPage />} /></Routes></MemoryRouter>);
  await user.click(await screen.findByRole('tab', { name: mode }));
  return { ...result, user };
}

function audioFile(name = 'practice.mp3', type = 'audio/mpeg') { return new File(['ID3sample'], name, { type }); }
function stubPreviewUrl() { vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn(() => 'blob:audio-preview'); static revokeObjectURL = vi.fn(); }); }

describe('learning material tabs', () => {
  beforeEach(() => { vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {}); vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  it('stores the chapter in the URL and keeps it across both tabs and reloads', async () => {
    const { user, unmount } = await openTools('Flashcards', `/courses/${COURSE_IDS.beginner}?keep=1`);
    await user.click(screen.getByRole('button', { name: 'Choose a chapter' }));
    await user.click(screen.getByRole('menuitemradio', { name: '2. First conversations' }));
    const search = screen.getByTestId('location').textContent ?? '';
    expect(search).toContain('chapter=75c861e5-45da-4d30-8682-49c533b1bd5e');
    expect(search).toContain('keep=1');
    await user.click(screen.getByRole('tab', { name: 'Audio tracks' }));
    expect(screen.getByRole('button', { name: 'Choose a chapter' })).toHaveTextContent('2. First conversations');
    unmount();
    await openTools('Audio tracks', `/courses/${COURSE_IDS.beginner}${search}`);
    expect(screen.getByRole('button', { name: 'Choose a chapter' })).toHaveTextContent('2. First conversations');
  });

  it('validates the card dialog and saves another without closing', async () => {
    const { user } = await openTools();
    await screen.findByText('12 cards');
    await user.click(screen.getByRole('button', { name: 'Add flashcard' }));
    const dialog = screen.getByRole('dialog');
    const front = within(dialog).getByLabelText('Front');
    const back = within(dialog).getByLabelText('Back');
    expect(front).toHaveFocus();
    expect(front).toHaveAttribute('maxlength', '200');
    expect(back).toHaveAttribute('maxlength', '500');
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.type(front, 'さくら'); await user.type(back, 'cherry blossom');
    const url = within(dialog).getByLabelText(/Audio URL/);
    await user.type(url, 'javascript:bad');
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.clear(url);
    await user.click(within(dialog).getByRole('button', { name: 'Save and add another' }));
    await waitFor(() => expect(front).toHaveValue(''));
    expect(back).toHaveValue('');
    expect(dialog).toBeInTheDocument();
    await waitFor(() => expect(front).toHaveFocus());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add flashcard' })).toHaveFocus());
    expect(await screen.findByText('13 cards')).toBeInTheDocument();
  });

  it('previews CSV errors, imports valid rows, and lists skipped rows', async () => {
    let importedCsv = '';
    vi.spyOn(contentApi, 'importFlashcards').mockImplementation(async (_chapterId, file) => {
      importedCsv = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : ''); reader.onerror = reject; reader.readAsText(file); });
      return { count: 2 };
    });
    const { user } = await openTools();
    await user.click(screen.getByRole('button', { name: 'Import CSV' }));
    const csv = 'front_text,back_text,audio_url\nねこ,cat,\n,missing front,\nいぬ,dog,\n';
    const file = new File([csv], 'cards.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'text', { value: async () => csv });
    await user.upload(screen.getByLabelText('Choose or drop a CSV file'), file);
    expect(await screen.findByText('Preview · First 5 rows')).toBeInTheDocument();
    expect(screen.getAllByText('Line 3: front_text and back_text are required.').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Import 2 cards' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent('2 imported, 1 skipped'));
    expect(importedCsv).toContain('ねこ');
    expect(importedCsv).not.toContain('missing front');
    expect(screen.getByRole('heading', { name: 'Skipped rows' })).toBeInTheDocument();
  });

  it('searches both card faces and asks before deleting a card', async () => {
    let deletes = 0;
    server.use(http.delete(`${API_URL}/admin/flashcards/preview-card-9`, () => { deletes += 1; return HttpResponse.json({ deleted: true }); }));
    const { user } = await openTools();
    await screen.findByText('12 cards');
    await user.type(screen.getByLabelText('Search flashcards'), 'cat');
    expect(screen.getByText('12 cards · 1 matching')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete ねこ' }));
    expect(deletes).toBe(0);
    expect(screen.getByRole('dialog')).toHaveTextContent('Delete this flashcard?');
    await user.click(screen.getByRole('button', { name: 'Delete flashcard' }));
    await waitFor(() => expect(deletes).toBe(1));
  });

  it('rejects non-MP3 and oversized files, then prefills a valid file title', async () => {
    stubPreviewUrl();
    const { user } = await openTools('Audio tracks');
    await screen.findByText('4 tracks');
    await user.click(screen.getByRole('button', { name: 'Upload audio' }));
    const input = screen.getByLabelText('MP3 file, up to 30 MB');
    fireEvent.change(input, { target: { files: [audioFile('wrong.wav', 'audio/wav')] } });
    expect(screen.getByRole('alert')).toHaveTextContent('Choose an MP3 audio file.');
    const large = audioFile('large.mp3'); Object.defineProperty(large, 'size', { value: 30 * 1024 * 1024 + 1 });
    fireEvent.change(input, { target: { files: [large] } });
    expect(screen.getByRole('alert')).toHaveTextContent('30 MB or smaller');
    fireEvent.change(input, { target: { files: [audioFile('daily practice.mp3')] } });
    expect(screen.getByLabelText('Title')).toHaveValue('daily practice');
    expect(screen.getByRole('radio', { name: 'Vocabulary' })).toBeChecked();
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Upload audio' })).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: ' x ' } });
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Upload audio' })).toBeDisabled();
  });

  it('plays one track at a time and does not resume it after filtering', async () => {
    const { user } = await openTools('Audio tracks');
    await user.click(await screen.findByRole('button', { name: 'Play Vocabulary sample A' }));
    expect(screen.getByRole('button', { name: 'Pause Vocabulary sample A' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Play Speaking sample A' }));
    expect(screen.getByRole('button', { name: 'Play Vocabulary sample A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause Speaking sample A' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Vocabulary 2' }));
    await user.click(screen.getByRole('button', { name: 'All 4' }));
    expect(screen.getByRole('button', { name: 'Play Speaking sample A' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Pause / })).not.toBeInTheDocument();
  });

  it('shows upload progress, includes duration, and cancels the request', async () => {
    stubPreviewUrl();
    const post = vi.spyOn(api, 'post').mockImplementationOnce(async (_url, _data, config) => {
      config?.onUploadProgress?.({ loaded: 50, total: 100, bytes: 50, lengthComputable: true, upload: true, progress: 0.5 });
      return new Promise<never>(() => {});
    });
    const { user } = await openTools('Audio tracks');
    await user.click(screen.getByRole('button', { name: 'Upload audio' }));
    fireEvent.change(screen.getByLabelText('MP3 file, up to 30 MB'), { target: { files: [audioFile()] } });
    const preview = screen.getByLabelText('Selected audio preview');
    Object.defineProperty(preview, 'duration', { configurable: true, value: 75 });
    fireEvent.loadedMetadata(preview);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Upload audio' }));
    expect(await screen.findByRole('progressbar', { name: 'Audio upload progress' })).toHaveAttribute('aria-valuenow', '50');
    const body: unknown = post.mock.calls[0][1];
    expect(body).toBeInstanceOf(FormData);
    if (body instanceof FormData) expect(body.get('durationSec')).toBe('75');
    const signal = post.mock.calls[0][2]?.signal;
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(signal?.aborted).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('restores focus to the track menu after cancelling rename', async () => {
    const { user } = await openTools('Audio tracks');
    const menu = await screen.findByRole('button', { name: 'Actions for Vocabulary sample A' });
    await user.click(menu);
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveFocus());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(menu).toHaveFocus());
  });

  it('never shows API implementation notes and confirms track deletion', async () => {
    server.use(http.get(`${API_URL}/admin/chapters/preview-chapter-1/audio`, () => HttpResponse.json({ data: [{ id: 'private', title: 'Listening practice', type: 'vocab', durationSec: null, audioUrl: 'private/storage/key.mp3' }], meta: { page: 1, limit: 100, total: 1 } })));
    const { user } = await openTools('Audio tracks');
    await screen.findByText('Listening practice');
    expect(screen.getByRole('button', { name: 'Preview not available for Listening practice' })).toBeDisabled();
    expect(screen.queryByText(/API response|storage key|Playback URL unavailable/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Actions for Listening practice' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Learners will no longer see it.');
  });

  it('takes a course with no chapters to Content', async () => {
    const { user } = await openTools('Flashcards', `/courses/${COURSE_IDS.conversation}`);
    expect(screen.getByRole('heading', { name: 'Add a chapter first' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Go to Content' }));
    expect(screen.getByRole('tab', { name: 'Content' })).toHaveAttribute('data-state', 'active');
  });
});
