import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { useToast } from '@/app/toast-context';
import type { Course } from '@/lib/domain';
import { messageFromError } from '@/lib/utils';
import { deleteCourseQuiz, getCourseQuizzes, type QuizListItem, type QuizScope } from './courseQuizApi';
import { NewQuizDialog, QuizList, QuizRow } from './QuizComponents';

type QuizGroup = { id: string; title: string; order: number; quizzes: QuizListItem[] };
const primaryClass = 'whitespace-nowrap bg-teal-700 hover:bg-teal-800';
const filters = [{ scope: 'all', label: 'All' }, { scope: 'course', label: 'Course' }, { scope: 'chapter', label: 'Chapters' }, { scope: 'episode', label: 'Lessons' }] satisfies { scope: 'all' | QuizScope; label: string }[];

function groupQuizzes(quizzes: QuizListItem[], course: Course): QuizGroup[] {
  const groups = new Map<string, QuizGroup>();
  const chapters = course.chapters ?? [];
  for (const quiz of quizzes) {
    if (quiz.scope === 'course') {
      const group: QuizGroup = groups.get('course') ?? { id: 'course', title: 'Whole course', order: -1, quizzes: [] };
      group.quizzes.push(quiz);
      groups.set(group.id, group);
      continue;
    }
    const chapterId = quiz.scope === 'chapter' ? quiz.attachedTo.id : quiz.attachedTo.chapterId;
    const chapterIndex = chapters.findIndex((chapter) => chapter.id === chapterId || (quiz.scope === 'episode' && chapter.episodes.some((episode) => episode.id === quiz.attachedTo.id)));
    const chapter = chapters[chapterIndex];
    const chapterOrder = chapterIndex >= 0 ? chapterIndex : quiz.attachedTo.chapterPosition;
    const chapterTitle = chapter?.title ?? quiz.attachedTo.chapterTitle ?? (quiz.scope === 'chapter' ? quiz.attachedTo.title : 'Other lessons');
    const id = chapter?.id ?? chapterId ?? `chapter-${chapterTitle}`;
    const group: QuizGroup = groups.get(id) ?? {
      id,
      title: chapterIndex < 0 ? `Chapter: ${chapterTitle}` : `Chapter ${chapterIndex + 1}: ${chapterTitle}`,
      order: chapterOrder ?? Number.MAX_SAFE_INTEGER,
      quizzes: [],
    };
    group.quizzes.push(quiz);
    groups.set(id, group);
  }
  return [...groups.values()].sort((left, right) => left.order - right.order);
}

