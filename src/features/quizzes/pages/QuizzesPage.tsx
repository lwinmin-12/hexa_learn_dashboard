import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ClipboardList, Plus, Search } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { PageHeader } from '@/components/common/PageHeader';
import { useToast } from '@/app/toast-context';
import { getAllCourses, getCourse } from '@/features/courses/api';
import { messageFromError } from '@/lib/utils';
import { queryKeys } from '@/lib/query-keys';
import { deleteCourseQuiz, getQuizzes, type QuizListItem, type QuizScope, type QuizSort } from '../courseQuizApi';
import { NewQuizDialog, QuizList, QuizRow } from '../QuizComponents';

const scopes = [{ value: '', label: 'All' }, { value: 'course', label: 'Course' }, { value: 'chapter', label: 'Chapter' }, { value: 'episode', label: 'Lesson' }] as const;
const sortOptions: { value: QuizSort; label: string }[] = [{ value: 'newest', label: 'Newest' }, { value: 'title', label: 'Title A-Z' }, { value: 'attempts', label: 'Most attempts' }, { value: 'passRate', label: 'Lowest pass rate' }];
const primaryClass = 'whitespace-nowrap bg-teal-700 hover:bg-teal-800';

export function QuizzesPage() {
  const [params, setParams] = useSearchParams();
  const [searchDraft, setSearchDraft] = useState(params.get('search') ?? '');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<QuizListItem | null>(null);
  const focusTarget = useRef<HTMLElement | null>(null);
  const newButton = useRef<HTMLButtonElement>(null);
  const client = useQueryClient();
  const toast = useToast();
  const requestedPage = Number(params.get('page') ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limitParam = Number(params.get('limit') ?? 20);
  const limit = [20, 50, 100].includes(limitParam) ? limitParam : 20;
  const courseId = params.get('courseId') ?? '';
  const scopeValue = params.get('scope') ?? '';
  const scope = scopes.some((item) => item.value === scopeValue) ? scopeValue as '' | QuizScope : '';
  const rawSort = params.get('sort') ?? 'newest';
  const sort: QuizSort = sortOptions.some((item) => item.value === rawSort) ? rawSort as QuizSort : 'newest';
  const search = params.get('search')?.trim() ?? '';
  const urlSearch = params.get('search') ?? '';
  const filters = { page, limit, sort, ...(courseId ? { courseId } : {}), ...(scope ? { scope } : {}), ...(search ? { search } : {}) };
  const query = useQuery({ queryKey: queryKeys.quizzes.list(filters), queryFn: () => getQuizzes(filters) });
  const coursesQuery = useQuery({ queryKey: queryKeys.courses.all, queryFn: getAllCourses });
  const missingCourse = query.data?.data.some((quiz) => !quiz.course) ?? false;
  const fallbackCourseNames = useQuery({ queryKey: queryKeys.courses.quizNames, queryFn: async () => {
    const details = await Promise.all((coursesQuery.data ?? []).map((course) => getCourse(course.id)));
    const names = new Map<string, { id: string; title: string }>();
    for (const course of details) {
      const name = { id: course.id, title: course.title };
      names.set(course.id, name);
      for (const chapter of course.chapters ?? []) {
        names.set(chapter.id, name);
        for (const episode of chapter.episodes) names.set(episode.id, name);
      }
    }
    return names;
  }, enabled: missingCourse && Boolean(coursesQuery.data) });
  const quizzes = useMemo(() => query.data?.data ?? [], [query.data]);
  const courseNames = new Map((coursesQuery.data ?? []).map((course) => [course.id, course.title]));
  const visible = useMemo(() => [...quizzes].sort((left, right) => {
    if (sort === 'title') return left.title.localeCompare(right.title);
    if (sort === 'attempts') return right.attemptCount - left.attemptCount;
    if (sort === 'passRate') return (left.passRate ?? Number.POSITIVE_INFINITY) - (right.passRate ?? Number.POSITIVE_INFINITY);
    return 0;
  }), [quizzes, sort]);
  const rows = visible.map((quiz) => {
    const parentId = quiz.scope === 'course' ? quiz.attachedTo.id : quiz.attachedTo.chapterId ?? quiz.attachedTo.id;
    const course = quiz.course ?? fallbackCourseNames.data?.get(parentId) ?? (quiz.scope === 'course' && courseNames.has(parentId) ? { id: parentId, title: courseNames.get(parentId) ?? '' } : undefined);
    return course ? { ...quiz, course } : quiz;
  });
  const hasFilters = Boolean(courseId || scope || search || sort !== 'newest' || page !== 1);

  useEffect(() => setSearchDraft(params.get('search') ?? ''), [params]);
  const setParam = useCallback((name: string, value: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(name, value); else next.delete(name);
      if (name !== 'page') next.delete('page');
      return next;
    }, { replace: true });
  }, [setParams]);
  useEffect(() => {
    const timer = window.setTimeout(() => { if (searchDraft.trim() !== urlSearch) setParam('search', searchDraft.trim()); }, 300);
    return () => window.clearTimeout(timer);
  }, [searchDraft, setParam, urlSearch]);
  function clearFilters() { setSearchDraft(''); setParams(new URLSearchParams(), { replace: true }); }
  function openCreate(trigger: HTMLElement) { focusTarget.current = trigger; setCreating(true); }
  function restoreFocus() { requestAnimationFrame(() => (focusTarget.current?.isConnected ? focusTarget.current : newButton.current)?.focus()); }
  const remove = useMutation({
    mutationFn: deleteCourseQuiz,
    onSuccess: async () => { await client.invalidateQueries({ queryKey: queryKeys.quizzes.all }); setDeleting(null); toast('Quiz deleted.'); restoreFocus(); },
    onError: (error) => toast(messageFromError(error), 'error'),
  });

  return <div className="space-y-6">
    <PageHeader title={<>Quizzes{query.data && <span className="ml-3 align-middle text-sm font-normal text-muted">{query.data.meta.total} {query.data.meta.total === 1 ? 'quiz' : 'quizzes'}</span>}</>} description="All tests across your courses." action={<button ref={newButton} type="button" onClick={(event) => openCreate(event.currentTarget)} className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 ${primaryClass}`}><Plus aria-hidden="true" className="size-4" />New quiz</button>} />
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full sm:max-w-xs"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 size-4 text-muted" /><label htmlFor="quiz-search" className="sr-only">Search quizzes by title</label><input id="quiz-search" type="search" maxLength={120} className="field pl-9" placeholder="Search quizzes" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} /></div>
      <label className="sr-only" htmlFor="quiz-course-filter">Filter by course</label><select id="quiz-course-filter" className="field w-full sm:w-auto" value={courseId} onChange={(event) => setParam('courseId', event.target.value)}><option value="">All courses</option>{coursesQuery.data?.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter quizzes by attachment">{scopes.map((item) => <button key={item.value || 'all'} type="button" aria-pressed={scope === item.value} onClick={() => setParam('scope', item.value)} className={`h-9 rounded-full border px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${scope === item.value ? 'border-teal-700 bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200' : 'border-line bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}>{item.label}</button>)}</div>
      <label className="sr-only" htmlFor="quiz-sort">Sort quizzes</label><select id="quiz-sort" className="field w-full sm:ml-auto sm:w-auto" value={sort} onChange={(event) => setParam('sort', event.target.value)}>{sortOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
      {hasFilters && <button type="button" onClick={clearFilters} className="rounded text-sm font-medium text-teal-800 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:text-teal-200">Clear filters</button>}
    </div>

    {query.isPending ? <div role="status" aria-label="Loading quizzes" className="space-y-3">{[1, 2, 3, 4].map((row) => <div key={row} className="h-16 animate-pulse rounded-lg border border-line bg-slate-100 dark:border-slate-700 dark:bg-slate-900" />)}</div>
      : query.isError ? <div role="alert" className="surface-card flex flex-wrap items-center justify-between gap-3 p-5"><div><h2 className="text-sm font-semibold">Could not load quizzes</h2><p className="mt-1 text-sm text-muted">Please try again.</p></div><Button onClick={() => void query.refetch()} disabled={query.isFetching}>Retry</Button></div>
        : query.data.meta.total === 0 && !hasFilters ? <div className="surface-card py-10"><div className="flex min-h-48 flex-col items-center justify-center px-6 text-center"><span className="mb-4 grid size-12 place-items-center rounded-xl bg-[#E9F5F3] text-teal-700 dark:bg-teal-950 dark:text-teal-200"><ClipboardList aria-hidden="true" className="size-6" /></span><h2 className="text-sm font-semibold">No quizzes yet</h2><p className="mt-1 max-w-sm text-sm text-muted">Add a quiz to test your learners.</p><div className="mt-4 flex flex-col items-center gap-3"><Button variant="primary" className={primaryClass} onClick={(event) => openCreate(event.currentTarget)}><Plus className="size-4" />New quiz</Button><Link to="/courses" className="text-sm font-medium text-teal-800 underline-offset-4 hover:underline dark:text-teal-200">Go to courses</Link></div></div></div>
          : query.data.meta.total === 0 ? <div className="surface-card py-8"><div className="flex min-h-48 flex-col items-center justify-center text-center"><h2 className="text-sm font-semibold">No quizzes match your filters</h2><Button className="mt-4" onClick={clearFilters}>Clear filters</Button></div></div>
            : <>
              <div className="hidden overflow-x-auto rounded-xl border border-line bg-white dark:border-slate-700 dark:bg-slate-900 xl:block"><table className="w-full min-w-[900px] border-collapse text-left"><thead><tr className="border-b border-line text-xs font-medium text-muted dark:border-slate-700"><th className="px-3 py-3">Quiz</th><th className="px-3 py-3">Course</th><th className="px-3 py-3">Questions</th><th className="px-3 py-3">Pass score</th><th className="px-3 py-3">Results</th><th className="px-3 py-3"><span className="sr-only">Actions</span></th></tr></thead><tbody>{rows.map((quiz) => <QuizRow key={quiz.id} quiz={quiz} table global courseTitle={quiz.course?.title ?? '—'} onDelete={(trigger) => { focusTarget.current = trigger; setDeleting(quiz); }} />)}</tbody></table></div>
              <QuizList className="xl:hidden">{rows.map((quiz) => <QuizRow key={quiz.id} quiz={quiz} global showCourse courseTitle={quiz.course?.title ?? '—'} onDelete={(trigger) => { focusTarget.current = trigger; setDeleting(quiz); }} />)}</QuizList>
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300"><p>Showing {query.data.meta.total === 0 ? 0 : (page - 1) * limit + 1}–{Math.min(page * limit, query.data.meta.total)} of {query.data.meta.total}</p><div className="flex items-center gap-2"><label htmlFor="quiz-page-size" className="text-xs">Rows per page</label><select id="quiz-page-size" className="field h-9 w-20" value={limit} onChange={(event) => setParam('limit', event.target.value)}>{[20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select><Button size="sm" disabled={page <= 1} onClick={() => setParam('page', String(page - 1))}>Previous</Button><span>Page {page} of {Math.max(1, Math.ceil(query.data.meta.total / limit))}</span><Button size="sm" disabled={page >= Math.ceil(query.data.meta.total / limit)} onClick={() => setParam('page', String(page + 1))}>Next</Button></div></div>
            </>}
    {creating && <NewQuizDialog onClose={() => { setCreating(false); restoreFocus(); }} onCreated={() => { setCreating(false); void client.invalidateQueries({ queryKey: queryKeys.quizzes.all }); }} />}
    <ConfirmDialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open && !remove.isPending) { setDeleting(null); restoreFocus(); } }} title="Delete quiz?" description={`Delete “${deleting?.title ?? ''}”? All attempts and results for this quiz will also be deleted. This cannot be undone.`} confirmLabel="Delete quiz" destructive busy={remove.isPending} onConfirm={() => { if (deleting) remove.mutate(deleting.id); }} />
  </div>;
}
