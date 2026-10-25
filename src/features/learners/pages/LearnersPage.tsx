import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { useCourses } from '@/features/courses/hooks';
import { getCourseLearners } from '@/features/dashboard/api';
import { queryKeys } from '@/lib/query-keys';
import { formatDate } from '@/lib/utils';

type Learner = { id: string; user: { id: string; displayName: string; avatarUrl: string | null }; progressPct: number; enrolledAt: string; lastActivityAt: string | null };

export function LearnersPage() {
  const courses = useCourses({ page: 1, limit: 100 });
  const [courseId, setCourseId] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => { if (!courseId && courses.data?.data[0]) setCourseId(courses.data.data[0].id); }, [courseId, courses.data]);
  const learners = useQuery({ queryKey: queryKeys.courses.learners(courseId), queryFn: () => getCourseLearners(courseId, 1, 100), enabled: Boolean(courseId) });
  const filtered = useMemo(() => (learners.data?.data ?? []).filter((item) => item.user.displayName.toLowerCase().includes(search.toLowerCase())), [learners.data, search]);
  const columns: Column<Learner>[] = [
    { key: 'learner', header: 'Learner', render: (item) => <div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-full bg-[#E9F5F3] text-xs font-semibold text-accent">{item.user.displayName[0]}</span><span className="text-xs font-medium">{item.user.displayName}</span></div> },
    { key: 'progress', header: 'Progress', render: (item) => <div className="flex min-w-32 items-center gap-2"><div className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-accent" style={{ width: `${item.progressPct}%` }} /></div><span className="w-8 text-right text-[11px] text-muted">{Math.round(item.progressPct)}%</span></div> },
    { key: 'enrolled', header: 'Enrolled', render: (item) => <span className="text-xs text-muted">{formatDate(item.enrolledAt)}</span> },
    { key: 'activity', header: 'Last activity', render: (item) => <span className="text-xs text-muted">{formatDate(item.lastActivityAt)}</span> },
  ];

  return <>
    <PageHeader eyebrow="Learner success" title="Learners" description="Follow enrollment progress across your courses." />
    <div className="mb-4 flex flex-wrap items-end gap-3"><div className="w-full max-w-md"><label className="field-label" htmlFor="learners-course">Course</label><div className="relative"><select id="learners-course" className="field appearance-none pr-8" value={courseId} onChange={(event) => setCourseId(event.target.value)}><option value="">Select a course</option>{(courses.data?.data ?? []).map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" /></div></div><div className="relative w-full max-w-xs"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><label htmlFor="learner-search" className="sr-only">Search learners</label><input id="learner-search" className="field pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search learners" /></div><span className="ml-auto pb-2 text-xs text-muted">{filtered.length} learners</span></div>
    {courses.isError && <div role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">Could not load your courses.</div>}
    {learners.isError && <div role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">Could not load learners for this course.</div>}
    <DataTable rows={filtered} columns={columns} loading={courses.isLoading || learners.isLoading} emptyTitle={search ? 'No matching learners' : 'No learners yet'} emptyDescription={search ? 'Try another name.' : 'Learner enrollments will appear here.'} />
  </>;
}
