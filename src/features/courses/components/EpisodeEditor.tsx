import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import axios from 'axios';
import { format } from 'date-fns';
import { z } from 'zod';
import { CalendarDays, CheckCircle2, CircleAlert, Clock3, FileVideo2, LoaderCircle, Save, Trash2, Upload, Video, X } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FileDropzone } from '@/features/content/LearningToolsShared';
import { useToast } from '@/app/toast-context';
import type { Course, Episode } from '@/lib/domain';
import { queryKeys } from '@/lib/query-keys';
import { useQueryClient } from '@tanstack/react-query';
import { confirmEpisodeVideo, getCourse, getEpisodeUploadUrl, removeEpisodeVideo, updateEpisode } from '../api';

const MAX_VIDEO_SIZE_BYTES = 2 * 1024 ** 3;
const accepts = '.mp4,.mov,.webm,video/mp4,video/quicktime,video/webm';
const scheduledDateSchema = z.date().nullable();
const editorSchema = z.object({
  title: z.string().trim().min(1, 'Enter a lesson title.').max(200, 'Titles must be 200 characters or fewer.'),
  status: z.enum(['draft', 'scheduled', 'published']),
  publishAt: scheduledDateSchema,
  videoScheduledAt: scheduledDateSchema,
  hasVideo: z.boolean(),
  publishAtChanged: z.boolean(),
  videoScheduledAtChanged: z.boolean(),
}).superRefine((value, context) => {
  const minimumTime = Date.now() - 60_000;
  if (value.status === 'scheduled' && !value.publishAt) context.addIssue({ code: 'custom', path: ['publishAt'], message: 'Choose a publish time.' });
  for (const field of ['publishAt', 'videoScheduledAt'] as const) {
    const date = value[field];
    const changed = field === 'publishAt' ? value.publishAtChanged : value.videoScheduledAtChanged;
    if (changed && date && date.getTime() < minimumTime) context.addIssue({ code: 'custom', path: [field], message: 'Choose a time in the future.' });
  }
  if (value.videoScheduledAt && !value.hasVideo) context.addIssue({ code: 'custom', path: ['videoScheduledAt'], message: 'Choose a video before setting its publish time.' });
});

type EpisodeStatus = Course['status'];
type VideoStage = 'selected' | 'uploading' | 'processing' | 'ready' | 'failed';
type EditorValues = { title: string; description: string; status: EpisodeStatus; publishAt: Date | null; videoScheduledAt: Date | null };
type EditorErrors = Partial<Record<'title' | 'publishAt' | 'videoScheduledAt', string>>;

