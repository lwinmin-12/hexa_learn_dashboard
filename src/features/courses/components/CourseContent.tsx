import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BookOpen, ChevronDown, Clock3, GripVertical, MoreHorizontal, Plus, Video } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Modal } from '@/components/common/Modal';
import { StatusPill } from '@/components/common/StatusPill';
import { useToast } from '@/app/toast-context';
import { api } from '@/lib/api';
import type { Chapter, Course, Episode } from '@/lib/domain';
import { queryKeys } from '@/lib/query-keys';
import { formatDate } from '@/lib/utils';
import { addEpisode, getCourse } from '../api';
import { useAddChapter, useReorderChapters, useReorderEpisodes } from '../hooks';

type TitleAction = { kind: 'newChapter' } | { kind: 'newEpisode'; chapterId: string } | { kind: 'rename'; chapter: Chapter };
type ChapterStatus = Extract<Chapter['status'], 'draft' | 'published'>;
const noChapters: Chapter[] = [];
const createdEpisodeSchema = z.object({ id: z.string().min(1) });
const videoLabels = { pending: 'Pending', uploading: 'Uploading', ready: 'Ready', failed: 'Failed' } satisfies Record<NonNullable<Episode['videoUploadStatus']>, string>;

function useReorderSensors() {
  return useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
}

