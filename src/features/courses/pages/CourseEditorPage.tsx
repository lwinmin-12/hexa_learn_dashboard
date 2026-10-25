import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import * as Tabs from '@radix-ui/react-tabs';
import { ArrowLeft, AudioLines, BookOpen, FileQuestion, GripVertical, ImagePlus, Layers, LoaderCircle, MessageCircle, Pencil, Send, Trash2, Users, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { CourseCover } from '@/components/common/CourseCover';
import { DataTable, type Column } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusPill } from '@/components/common/StatusPill';
import { useToast } from '@/app/toast-context';
import { uploadCourseCover } from '../api';
import { useCourse, useSaveCourse } from '../hooks';
import { getCourseLearners, getCourseStats } from '@/features/dashboard/api';
import { useChannel, useChannelMembers, useChannelMessages, useDeleteChannelMessage, usePostMessage, useRemoveChannelMember, useUpdateChannel } from '@/features/channels/hooks';
import type { Course, Episode } from '@/lib/domain';
import { queryKeys } from '@/lib/query-keys';
import { formatDate } from '@/lib/utils';
import { CourseForm, type CourseFormValues } from '../components/CourseForm';
import { ChapterTools } from '@/features/content/ChapterTools';
import { CourseQuizzesPanel } from '@/features/quizzes/CourseQuizzesPanel';
import { EpisodeEditor } from '../components/EpisodeEditor';

import { CourseContent } from '../components/CourseContent';
import { BooksTab } from '@/features/books/BooksTab';