export function CourseQuizzesPanel({ course }: { course: Course }) {
  const [params, setParams] = useSearchParams();
  const search = params.get('quizSearch') ?? '';
  const rawScope = params.get('quizScope');
  const scope = rawScope === 'course' || rawScope === 'chapter' || rawScope === 'episode' ? rawScope : 'all';
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<QuizListItem | null>(null);
  const newButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const queryKey = ['quizzes', 'course', course.id];
  const client = useQueryClient();
  const toast = useToast();
  const query = useQuery({ queryKey, queryFn: () => getCourseQuizzes(course.id), staleTime: 0 });
  const quizzes = query.data ?? [];
  const visible = quizzes.filter((quiz) => (scope === 'all' || quiz.scope === scope) && quiz.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const groups = groupQuizzes(visible, course);

  function updateFilters(nextSearch: string, nextScope: 'all' | QuizScope) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (nextSearch) next.set('quizSearch', nextSearch); else next.delete('quizSearch');
      if (nextScope === 'all') next.delete('quizScope'); else next.set('quizScope', nextScope);
      return next;
    }, { replace: true });
  }
  function restoreFocus() {
    requestAnimationFrame(() => {
      if (returnFocus.current?.isConnected) returnFocus.current.focus();
      else newButton.current?.focus();
    });
  }
  function openCreate(trigger: HTMLElement) {
    returnFocus.current = trigger;
    setCreating(true);
  }
  const remove = useMutation({
    mutationFn: deleteCourseQuiz,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey });
      setDeleting(null);
      toast('Quiz deleted.');
      restoreFocus();
    },
    onError: (error) => toast(messageFromError(error), 'error'),
  });

  return <section className="space-y-5" aria-labelledby="course-quizzes-heading">
    <header className="sticky top-[68px] z-20 -mx-1 rounded-xl bg-[#F7F8F8]/95 px-1 py-3 backdrop-blur dark:bg-slate-950/95">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><h2 id="course-quizzes-heading" className="text-lg font-semibold">Quizzes</h2>{query.data && !query.isError && <span className="text-xs text-slate-600 dark:text-slate-300">{quizzes.length} {quizzes.length === 1 ? 'quiz' : 'quizzes'}</span>}</div><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Tests for the whole course, its chapters and its lessons.</p></div>
        <button ref={newButton} type="button" onClick={(event) => openCreate(event.currentTarget)} className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 ${primaryClass}`}><Plus aria-hidden="true" className="size-4" />New quiz</button>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:max-w-xs"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 size-4 text-slate-500" /><label className="sr-only" htmlFor="course-quiz-search">Search quizzes by title</label><input id="course-quiz-search" type="search" className="field pl-9" placeholder="Search quizzes" value={search} onChange={(event) => updateFilters(event.target.value, scope)} /></div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter quizzes by attachment">{filters.map((filter) => <button key={filter.scope} type="button" aria-pressed={scope === filter.scope} onClick={() => updateFilters(search, filter.scope)} className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${scope === filter.scope ? 'border-teal-700 bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200' : 'border-line bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}><span>{filter.label}</span><span className="tabular-nums">{query.isPending || query.isError ? '—' : quizzes.filter((quiz) => filter.scope === 'all' || quiz.scope === filter.scope).length}</span></button>)}</div>
      </div>
    </header>
    {query.isPending ? <div role="status" aria-label="Loading quizzes" className="space-y-3">{[1, 2, 3].map((row) => <div key={row} className="h-28 animate-pulse rounded-xl border border-line bg-slate-100 dark:border-slate-700 dark:bg-slate-900" />)}</div> : query.isError ? <div role="alert" className="surface-card flex flex-wrap items-center justify-between gap-3 p-5"><div><h3 className="text-sm font-semibold">Could not load quizzes</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Please try again.</p></div><Button onClick={() => void query.refetch()} disabled={query.isFetching}>Retry</Button></div> : !quizzes.length ? <div className="surface-card py-8"><EmptyState title="No quizzes yet" description="Create a quiz to help learners practise what they have learned." action={<Button variant="primary" className={primaryClass} onClick={(event) => openCreate(event.currentTarget)}><Plus aria-hidden="true" className="size-4" />New quiz</Button>} /></div> : !visible.length ? <div className="surface-card py-8"><EmptyState title="No matching quizzes" description="Try another title or show quizzes from every part of the course." action={<Button onClick={() => updateFilters('', 'all')}>Clear filters</Button>} /></div> : <div className="space-y-6">{groups.map((group) => <section key={group.id} aria-label={group.title}><h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">{group.title}</h3><QuizList>{group.quizzes.map((quiz) => <QuizRow key={quiz.id} quiz={quiz} onDelete={(trigger) => { returnFocus.current = trigger; setDeleting(quiz); }} />)}</QuizList></section>)}</div>}
    {creating && <NewQuizDialog course={course} onClose={() => { setCreating(false); restoreFocus(); }} onCreated={() => { setCreating(false); void client.invalidateQueries({ queryKey }); }} />}
    <ConfirmDialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open && !remove.isPending) { setDeleting(null); restoreFocus(); } }} title="Delete quiz?" description={`Delete “${deleting?.title ?? ''}”? All attempts and results for this quiz will also be deleted. This cannot be undone.`} confirmLabel="Delete quiz" destructive busy={remove.isPending} onConfirm={() => { if (deleting) remove.mutate(deleting.id); }} />
  </section>;
}