export function CourseContent({ course, onSelectEpisode }: { course: Course; onSelectEpisode: (episode: Episode) => void }) {
  const chapters = course.chapters ?? noChapters;
  const [expanded, setExpanded] = useState(() => new Set((chapters.length <= 5 ? chapters : chapters.slice(0, 1)).map((chapter) => chapter.id)));
  const [action, setAction] = useState<TitleAction | null>(null);
  const [deleting, setDeleting] = useState<Chapter | null>(null);
  const [scrollToId, setScrollToId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  function restoreFocus() {
    requestAnimationFrame(() => returnFocus.current?.focus());
  }
  function openTitle(next: TitleAction, trigger: HTMLElement | null) {
    returnFocus.current = trigger;
    saveTitle.reset();
    setAction(next);
  }
  function chapterMenu(chapterId: string) {
    return document.getElementById(`chapter-${chapterId}`)?.querySelector<HTMLButtonElement>('[data-chapter-menu]') ?? null;
  }
  const client = useQueryClient();
  const toast = useToast();
  const addChapter = useAddChapter(course.id);
  const reorder = useReorderChapters(course.id);
  const sensors = useReorderSensors();
  const busy = useIsMutating() > 0;
  const refresh = () => client.invalidateQueries({ queryKey: queryKeys.courses.detail(course.id) });
  const changeChapterStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ChapterStatus }) => api.patch(`/admin/chapters/${id}`, { status }),
    onSuccess: async () => { await refresh(); toast('Chapter status updated.'); },
    onError: () => toast('Could not update chapter status. Please try again.', 'error'),
  });
  const saveTitle = useMutation({
    mutationFn: async ({ action: current, title }: { action: TitleAction; title: string }) => {
      switch (current.kind) {
        case 'newChapter': {
          const chapter = await addChapter.mutateAsync(title);
          setExpanded((ids) => new Set([...ids, chapter.id]));
          setScrollToId(chapter.id);
          toast('Chapter created.');
          break;
        }
        case 'newEpisode': {
          const response: unknown = await addEpisode(current.chapterId, title);
          setAction(null);
          try {
            const { id } = createdEpisodeSchema.parse(response);
            const updated = await client.fetchQuery({ queryKey: queryKeys.courses.detail(course.id), queryFn: () => getCourse(course.id), staleTime: 0 });
            const episode = updated.chapters?.flatMap((chapter) => chapter.episodes).find((item) => item.id === id);
            if (!episode) throw new Error('Created episode is missing from the course.');
            setExpanded((ids) => new Set([...ids, current.chapterId]));
            onSelectEpisode(episode);
            toast('Episode created.');
          } catch {
            toast('Episode created. Refresh the course to open its editor.', 'error');
          }
          break;
        }
        case 'rename':
          await api.patch(`/admin/chapters/${current.chapter.id}`, { title });
          await refresh();
          toast('Chapter renamed.');
          break;
      }
    },
    onSuccess: (_data, variables) => { setAction(null); if (variables.action.kind === 'rename') restoreFocus(); },
    onError: (error, variables) => { if (variables.action.kind === 'newEpisode') toast(error.message || 'Could not create the episode.', 'error'); },
  });
  const removeChapter = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/chapters/${id}`),
    onSuccess: async () => { setDeleting(null); await refresh(); document.querySelector<HTMLButtonElement>('[data-new-chapter]')?.focus(); toast('Chapter deleted.'); },
    onError: () => toast('Could not delete the chapter. Please try again.', 'error'),
  });

  useEffect(() => {
    if (!scrollToId || !chapters.some((chapter) => chapter.id === scrollToId)) return;
    const element = document.getElementById(`chapter-${scrollToId}`);
    element?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    element?.querySelector<HTMLButtonElement>('[data-chapter-toggle]')?.focus({ preventScroll: true });
    setScrollToId(null);
  }, [scrollToId, chapters]);

  function moveChapters({ active, over }: DragEndEvent) {
    setDropId(null);
    if (busy || !over || active.id === over.id) return;
    const from = chapters.findIndex((chapter) => chapter.id === active.id);
    const to = chapters.findIndex((chapter) => chapter.id === over.id);
    if (from < 0 || to < 0) return;
    reorder.mutate({ ids: arrayMove(chapters, from, to).map((chapter) => chapter.id) }, { onError: () => toast('Could not reorder chapters. Your changes were restored.', 'error') });
  }

  const newChapterButton = <Button variant="primary" className="bg-teal-700 hover:bg-teal-800" data-new-chapter disabled={busy} onClick={(event) => openTitle({ kind: 'newChapter' }, event.currentTarget)}><Plus aria-hidden="true" className="size-4" />New chapter</Button>;
  const episodeCount = chapters.reduce((count, chapter) => count + chapter.episodes.length, 0);
  return <div className="space-y-4">
    <header className="sticky top-[68px] z-20 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-white/95 p-5 backdrop-blur dark:bg-slate-900/95">
      <div><h2 className="text-lg font-semibold text-ink dark:text-white">Course content</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Drag chapters or episodes to arrange your course.</p></div>
      <div className="flex flex-wrap items-center gap-3"><span className="text-xs text-slate-600 dark:text-slate-300">{chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'}, {episodeCount} {episodeCount === 1 ? 'episode' : 'episodes'}</span>{newChapterButton}</div>
    </header>
    {chapters.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-line bg-white p-8 text-center dark:bg-slate-900"><BookOpen aria-hidden="true" className="size-8 text-teal-700" /><h3 className="font-semibold">No chapters yet</h3><p className="text-sm text-slate-600 dark:text-slate-300">Create your first chapter to start adding episodes.</p>{newChapterButton}</div> : <DndContext sensors={sensors} collisionDetection={closestCenter} onDragOver={({ active, over }) => setDropId(over && active.id !== over.id ? String(over.id) : null)} onDragCancel={() => setDropId(null)} onDragEnd={moveChapters}>
      <SortableContext items={chapters.map((chapter) => chapter.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-4">{chapters.map((chapter, index) => <ChapterCard key={chapter.id} chapter={chapter} number={index + 1} expanded={expanded.has(chapter.id)} disabled={busy} dropTarget={dropId === chapter.id} onToggle={() => setExpanded((ids) => { const next = new Set(ids); if (next.has(chapter.id)) next.delete(chapter.id); else next.add(chapter.id); return next; })} onEpisode={(trigger) => openTitle({ kind: 'newEpisode', chapterId: chapter.id }, trigger)} onRename={() => openTitle({ kind: 'rename', chapter }, chapterMenu(chapter.id))} onStatusChange={(status) => changeChapterStatus.mutate({ id: chapter.id, status })} onDelete={() => { returnFocus.current = chapterMenu(chapter.id); setDeleting(chapter); }} onSelectEpisode={onSelectEpisode} />)}</div>
      </SortableContext>
    </DndContext>}
    {action && <TitleDialog key={action.kind === 'rename' ? action.chapter.id : action.kind === 'newEpisode' ? action.chapterId : action.kind} action={action} busy={saveTitle.isPending} error={saveTitle.error} onClose={() => { if (!saveTitle.isPending) { setAction(null); restoreFocus(); } }} onSubmit={(title) => saveTitle.mutate({ action, title })} />}
    <ConfirmDialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open && !removeChapter.isPending) { setDeleting(null); restoreFocus(); } }} title="Delete chapter?" description={`Delete “${deleting?.title ?? ''}” and its episodes? This cannot be undone.`} confirmLabel="Delete chapter" destructive busy={removeChapter.isPending} onConfirm={() => { if (deleting) removeChapter.mutate(deleting.id); }} />
  </div>;
}

function TitleDialog({ action, busy, error, onClose, onSubmit }: { action: TitleAction; busy: boolean; error: Error | null; onClose: () => void; onSubmit: (title: string) => void }) {
  const [title, setTitle] = useState(action.kind === 'rename' ? action.chapter.title : '');
  const isEpisode = action.kind === 'newEpisode';
  const label = isEpisode ? 'Episode title' : 'Chapter title';
  function submit(event: FormEvent) { event.preventDefault(); if (title.trim() && title.trim().length <= 120 && !busy) onSubmit(title.trim()); }
  return <Modal open onOpenChange={(open) => { if (!open) onClose(); }} title={action.kind === 'rename' ? 'Rename chapter' : isEpisode ? 'New episode' : 'New chapter'} description={isEpisode ? 'Create an episode, then add its details and video.' : 'Give this chapter a clear, descriptive title.'} className="max-w-md">
    <form onSubmit={submit}><label htmlFor="content-item-title" className="text-sm font-medium">{label}</label><input autoFocus id="content-item-title" className="field mt-2" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} disabled={busy} />
      {error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{error.message || 'Could not save. Please try again.'}</p>}
      <div className="mt-6 flex justify-end gap-2"><Button type="button" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" className="bg-teal-700 hover:bg-teal-800" disabled={busy || !title.trim()}>{busy ? 'Saving…' : action.kind === 'rename' ? 'Save' : 'Create'}</Button></div>
    </form>
  </Modal>;
}

function ChapterCard({ chapter, number, expanded, disabled, dropTarget, onToggle, onEpisode, onRename, onStatusChange, onDelete, onSelectEpisode }: { chapter: Chapter; number: number; expanded: boolean; disabled: boolean; dropTarget: boolean; onToggle: () => void; onEpisode: (trigger: HTMLButtonElement) => void; onRename: () => void; onStatusChange: (status: ChapterStatus) => void; onDelete: () => void; onSelectEpisode: (episode: Episode) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: chapter.id, disabled });
  const reorder = useReorderEpisodes(chapter.courseId, chapter.id);
  const sensors = useReorderSensors();
  const toast = useToast();
  const [dropEpisodeId, setDropEpisodeId] = useState<string | null>(null);
  function moveEpisodes({ active, over }: DragEndEvent) {
    setDropEpisodeId(null);
    if (disabled || !over || active.id === over.id) return;
    const from = chapter.episodes.findIndex((episode) => episode.id === active.id);
    const to = chapter.episodes.findIndex((episode) => episode.id === over.id);
    if (from < 0 || to < 0) return;
    reorder.mutate(arrayMove(chapter.episodes, from, to).map((episode) => episode.id), { onError: () => toast('Could not reorder episodes. Your changes were restored.', 'error') });
  }
  return <section id={`chapter-${chapter.id}`} data-testid="chapter-card" data-chapter-id={chapter.id} ref={setNodeRef} aria-label={`Chapter ${number}: ${chapter.title}`} style={{ transform: CSS.Transform.toString(transform), transition }} className={`relative rounded-xl border border-line bg-white dark:border-slate-700 dark:bg-slate-900 ${isDragging ? 'z-30 shadow-xl ring-2 ring-teal-700' : ''} ${dropTarget ? 'before:absolute before:-top-2 before:left-0 before:right-0 before:h-0.5 before:bg-teal-700' : ''}`}>
    <header className="flex flex-wrap items-center gap-2 rounded-t-xl border-b border-line bg-[#F7F8F8] p-4 dark:border-slate-700 dark:bg-slate-800">
      <button {...attributes} {...listeners} disabled={disabled} aria-label={`Reorder chapter ${number}: ${chapter.title}`} className="touch-none rounded p-1 text-slate-600 focus-visible:ring-2 focus-visible:ring-teal-700 disabled:opacity-40 dark:text-slate-300"><GripVertical aria-hidden="true" className="size-4" /></button>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-100">{number}</span>
      <button data-chapter-toggle aria-label={`${expanded ? 'Collapse' : 'Expand'} ${chapter.title}`} aria-expanded={expanded} aria-controls={`chapter-episodes-${chapter.id}`} onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 rounded text-left focus-visible:ring-2 focus-visible:ring-teal-700"><ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-slate-600 transition-transform dark:text-slate-300 ${expanded ? '' : '-rotate-90'}`} /><span className="min-w-0"><span className="block break-words text-base font-semibold text-ink dark:text-white">{chapter.title}</span><span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">{chapter.episodes.length} {chapter.episodes.length === 1 ? 'episode' : 'episodes'}</span></span></button>
      <div className="flex flex-wrap items-center gap-2"><StatusPill status={chapter.status} />{Boolean(chapter.bookCount) && <Link to={`/courses/${chapter.courseId}/books?bookScope=chapter&chapter=${chapter.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"><BookOpen aria-hidden="true" className="size-3.5" />Books ({chapter.bookCount})</Link>}<Button variant="ghost" size="sm" className="text-slate-700 dark:text-slate-200" disabled={disabled} onClick={(event) => onEpisode(event.currentTarget)} aria-label={`Add episode to ${chapter.title}`}><Plus aria-hidden="true" className="size-4" />Episode</Button>
        <DropdownMenu.Root><DropdownMenu.Trigger asChild><button data-chapter-menu disabled={disabled} aria-label={`Chapter actions for ${chapter.title}`} className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-teal-700 dark:text-slate-200"><MoreHorizontal aria-hidden="true" className="size-4" /></button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={5} className="z-40 min-w-40 rounded-lg border border-line bg-white p-1 shadow-lg dark:bg-slate-900"><DropdownMenu.Item disabled={disabled || chapter.status === 'draft'} onSelect={() => onStatusChange('draft')} className="cursor-pointer rounded px-3 py-2 text-sm outline-none focus:bg-slate-100 data-[disabled]:opacity-50 dark:focus:bg-slate-800">Set status to Draft</DropdownMenu.Item><DropdownMenu.Item disabled={disabled || chapter.status === 'published'} onSelect={() => onStatusChange('published')} className="cursor-pointer rounded px-3 py-2 text-sm outline-none focus:bg-slate-100 data-[disabled]:opacity-50 dark:focus:bg-slate-800">Set status to Published</DropdownMenu.Item><DropdownMenu.Separator className="my-1 h-px bg-line" /><DropdownMenu.Item onSelect={onRename} className="cursor-pointer rounded px-3 py-2 text-sm outline-none focus:bg-slate-100 dark:focus:bg-slate-800">Rename</DropdownMenu.Item><DropdownMenu.Item onSelect={onDelete} className="cursor-pointer rounded px-3 py-2 text-sm text-red-700 outline-none focus:bg-red-50 dark:text-red-300 dark:focus:bg-red-950">Delete</DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>
      </div>
    </header>
    <div id={`chapter-episodes-${chapter.id}`} hidden={!expanded} className="p-4 pl-6">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragOver={({ active, over }) => setDropEpisodeId(over && active.id !== over.id ? String(over.id) : null)} onDragCancel={() => setDropEpisodeId(null)} onDragEnd={moveEpisodes}><SortableContext items={chapter.episodes.map((episode) => episode.id)} strategy={verticalListSortingStrategy}>
        <div className="border-l border-slate-200 pl-3 dark:border-slate-700">{chapter.episodes.length ? chapter.episodes.map((episode, index) => <EpisodeRow key={episode.id} episode={episode} number={`${number}.${index + 1}`} disabled={disabled} dropTarget={dropEpisodeId === episode.id} onSelect={() => onSelectEpisode(episode)} />) : <p className="py-4 pl-3 text-sm text-slate-600 dark:text-slate-300">No episodes yet. Add an episode to this chapter.</p>}</div>
      </SortableContext></DndContext>
    </div>
  </section>;
}

function EpisodeRow({ episode, number, disabled, dropTarget, onSelect }: { episode: Episode; number: string; disabled: boolean; dropTarget: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: episode.id, disabled });
  const scheduledAt = episode.status === 'scheduled' ? episode.publishAt : episode.videoScheduledAt;
  return <div data-episode-id={episode.id} ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`group relative flex flex-wrap items-center gap-3 rounded-lg bg-white px-2 py-4 dark:bg-slate-900 ${isDragging ? 'z-30 shadow-lg ring-2 ring-teal-700' : ''} ${dropTarget ? 'before:absolute before:-top-px before:left-0 before:right-0 before:h-0.5 before:bg-teal-700' : ''}`}>
    <button {...attributes} {...listeners} disabled={disabled} aria-label={`Reorder episode ${number}: ${episode.title}`} className="touch-none rounded p-1 text-slate-600 focus-visible:ring-2 focus-visible:ring-teal-700 disabled:opacity-40 dark:text-slate-300"><GripVertical aria-hidden="true" className="size-4" /></button>
    <span className="min-w-7 text-xs tabular-nums text-slate-600 dark:text-slate-300">{number}</span>
    <button id={`content-episode-${episode.id}`} onClick={onSelect} className="min-w-0 flex-1 break-words rounded text-left text-sm font-normal text-ink underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-teal-700 dark:text-white">{episode.title}</button>
    <button onClick={onSelect} aria-label={`Edit ${episode.title}`} className="rounded px-2 py-1 text-xs text-slate-600 opacity-0 hover:bg-slate-100 focus:opacity-100 focus-visible:ring-2 focus-visible:ring-teal-700 group-hover:opacity-100 dark:text-slate-300">Edit</button>
    <div className="flex w-full flex-wrap items-center gap-2 pl-9 lg:ml-auto lg:w-auto lg:pl-0"><span className="inline-flex items-center gap-1"><BookOpen aria-hidden="true" className="size-3.5 text-slate-600 dark:text-slate-300" /><StatusPill status={episode.status} label={`Episode: ${episode.status.charAt(0).toUpperCase()}${episode.status.slice(1)}`} /></span><span className="inline-flex items-center gap-1"><Video aria-hidden="true" className="size-3.5 text-slate-600 dark:text-slate-300" /><StatusPill status={episode.videoUploadStatus ?? 'not_uploaded'} label={`Video: ${episode.videoUploadStatus ? videoLabels[episode.videoUploadStatus] : 'No video'}`} /></span>{scheduledAt && <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300"><Clock3 aria-hidden="true" className="size-3.5" /><span>{episode.status === 'scheduled' ? 'Episode' : 'Video'} scheduled {formatDate(scheduledAt)}</span></span>}</div>
  </div>;
}
