import axios, { type AxiosProgressEvent } from 'axios';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '@/lib/constants';
import type { Episode } from '@/lib/domain';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { EpisodeEditor } from './EpisodeEditor';

const episode: Episode = {
  id: 'episode-editor-test', chapterId: 'chapter-editor-test', title: 'Intro lesson', description: null,
  position: 0, status: 'draft', publishAt: null, playbackUrl: null, videoDurationSec: null,
  videoUploadStatus: null, videoScheduledAt: null,
};

afterEach(() => vi.restoreAllMocks());

describe('episode editor', () => {
  it.each(['ready', 'pending', 'uploading', 'failed'] as const)('only previews stored playback URLs when the video is ready (%s)', (videoUploadStatus) => {
    const playbackUrl = 'https://storage.example.test/preview.mp4?signature=test';
    renderWithProviders(<EpisodeEditor episode={{ ...episode, playbackUrl, videoUploadStatus }} open onOpenChange={vi.fn()} courseId="course-editor-test" />);
    const video = document.querySelector('video');
    if (videoUploadStatus === 'ready') expect(video).toHaveAttribute('src', playbackUrl);
    else expect(video).toBeNull();
  });

  it('saves and closes only after the episode update succeeds', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const patch = vi.fn();
    server.use(http.patch(`${API_URL}/admin/episodes/${episode.id}`, async ({ request }) => {
      patch(await request.json());
      return patch.mock.calls.length === 1
        ? HttpResponse.json({ ...episode, title: 'Saved lesson' })
        : HttpResponse.json({ message: 'failed' }, { status: 500 });
    }));
    const view = renderWithProviders(<EpisodeEditor episode={episode} open onOpenChange={onOpenChange} courseId="course-editor-test" />);

    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Saved lesson');
    await user.click(screen.getByRole('button', { name: 'Save episode' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(patch).toHaveBeenCalledWith(expect.objectContaining({ title: 'Saved lesson' }));

    onOpenChange.mockClear();
    view.unmount();
    renderWithProviders(<EpisodeEditor episode={episode} open onOpenChange={onOpenChange} courseId="course-editor-test" />);
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Will fail');
    await user.click(screen.getByRole('button', { name: 'Save episode' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save episode');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('previews a chosen file at zero progress, uploads on save, and revokes its preview URL on close', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const NativeURL = globalThis.URL;
    class MockURL extends NativeURL {
      static createObjectURL = vi.fn(() => 'blob:lesson-video');
      static revokeObjectURL = vi.fn();
    }
    vi.stubGlobal('URL', MockURL);
    const progress = { loaded: 43, total: 100, bytes: 43, progress: 0.43, upload: true, lengthComputable: true } satisfies AxiosProgressEvent;
    const confirm = vi.fn();
    server.use(
      http.post(`${API_URL}/admin/episodes/${episode.id}/video/upload-url`, () => HttpResponse.json({ uploadUrl: 'https://storage.example.test/video', storageKey: 'video-test' })),
      http.patch(`${API_URL}/admin/episodes/${episode.id}`, () => HttpResponse.json(episode)),
      http.post(`${API_URL}/admin/episodes/${episode.id}/video`, async ({ request }) => { confirm(await request.json()); return HttpResponse.json({ playbackUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4' }); }),
    );
    const upload = vi.spyOn(axios, 'put').mockImplementation(async (_url, _file, config) => { config?.onUploadProgress?.(progress); return {}; });
    const view = renderWithProviders(<EpisodeEditor episode={episode} open onOpenChange={onOpenChange} courseId="course-editor-test" />);
    const input = screen.getByLabelText('Choose or drop a video');
    if (!(input instanceof HTMLInputElement)) throw new Error('Video file control is missing.');
    await user.upload(input, new File(['video'], 'a very long lesson name.mp4', { type: 'video/mp4' }));

    expect(await screen.findByText('Preview (not uploaded yet)')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText('0%')).toBeInTheDocument();
    const video = document.querySelector('video');
    if (!(video instanceof HTMLVideoElement)) throw new Error('Video preview is missing.');
    Object.defineProperty(video, 'duration', { configurable: true, value: 125 });
    fireEvent.loadedMetadata(video);
    await user.click(screen.getByRole('button', { name: 'Save episode' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(upload).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ storageKey: 'video-test', durationSec: 125 }));
    expect(MockURL.createObjectURL).toHaveBeenCalledOnce();
    view.unmount();
    await waitFor(() => expect(MockURL.revokeObjectURL).toHaveBeenCalledWith('blob:lesson-video'));
  });

  it('keeps the selected local hour and minute through save, reload, and clear', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    let saved: Episode = { ...episode, playbackUrl: 'https://storage.example.test/preview.mp4', videoDurationSec: 90, videoUploadStatus: 'ready' };
    const patches: Array<Record<string, unknown>> = [];
    const confirmed: Array<Record<string, unknown>> = [];
    server.use(http.patch(`${API_URL}/admin/episodes/${episode.id}`, async ({ request }) => {
      const body = await request.json() as Record<string, unknown>;
      patches.push(body);
      saved = { ...saved, ...body, videoScheduledAt: body.scheduledAt as string | null } as Episode;
      return HttpResponse.json(saved);
    }), http.post(`${API_URL}/admin/episodes/${episode.id}/video`, async ({ request }) => {
      const body = await request.json() as Record<string, unknown>;
      confirmed.push(body);
      saved = { ...saved, videoScheduledAt: body.scheduledAt as string | null };
      return HttpResponse.json(saved);
    }));
    const view = renderWithProviders(<EpisodeEditor episode={saved} open onOpenChange={onOpenChange} courseId="course-editor-test" />);

    fireEvent.change(screen.getByLabelText('Publish video at (optional) date'), { target: { value: '2099-05-17' } });
    await user.clear(screen.getByLabelText('Publish video at (optional) time'));
    await user.type(screen.getByLabelText('Publish video at (optional) time'), '13:45');
    await user.click(screen.getByRole('button', { name: 'Save episode' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(patches[0]).not.toHaveProperty('publishAt');

    const videoPublish = new Date(2099, 4, 17, 13, 45, 0, 0).toISOString();
    await waitFor(() => expect(patches[0]).toEqual(expect.objectContaining({ scheduledAt: videoPublish })));
    expect(confirmed).toHaveLength(0);
    const readyEpisode: Episode = { ...saved };
    view.unmount();
    renderWithProviders(<EpisodeEditor episode={readyEpisode} open onOpenChange={onOpenChange} courseId="course-editor-test" />);
    expect(screen.getByLabelText('Publish video at (optional) date')).toHaveValue('2099-05-17');
    expect(screen.getByLabelText('Publish video at (optional) time')).toHaveValue('13:45');

    await user.click(screen.getByRole('button', { name: 'Clear Publish video at (optional)' }));
    await user.click(screen.getByRole('button', { name: 'Save episode' }));
    await waitFor(() => expect(patches[1]).toEqual(expect.objectContaining({ scheduledAt: null })));
  });

  it('rejects past schedules and asks before discarding edited details', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const patch = vi.fn();
    server.use(http.patch(`${API_URL}/admin/episodes/${episode.id}`, async () => { patch(); return HttpResponse.json(episode); }));
    renderWithProviders(<EpisodeEditor episode={{ ...episode, playbackUrl: 'https://storage.example.test/preview.mp4', videoDurationSec: 90, videoUploadStatus: 'ready' }} open onOpenChange={onOpenChange} courseId="course-editor-test" />);
    const date = screen.getByLabelText('Publish video at (optional) date');
    fireEvent.change(date, { target: { value: '2000-01-01' } });
    expect(date).toHaveValue('2000-01-01');
    const time = screen.getByLabelText('Publish video at (optional) time');
    await user.clear(time);
    await user.type(time, '13:45');
    expect(time).toHaveValue('13:45');
    await user.click(screen.getByRole('button', { name: 'Save episode' }));
    expect(await screen.findByText('Choose a time in the future.')).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Unsaved title');
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(await screen.findByRole('heading', { name: 'Discard changes?' })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('preserves historical schedules when editing a published episode', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const patch = vi.fn();
    const published: Episode = { ...episode, status: 'published', publishAt: '2000-01-01T06:44:37.123Z', videoScheduledAt: '2000-01-01T06:45:00.000Z', videoUploadStatus: 'ready', playbackUrl: 'https://storage.example.test/video' };
    server.use(http.patch(`${API_URL}/admin/episodes/${episode.id}`, async ({ request }) => {
      patch(await request.json());
      return HttpResponse.json(published);
    }));
    renderWithProviders(<EpisodeEditor episode={published} open onOpenChange={onOpenChange} courseId="course-editor-test" />);
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Revised lesson');
    await user.click(screen.getByRole('button', { name: 'Save episode' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(patch).toHaveBeenCalledWith({ title: 'Revised lesson', description: '', status: 'published' });
  });
});