export function CourseEditorPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const courseQuery = useCourse(id);
  const course = courseQuery.data;
  const saveCourse = useSaveCourse(id);
  const client = useQueryClient();
  const toast = useToast();
  const [coverBusy, setCoverBusy] = useState(false);
  const [localTab, setLocalTab] = useState('details');
  const activeTab = location.pathname.endsWith('/books') ? 'books' : localTab;
  function selectTab(value: string) {
    setLocalTab(value);
    if (value === 'books') navigate(`/courses/${id}/books${location.search}`);
    else if (activeTab === 'books') navigate(`/courses/${id}${location.search}`);
  }

  async function save(values: CourseFormValues) {
    try {
      await saveCourse.mutateAsync(values);
      toast('Course details saved.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not save course.', 'error');
    }
  }

  async function uploadCover(file: File) {
    if (!course) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      toast('Choose a JPG, PNG, or WebP image under 5 MB.', 'error');
      return;
    }
    setCoverBusy(true);
    try {
      await uploadCourseCover(course.id, file);
      await client.invalidateQueries({ queryKey: queryKeys.courses.detail(course.id) });
      toast('Cover image updated.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not upload cover.', 'error');
    } finally {
      setCoverBusy(false);
    }
  }

  if (courseQuery.isLoading) return <div role="status" aria-label="Loading course content" className="space-y-4">{[1, 2, 3].map((number) => <div key={number} className="surface-card animate-pulse"><div className="h-16 border-b border-line bg-[#F7F8F8] dark:bg-slate-800" /><div className="m-6 h-16 rounded bg-slate-100 dark:bg-slate-900" /></div>)}</div>;
  if (courseQuery.isError || !course) return <div role="alert" className="surface-card p-8"><PageHeader title="Course unavailable" description="This course could not be loaded. It may have been removed or you may not have access." action={<div className="flex gap-2"><Button onClick={() => void courseQuery.refetch()} disabled={courseQuery.isFetching}>Retry</Button><Link to="/courses"><Button><ArrowLeft className="size-4" />Back to courses</Button></Link></div>} /></div>;

  return <>
    <Link to="/courses" className="mb-4 inline-flex items-center gap-2 text-xs font-medium text-muted hover:text-accent"><ArrowLeft className="size-3.5" />Courses</Link>
    <PageHeader eyebrow="Course workspace" title={course.title} description={`/${course.slug}`} action={<StatusPill status={course.status} />} />
    <Tabs.Root value={activeTab} onValueChange={selectTab}>
      <Tabs.List className="mb-5 flex gap-1 overflow-x-auto border-b border-line dark:border-slate-800" aria-label="Course sections">{[
        { value: 'details', label: 'Details', icon: BookOpen }, { value: 'content', label: 'Content', icon: GripVertical }, { value: 'flashcards', label: 'Flashcards', icon: Layers }, { value: 'audio', label: 'Audio tracks', icon: AudioLines }, { value: 'books', label: 'Books', icon: BookOpen }, { value: 'quizzes', label: 'Quizzes', icon: FileQuestion }, { value: 'channel', label: 'Channel', icon: MessageCircle }, { value: 'learners', label: 'Learners', icon: Users }, { value: 'stats', label: 'Stats', icon: AudioLines },
      ].map(({ value, label, icon: Icon }: { value: string; label: string; icon: LucideIcon }) => <Tabs.Trigger key={value} value={value} className="inline-flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 py-3 text-xs font-medium text-muted outline-none transition data-[state=active]:border-accent data-[state=active]:text-accent"><Icon className="size-3.5" />{label}</Tabs.Trigger>)}</Tabs.List>
      <Tabs.Content value="details" className="focus:outline-none"><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_310px]"><section className="surface-card p-5 md:p-6"><div className="mb-5"><h2 className="text-sm font-semibold">Course details</h2><p className="mt-1 text-xs text-muted">These details appear in the learner catalog.</p></div><CourseForm course={course} onSave={(values) => void save(values)} saving={saveCourse.isPending} /></section><aside className="space-y-4"><div className="surface-card p-4"><div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-semibold">Course cover</h3><p className="mt-1 text-xs text-muted">JPG, PNG, or WebP. Up to 5 MB.</p></div><label className="grid size-9 cursor-pointer place-items-center rounded-lg border border-line text-muted hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" aria-label="Upload course cover">{coverBusy ? <LoaderCircle className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadCover(file); event.currentTarget.value = ''; }} /></label></div><CourseCover course={course} /></div><div className="surface-card p-4"><p className="text-xs text-muted">{course.updatedAt ? 'Last updated' : 'Created'}</p><p className="mt-1 text-sm font-medium">{formatDate(course.updatedAt ?? course.createdAt, 'MMMM d, yyyy · h:mm a')}</p><p className="mt-4 text-xs text-muted">Course ID</p><p className="mt-1 truncate font-mono text-[10px] text-slate-500">{course.id}</p></div></aside></div></Tabs.Content>
      <Tabs.Content value="content" forceMount className="focus:outline-none data-[state=inactive]:hidden"><ContentPanel key={course.id} course={course} /></Tabs.Content>
      <Tabs.Content value="flashcards" className="focus:outline-none"><ChapterTools course={course} chapters={course.chapters ?? []} mode="flashcards" onGoToContent={() => selectTab('content')} /></Tabs.Content>
      <Tabs.Content value="audio" className="focus:outline-none"><ChapterTools course={course} chapters={course.chapters ?? []} mode="audio" onGoToContent={() => selectTab('content')} /></Tabs.Content>
      <Tabs.Content value="books" className="focus:outline-none"><BooksTab course={course} /></Tabs.Content>
      <Tabs.Content value="quizzes" className="focus:outline-none"><CourseQuizzesPanel course={course} /></Tabs.Content>
      <Tabs.Content value="channel" className="focus:outline-none"><ChannelPanel courseId={course.id} /></Tabs.Content>
      <Tabs.Content value="learners" className="focus:outline-none"><LearnersPanel courseId={course.id} /></Tabs.Content>
      <Tabs.Content value="stats" className="focus:outline-none"><StatsPanel courseId={course.id} /></Tabs.Content>
    </Tabs.Root>
  </>;
}

function ContentPanel({ course }: { course: Course }) {
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  return <>
    <CourseContent course={course} onSelectEpisode={setSelectedEpisode} />
    <EpisodeEditor episode={selectedEpisode} open={Boolean(selectedEpisode)} onOpenChange={(open) => { if (!open) { const episodeId = selectedEpisode?.id; setSelectedEpisode(null); requestAnimationFrame(() => document.getElementById(`content-episode-${episodeId}`)?.focus()); } }} courseId={course.id} />
  </>;
}