export function EpisodeEditor({ episode, open, onOpenChange, courseId }: { episode: Episode | null; open: boolean; onOpenChange: (open: boolean) => void; courseId: string }) {
  const client = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<EpisodeStatus>('draft');
  const [publishAt, setPublishAt] = useState<Date | null>(null);
  const [videoScheduledAt, setVideoScheduledAt] = useState<Date | null>(null);
  const [invalidTime, setInvalidTime] = useState({ publish: false, video: false });
  const [errors, setErrors] = useState<EditorErrors>({});
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [stage, setStage] = useState<VideoStage | null>(null);
  const [progress, setProgress] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removedVideo, setRemovedVideo] = useState(false);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const refreshedPlayback = useRef(false);
  const openedFor = useRef<string | null>(null);
  const initial = useRef<EditorValues>({ title: '', description: '', status: 'draft', publishAt: null, videoScheduledAt: null });

  useEffect(() => {
    if (!open || !episode) { openedFor.current = null; return; }
    if (openedFor.current === episode.id) return;
    openedFor.current = episode.id;
    const values = { title: episode.title, description: episode.description ?? '', status: episode.status, publishAt: parseLocalDate(episode.publishAt), videoScheduledAt: parseLocalDate(episode.videoScheduledAt) };
    initial.current = values;
    setTitle(values.title);
    setDescription(values.description);
    setStatus(values.status);
    setPublishAt(values.publishAt);
    setVideoScheduledAt(values.videoScheduledAt);
    setInvalidTime({ publish: false, video: false });
    setErrors({});
    setFile(null);
    setPreviewUrl(null);
    setDurationSec(episode.videoDurationSec);
    setStage(null);
    setProgress(0);
    setVideoError(null);
    setSaveError(null);
    setRemovedVideo(false);
    setPlaybackUrl(episode.videoUploadStatus === 'ready' ? episode.playbackUrl : null);
    refreshedPlayback.current = false;
  }, [episode, open]);

  useEffect(() => {
    if (!open || !file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, open]);

  const updateInvalidTime = useCallback((field: 'publish' | 'video', invalid: boolean) => {
    setInvalidTime((current) => current[field] === invalid ? current : { ...current, [field]: invalid });
  }, []);

  const hasChanges = () => {
    const before = initial.current;
    return title !== before.title || description !== before.description || status !== before.status || dateValue(publishAt) !== dateValue(before.publishAt) || dateValue(videoScheduledAt) !== dateValue(before.videoScheduledAt) || Boolean(file) || invalidTime.publish || invalidTime.video;
  };

  function requestClose() {
    if (saving && !controller.current) return;
    if (hasChanges()) setConfirmDiscard(true);
    else closeDialog();
  }

  function closeDialog() {
    if (controller.current) controller.current.abort();
    onOpenChange(false);
  }

  function chooseFile(nextFile: File) {
    const extension = nextFile.name.split('.').at(-1)?.toLowerCase();
    const expectedType = extension === 'mp4' ? 'video/mp4' : extension === 'mov' ? 'video/quicktime' : extension === 'webm' ? 'video/webm' : null;
    if (!expectedType || (nextFile.type && nextFile.type !== expectedType)) {
      setVideoError('Choose an MP4, MOV or WebM video.');
      return;
    }
    if (nextFile.size > MAX_VIDEO_SIZE_BYTES) {
      setVideoError('Choose a video that is 2 GB or smaller.');
      return;
    }
    setFile(nextFile);
    setDurationSec(null);
    setStage('selected');
    setProgress(0);
    setVideoError(null);
    setErrors((current) => ({ ...current, videoScheduledAt: undefined }));
  }

  function removeSelectedFile() {
    setFile(null);
    setDurationSec(episode?.videoDurationSec ?? null);
    setStage(null);
    setProgress(0);
    setVideoError(null);
  }

  async function uploadSelectedVideo() {
    if (!episode || !file) throw new Error('Choose a video file.');
    const extension = file.name.split('.').at(-1)?.toLowerCase();
    if (extension !== 'mp4' && extension !== 'mov' && extension !== 'webm') throw new Error('Choose an MP4, MOV or WebM video.');
    const duration = videoRef.current?.duration;
    const length = duration && Number.isFinite(duration) ? Math.round(duration) : 0;
    if (length < 1) throw new Error('Wait for the video preview to load before saving.');
    setDurationSec(length);
    const aborter = new AbortController();
    controller.current = aborter;
    setStage('uploading');
    setProgress(0);
    const uploadUrl = await getEpisodeUploadUrl(episode.id, extension);
    await axios.put(uploadUrl.uploadUrl, file, {
      headers: uploadUrl.headers,
      signal: aborter.signal,
      onUploadProgress: (event) => setProgress(event.total ? Math.round((event.loaded / event.total) * 100) : 0),
    });
    setStage('processing');
    setProgress(100);
    const savedVideo = await confirmEpisodeVideo(episode.id, { storageKey: uploadUrl.storageKey, durationSec: length, ...(dateValue(videoScheduledAt) !== dateValue(initial.current.videoScheduledAt) && { scheduledAt: videoScheduledAt?.toISOString() ?? null }) });
    setPlaybackUrl(savedVideo.playbackUrl ?? null);
    setStage('ready');
  }

  async function finishSave() {
    await client.invalidateQueries({ queryKey: queryKeys.courses.detail(courseId) });
    toast('Episode saved.');
    closeDialog();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!episode || saving) return;
    const publishAtChanged = dateValue(publishAt) !== dateValue(initial.current.publishAt) || (status === 'scheduled' && initial.current.status !== 'scheduled');
    const videoScheduledAtChanged = dateValue(videoScheduledAt) !== dateValue(initial.current.videoScheduledAt);
    const valid = editorSchema.safeParse({ title, status, publishAt, videoScheduledAt, publishAtChanged, videoScheduledAtChanged, hasVideo: Boolean(file || (!removedVideo && episode.videoUploadStatus === 'ready')) });
    const nextErrors: EditorErrors = {};
    for (const issue of valid.success ? [] : valid.error.issues) {
      const field = issue.path[0];
      if (field === 'title' || field === 'publishAt' || field === 'videoScheduledAt') nextErrors[field] = issue.message;
    }
    setErrors(nextErrors);
    setSaveError(null);
    if (!valid.success || invalidTime.publish || invalidTime.video) return;

    setSaving(true);
    try {
      try {
        await updateEpisode(episode.id, { title: title.trim(), description, status, ...(publishAtChanged && { publishAt: publishAt?.toISOString() ?? null }), ...(!file && videoScheduledAtChanged && { scheduledAt: videoScheduledAt?.toISOString() ?? null }) });
      } catch {
        setSaveError('Could not save episode. Please try again.');
        return;
      }
      initial.current = { ...initial.current, title: title.trim(), description, status, publishAt };
      try {
        if (file) await uploadSelectedVideo();
      } catch {
        controller.current = null;
        if (!file?.size || stage === 'processing') setVideoError('Could not save the video schedule. Please try again.');
        else { setStage('failed'); setVideoError('Video upload failed. Your lesson details are saved. Retry the upload.'); }
        return;
      }
      controller.current = null;
      await finishSave();
    } finally {
      controller.current = null;
      setSaving(false);
    }
  }

  async function retryVideoSave() {
    if (!episode || saving) return;
    setSaving(true);
    setVideoError(null);
    try {
      if (file) await uploadSelectedVideo();
      controller.current = null;
      await finishSave();
    } catch {
      controller.current = null;
      setStage('failed');
      setVideoError(file ? 'Video upload failed. Your lesson details are saved. Retry the upload.' : 'Could not save the video schedule. Please try again.');
    } finally {
      controller.current = null;
      setSaving(false);
    }
  }

  async function removeVideo() {
    if (!episode) return;
    setRemoving(true);
    try {
      await removeEpisodeVideo(episode.id);
      setRemovedVideo(true);
      setPlaybackUrl(null);
      setVideoScheduledAt(null);
      initial.current = { ...initial.current, videoScheduledAt: null };
      setConfirmRemove(false);
      await client.invalidateQueries({ queryKey: queryKeys.courses.detail(courseId) });
      toast('Video removed.');
    } catch {
      toast('Could not remove the video. Please try again.', 'error');
    } finally { setRemoving(false); }
  }

  async function refreshPlayback() {
    if (!episode || refreshedPlayback.current || previewUrl) return;
    refreshedPlayback.current = true;
    try {
      const course = await client.fetchQuery({ queryKey: queryKeys.courses.detail(courseId), queryFn: () => getCourse(courseId), staleTime: 0 });
      const fresh = course.chapters?.flatMap((chapter) => chapter.episodes).find((item) => item.id === episode.id);
      setPlaybackUrl(fresh?.videoUploadStatus === 'ready' ? fresh.playbackUrl : null);
    } catch { setPlaybackUrl(null); }
  }

  const visibleStatus: VideoStage | 'none' = file ? stage ?? 'selected' : removedVideo ? 'none' : episode?.videoUploadStatus === 'ready' ? 'ready' : episode?.videoUploadStatus === 'failed' ? 'failed' : 'none';
  const videoSource = previewUrl ?? (!removedVideo && episode?.videoUploadStatus === 'ready' ? playbackUrl : null);
  const videoDuration = file ? durationSec : episode?.videoDurationSec ?? durationSec;
  const statusDetails = videoState(visibleStatus);

  return <Dialog.Root open={open} onOpenChange={(next) => { if (next) onOpenChange(true); else requestClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-[2px]" />
      <Dialog.Content aria-describedby="episode-editor-description" className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[calc(100vw-2rem)] max-w-[720px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-xl focus:outline-none dark:border-slate-700 dark:bg-slate-900" style={{ fontFamily: 'Inter, "Hiragino Kaku Gothic ProN", "Noto Sans JP", Meiryo, sans-serif' }}>
        <header className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-4 bg-white px-6 pb-4 pt-5 dark:bg-slate-900">
          <div className="min-w-0"><Dialog.Title className="truncate text-lg font-semibold text-ink dark:text-white">{episode?.title ?? 'Episode'}</Dialog.Title><Dialog.Description id="episode-editor-description" className="mt-1 text-sm text-muted">Edit the lesson and its video.</Dialog.Description></div>
          <button type="button" aria-label="Close dialog" onClick={requestClose} className="rounded-lg p-2 text-muted hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:hover:bg-slate-800"><X className="size-4" /></button>
        </header>
        <form onSubmit={(event) => void save(event)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-5">
            <div className="grid gap-3 sm:grid-cols-2"><div><label className="field-label" htmlFor="episode-title">Title</label><input id="episode-title" maxLength={200} className="field" value={title} disabled={saving} onChange={(event) => { setTitle(event.target.value); setErrors((current) => ({ ...current, title: undefined })); }} />{errors.title && <FieldError>{errors.title}</FieldError>}</div><div><label className="field-label" htmlFor="episode-status">Status</label><select id="episode-status" className="field" value={status} disabled={saving} onChange={(event) => { const value = event.target.value; if (value === 'draft' || value === 'scheduled' || value === 'published') { setStatus(value); if (value !== 'scheduled') setPublishAt(null); } }}><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="published">Published</option></select></div></div>
            <div><label className="field-label" htmlFor="episode-description">Description</label><textarea id="episode-description" rows={2} maxLength={20000} className="field h-auto py-2" value={description} disabled={saving} onChange={(event) => setDescription(event.target.value)} /></div>
            {status === 'scheduled' && <DateTimePicker id="episode-publish" label="Publish episode at" value={publishAt} onChange={setPublishAt} onTimeValidityChange={(invalid) => updateInvalidTime('publish', invalid)} error={errors.publishAt} disabled={saving} />}
            <section aria-label="Video" className="rounded-xl border border-line p-4 dark:border-slate-700">
              <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">Video</h3><p className="mt-1 text-xs text-muted">MP4, MOV or WebM, up to 2 GB.</p></div><StatusChip stage={visibleStatus} label={statusDetails.label} icon={statusDetails.icon} /></div>
              <div className="mt-4 aspect-video overflow-hidden rounded-xl bg-slate-950">
                {videoSource ? <video key={videoSource} ref={videoRef} className="size-full object-contain" src={videoSource} controls playsInline preload="metadata" onLoadedMetadata={(event) => { if (file && Number.isFinite(event.currentTarget.duration)) setDurationSec(Math.round(event.currentTarget.duration)); }} onError={() => void refreshPlayback()}>{episode?.captionsUrl && <track kind="captions" src={episode.captionsUrl} srcLang="en" label="Captions" default />}</video> : <div className="flex size-full items-center justify-center gap-2 text-sm text-slate-300"><Video aria-hidden="true" className="size-5" />Video not available yet</div>}
              </div>
              {previewUrl && <p className="mt-2 text-xs font-medium text-muted">Preview (not uploaded yet)</p>}
              <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                {file && <span className="min-w-0 max-w-full truncate" title={file.name}><FileVideo2 aria-hidden="true" className="mr-1 inline size-3.5" />{file.name}</span>}
                {file && <span>{formatBytes(file.size)}</span>}
                {videoDuration && <span><Clock3 aria-hidden="true" className="mr-1 inline size-3.5" />{formatDuration(videoDuration)}</span>}
                {!file && !removedVideo && episode?.videoUploadStatus === 'ready' && !videoDuration && <span>Duration unavailable</span>}
              </div>
              <div className="mt-4"><FileDropzone label={file ? 'Replace video' : 'Choose or drop a video'} accept={accepts} onFile={chooseFile} disabled={saving} /><div className="mt-2 flex flex-wrap items-center gap-2">{file && <Button type="button" size="sm" disabled={saving} onClick={removeSelectedFile}><X className="size-3.5" />Remove selected video</Button>}{(episode?.videoUploadStatus === 'ready') && !removedVideo && <Button type="button" size="sm" onClick={() => setConfirmRemove(true)} disabled={saving}><Trash2 className="size-3.5" />Remove video</Button>}</div></div>
              {file && <div className="mt-3"><div className="mb-1 flex justify-between text-[11px] text-muted"><span>{progressLabel(stage, progress)}</span><span>{progress}%</span></div><div role="progressbar" aria-label="Video upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${progress}%` }} /></div></div>}
              {videoError && <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300"><span>{videoError}</span><Button type="button" size="sm" disabled={saving} onClick={() => void retryVideoSave()}>{file ? 'Retry upload' : 'Retry'}</Button></div>}
              <div className="mt-4"><DateTimePicker id="video-scheduled-at" label="Publish video at (optional)" value={videoScheduledAt} onChange={setVideoScheduledAt} onTimeValidityChange={(invalid) => updateInvalidTime('video', invalid)} error={errors.videoScheduledAt} disabled={saving} /></div>
            </section>
            {saveError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">{saveError}</p>}
          </div>
          <footer className="sticky bottom-0 z-10 flex shrink-0 justify-end gap-2 border-t border-line bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
            <Button type="button" onClick={requestClose}>{saving && controller.current ? 'Cancel upload' : 'Cancel'}</Button>
            <Button type="submit" variant="primary" disabled={saving}>{saving ? <><LoaderCircle className="size-4 animate-spin" />Saving…</> : <><Save className="size-4" />Save episode</>}</Button>
          </footer>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
    <ConfirmDialog open={confirmRemove} onOpenChange={setConfirmRemove} title="Remove this video?" description="Learners will no longer be able to play this video." confirmLabel="Remove video" destructive busy={removing} onConfirm={() => void removeVideo()} />
    <ConfirmDialog open={confirmDiscard} onOpenChange={setConfirmDiscard} title={controller.current ? 'Cancel this upload?' : 'Discard changes?'} description={controller.current ? 'The upload will stop. Your saved lesson details will stay in place.' : 'Your unsaved lesson and video changes will be lost.'} confirmLabel={controller.current ? 'Stop upload' : 'Discard changes'} destructive onConfirm={() => { setConfirmDiscard(false); closeDialog(); }} />
  </Dialog.Root>;
}

function DateTimePicker({ id, label, value, onChange, onTimeValidityChange, error, disabled }: { id: string; label: string; value: Date | null; onChange: (value: Date | null) => void; onTimeValidityChange: (invalid: boolean) => void; error?: string; disabled: boolean }) {
  const [time, setTime] = useState(value ? format(value, 'HH:mm') : '');
  const timeIsValid = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time);
  useEffect(() => { setTime(value ? format(value, 'HH:mm') : ''); }, [value]);
  function updateFromTime(next: string) {
    setTime(next);
    const valid = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(next);
    onTimeValidityChange(!valid && (next.length > 0 || value !== null));
    if (!valid) return;
    const [hour, minute] = next.split(':').map(Number);
    const base = value ?? nextMinute(new Date());
    const nextDate = new Date(base);
    nextDate.setHours(hour, minute, 0, 0);
    onChange(nextDate);
  }
  function updateFromSelect(part: 'hour' | 'minute', next: number) {
    const base = value ?? nextMinute(new Date());
    const nextDate = new Date(base);
    if (part === 'hour') nextDate.setHours(next, nextDate.getMinutes(), 0, 0);
    else nextDate.setMinutes(next, 0, 0);
    onChange(nextDate);
    const nextTime = format(nextDate, 'HH:mm');
    setTime(nextTime);
    onTimeValidityChange(false);
  }
  function updateFromDate(next: string) {
    if (!next) { onChange(null); onTimeValidityChange(false); return; }
    const [year, month, day] = next.split('-').map(Number);
    const base = value ?? nextMinute(new Date());
    const nextDate = new Date(year, month - 1, day, base.getHours(), base.getMinutes(), 0, 0);
    onChange(nextDate);
    onTimeValidityChange(false);
  }
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offset = value ? new Intl.DateTimeFormat('en', { timeZoneName: 'shortOffset' }).formatToParts(value).find((part) => part.type === 'timeZoneName')?.value : new Intl.DateTimeFormat('en', { timeZoneName: 'shortOffset' }).formatToParts(new Date()).find((part) => part.type === 'timeZoneName')?.value;
  const utcValue = value?.toISOString() ?? 'No time selected';
  const hours = Array.from({ length: 24 }, (_, index) => index);
  const commonMinutes = [0, 15, 30, 45];
  return <div>
    <div className="mb-1.5 flex items-center justify-between gap-2"><label className="field-label mb-0" htmlFor={`${id}-date`}>{label}</label>{value && <Button type="button" size="sm" disabled={disabled} onClick={() => { onChange(null); onTimeValidityChange(false); }}>Clear {label}</Button>}</div>
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_minmax(6rem,0.6fr)]">
      <label className="relative"><span className="sr-only">{label} date</span><CalendarDays aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><input id={`${id}-date`} aria-label={`${label} date`} type="date" className="field pl-9" value={value ? format(value, 'yyyy-MM-dd') : ''} disabled={disabled} onChange={(event) => updateFromDate(event.target.value)} title={`UTC: ${utcValue}`} /></label>
      <label><span className="sr-only">{label} hour</span><select aria-label={`${label} hour`} className="field" value={value ? value.getHours() : ''} disabled={disabled} onChange={(event) => updateFromSelect('hour', Number(event.target.value))}><option value="" disabled>HH</option>{hours.map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, '0')}</option>)}</select></label>
      <label><span className="sr-only">{label} minute</span><select aria-label={`${label} minute`} className="field" value={value ? value.getMinutes() : ''} disabled={disabled} onChange={(event) => updateFromSelect('minute', Number(event.target.value))}><option value="" disabled>MM</option><optgroup label="Quick minutes">{commonMinutes.map((minute) => <option key={minute} value={minute}>{String(minute).padStart(2, '0')}</option>)}</optgroup><optgroup label="Every minute">{Array.from({ length: 60 }, (_, minute) => minute).filter((minute) => !commonMinutes.includes(minute)).map((minute) => <option key={minute} value={minute}>{String(minute).padStart(2, '0')}</option>)}</optgroup></select></label>
      <label><span className="sr-only">{label} time</span><input aria-label={`${label} time`} className="field" type="text" inputMode="numeric" placeholder="HH:mm" maxLength={5} value={time} disabled={disabled} onChange={(event) => updateFromTime(event.target.value)} title={`UTC: ${utcValue}`} /></label>
    </div>
    <p className="mt-1.5 text-[11px] text-muted" title={`UTC: ${utcValue}`}>Local time ({timezone}, {offset}) · 24-hour clock</p>
    {!timeIsValid && (time.length > 0 || value !== null) && <FieldError>Enter time as HH:mm, such as 13:45.</FieldError>}
    {error && <FieldError>{error}</FieldError>}
  </div>;
}

function StatusChip({ stage, label, icon: Icon }: { stage: VideoStage | 'none'; label: string; icon: typeof Video }) {
  const colors = stage === 'ready' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : stage === 'failed' ? 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200' : stage === 'selected' || stage === 'uploading' || stage === 'processing' ? 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
  return <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${colors}`}><Icon aria-hidden="true" className="size-3.5" />{label}</span>;
}

function videoState(stage: VideoStage | 'none') {
  const states = {
    none: { label: 'No video', icon: Video }, selected: { label: 'Selected (not uploaded)', icon: FileVideo2 },
    uploading: { label: 'Uploading', icon: Upload }, processing: { label: 'Processing', icon: LoaderCircle },
    ready: { label: 'Ready', icon: CheckCircle2 }, failed: { label: 'Failed', icon: CircleAlert },
  };
  return states[stage];
}

function progressLabel(stage: VideoStage | null, progress: number) {
  if (stage === 'uploading') return `Uploading ${progress}%`;
  if (stage === 'processing') return 'Processing';
  if (stage === 'ready') return 'Ready';
  if (stage === 'failed') return 'Upload failed';
  return 'Selected · not uploaded';
}

function parseLocalDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateValue(value: Date | null) { return value?.getTime() ?? null; }
function nextMinute(value: Date) { const date = new Date(value); date.setSeconds(0, 0); date.setMinutes(date.getMinutes() + 1); return date; }
function formatDuration(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
function formatBytes(bytes: number) { return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`; }
function FieldError({ children }: { children: string }) { return <p role="alert" className="mt-1.5 text-xs text-red-700 dark:text-red-300">{children}</p>; }