export function ChannelPanel({ courseId }: { courseId: string }) {
  const channel = useChannel(courseId);
  const channelId = channel.data?.id ?? '';
  const messages = useChannelMessages(channelId);
  const members = useChannelMembers(channelId);
  const post = usePostMessage(channelId);
  const updateChannel = useUpdateChannel(courseId, channelId);
  const deleteMessage = useDeleteChannelMessage(channelId);
  const removeMember = useRemoveChannelMember(channelId);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [channelName, setChannelName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ kind: 'message'; id: string; label: string } | { kind: 'member'; id: string; label: string } | null>(null);
  const toast = useToast();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try { await post.mutateAsync({ title, body }); setTitle(''); setBody(''); toast('Message sent to the course channel.'); }
    catch { toast('Could not send the message.', 'error'); }
  }

  async function saveName() {
    if (!channelName.trim()) return;
    try { await updateChannel.mutateAsync(channelName.trim()); setEditingName(false); toast('Channel name updated.'); }
    catch { toast('Could not update the channel name.', 'error'); }
  }

  async function confirmRemoval() {
    if (!confirmAction) return;
    try {
      if (confirmAction.kind === 'message') await deleteMessage.mutateAsync(confirmAction.id);
      else await removeMember.mutateAsync(confirmAction.id);
      toast(confirmAction.kind === 'message' ? 'Message deleted.' : 'Learner removed from the channel.');
      setConfirmAction(null);
    } catch { toast('Could not complete that action.', 'error'); }
  }

  if (channel.isError) return <div role="alert" className="surface-card p-5 text-sm text-red-700">This course channel could not be loaded.</div>;
  if (channel.isLoading) return <div className="h-60 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900" />;
  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]"><section className="surface-card"><div className="border-b border-line px-5 py-4 dark:border-slate-800"><div className="flex items-center justify-between gap-3"><div className="min-w-0 flex-1">{editingName ? <div className="flex gap-2"><label className="sr-only" htmlFor="channel-name">Channel name</label><input id="channel-name" className="field h-9" value={channelName} onChange={(event) => setChannelName(event.target.value)} /><Button size="sm" variant="primary" disabled={!channelName.trim() || updateChannel.isPending} onClick={() => void saveName()}>Save</Button><Button size="sm" onClick={() => setEditingName(false)}>Cancel</Button></div> : <div><div className="flex items-center gap-2"><h2 className="truncate text-sm font-semibold">{channel.data?.name}</h2><button className="rounded p-1 text-muted hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Edit channel name" onClick={() => { setChannelName(channel.data?.name ?? ''); setEditingName(true); }}><Pencil className="size-3" /></button></div><p className="mt-1 text-xs text-muted">{members.data?.meta.total.toLocaleString() ?? '—'} learners in this channel</p></div>}</div><MessageCircle className="size-4 shrink-0 text-accent" /></div></div>
      <div className="max-h-[420px] min-h-52 space-y-3 overflow-y-auto p-5">{messages.isLoading ? <div className="h-16 animate-pulse rounded-lg bg-slate-50 dark:bg-slate-800" /> : messages.data?.data.length ? messages.data.data.map((message) => <article key={message.id} className="rounded-xl border border-line p-4 dark:border-slate-700"><div className="flex items-start justify-between gap-3"><p className="text-sm font-medium">{message.title}</p><button className="rounded p-1.5 text-red-500 hover:bg-red-50" aria-label={`Delete message ${message.title}`} onClick={() => setConfirmAction({ kind: 'message', id: message.id, label: message.title })}><Trash2 className="size-3.5" /></button></div><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-muted">{message.body}</p><p className="mt-3 text-[10px] text-slate-400">{formatDate(message.createdAt, 'MMM d, h:mm a')}</p></article>) : <EmptyState title="Start the conversation" description="Send a message to everyone enrolled in this course." />}</div>
      <form onSubmit={(event) => void submit(event)} className="border-t border-line p-5 dark:border-slate-800"><div className="grid gap-3"><div><label className="field-label" htmlFor="channel-message-title">Notification title</label><input id="channel-message-title" maxLength={80} className="field" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="A quick note for your learners" /></div><div><div className="mb-1.5 flex items-center justify-between"><label className="field-label mb-0" htmlFor="channel-message-body">Message</label><span className="text-[10px] text-muted">{body.length}/500</span></div><textarea id="channel-message-body" maxLength={500} rows={3} className="field h-auto py-2.5" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Share an update or encouragement…" /></div><div className="rounded-xl bg-[#F2F7F6] p-3 dark:bg-slate-800"><p className="text-[10px] font-semibold uppercase tracking-wider text-accent">Learner preview</p><p className="mt-2 text-xs font-semibold">{title || 'Notification title'}</p><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-muted">{body || 'Your message will appear here.'}</p></div><div className="flex justify-end"><Button type="submit" variant="primary" disabled={!title.trim() || !body.trim() || post.isPending}><Send className="size-3.5" />{post.isPending ? 'Sending…' : 'Send message'}</Button></div></div></form></section>
    <aside className="surface-card"><div className="border-b border-line px-4 py-4 dark:border-slate-800"><h3 className="text-sm font-semibold">Members</h3><p className="mt-1 text-xs text-muted">{members.data?.meta.total ?? 0} enrolled learners</p></div>{members.data?.data.length ? <div className="divide-y divide-line dark:divide-slate-800">{members.data.data.map((member) => <div key={member.id} className="flex items-center gap-3 px-4 py-3"><div className="grid size-8 place-items-center rounded-full bg-[#E9F5F3] text-xs font-semibold text-accent">{member.user.displayName?.charAt(0) ?? 'L'}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{member.user.displayName ?? 'Learner'}</p><p className="truncate text-[10px] text-muted">{member.user.email}</p></div><button className="rounded p-1.5 text-red-500 hover:bg-red-50" aria-label={`Remove ${member.user.displayName}`} onClick={() => setConfirmAction({ kind: 'member', id: member.user.id, label: member.user.displayName ?? 'Learner' })}><Trash2 className="size-3.5" /></button></div>)}</div> : <EmptyState title="No members yet" />}</aside>
    <ConfirmDialog open={Boolean(confirmAction)} onOpenChange={(open) => !open && setConfirmAction(null)} title={confirmAction?.kind === 'message' ? 'Delete this message?' : 'Remove this learner?'} description={confirmAction ? `${confirmAction.label} will be removed from this channel.` : ''} confirmLabel={confirmAction?.kind === 'message' ? 'Delete message' : 'Remove learner'} destructive busy={deleteMessage.isPending || removeMember.isPending} onConfirm={() => void confirmRemoval()} /></div>;
}

function LearnersPanel({ courseId }: { courseId: string }) {
  const query = useQuery({ queryKey: queryKeys.courses.learners(courseId), queryFn: () => getCourseLearners(courseId) });
  type Learner = NonNullable<typeof query.data>['data'][number];
  const columns: Column<Learner>[] = [
    { key: 'learner', header: 'Learner', render: (item) => <div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-full bg-[#E9F5F3] text-xs font-semibold text-accent">{item.user.displayName[0]}</span><span className="text-xs font-medium">{item.user.displayName}</span></div> },
    { key: 'progress', header: 'Progress', render: (item) => <div className="flex min-w-32 items-center gap-2"><div className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-accent" style={{ width: `${item.progressPct}%` }} /></div><span className="w-8 text-right text-[11px] text-muted">{Math.round(item.progressPct)}%</span></div> },
    { key: 'enrolled', header: 'Enrolled', render: (item) => <span className="text-xs text-muted">{formatDate(item.enrolledAt)}</span> },
    { key: 'activity', header: 'Last activity', render: (item) => <span className="text-xs text-muted">{formatDate(item.lastActivityAt)}</span> },
  ];
  return <><PageHeader title="Learners" description="Learner progress and recent activity for this course." /><DataTable rows={query.data?.data ?? []} columns={columns} loading={query.isLoading} emptyTitle="No learners yet" emptyDescription="Learners will appear after they enroll." /></>;
}

function StatsPanel({ courseId }: { courseId: string }) {
  const query = useQuery({ queryKey: queryKeys.courses.stats(courseId), queryFn: () => getCourseStats(courseId) });
  if (query.isLoading) return <div className="h-52 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900" />;
  if (query.isError || !query.data) return <div role="alert" className="surface-card p-5 text-sm text-red-700">Course statistics are unavailable.</div>;
  const stats = [{ label: 'Enrollments', value: query.data.enrollmentCount.toLocaleString() }, { label: 'Completion rate', value: `${query.data.completionRate.toFixed(1)}%` }, { label: 'Average progress', value: `${Number(query.data.averageProgressPct).toFixed(1)}%` }];
  return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-3">{stats.map((stat) => <div key={stat.label} className="surface-card p-5"><p className="text-xs text-muted">{stat.label}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{stat.value}</p></div>)}</div><section className="surface-card"><div className="border-b border-line px-5 py-4 dark:border-slate-800"><h2 className="text-sm font-semibold">Quiz performance</h2></div>{query.data.quizzes.length ? <div className="divide-y divide-line dark:divide-slate-800">{query.data.quizzes.map((quiz) => <div key={quiz.id} className="flex items-center justify-between gap-3 px-5 py-4"><span className="text-sm font-medium">{quiz.title}</span><span className="text-xs text-muted">Avg. score {quiz.averageScore?.toFixed(1) ?? '—'} <span className="mx-2 text-slate-300">·</span> Pass rate {quiz.passRate.toFixed(1)}%</span></div>)}</div> : <EmptyState title="No quiz attempts yet" description="Quiz results will appear after learners submit an attempt." />}</section></div>;
}

