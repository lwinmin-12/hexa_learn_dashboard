import { useDeferredValue, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { CourseCover } from '@/components/common/CourseCover';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Modal } from '@/components/common/Modal';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusPill } from '@/components/common/StatusPill';
import { useToast } from '@/app/toast-context';
import { formatDate } from '@/lib/utils';
import type { CourseStatus } from '@/lib/domain';
import { CourseForm, type CourseFormValues } from '../components/CourseForm';
import { type CourseListItem } from '../api';
import { useCourses, useDeleteCourse, useSaveCourse } from '../hooks';

const PAGE_SIZE = 10;

export function CoursesPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [status, setStatus] = useState('');
  const [premium, setPremium] = useState('');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());
  useEffect(() => setSearch(searchParams.get('search') ?? ''), [searchParams]);
  const [newOpen, setNewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CourseListItem | null>(null);
  const toast = useToast();
  const filters = { page, limit: PAGE_SIZE, ...(status ? { status } : {}), ...(premium ? { isPremium: premium === 'premium' } : {}), ...(deferredSearch ? { search: deferredSearch } : {}) };
  const courses = useCourses(filters);
  const createCourse = useSaveCourse(null);
  const removeCourse = useDeleteCourse();
  const total = courses.data?.meta.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function create(values: CourseFormValues) {
    try {
      await createCourse.mutateAsync(values);
      setNewOpen(false);
      toast('Course created.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not create course.', 'error');
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    try {
      await removeCourse.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      toast('Course deleted.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not delete course.', 'error');
    }
  }

  const columns: Column<CourseListItem>[] = [
    { key: 'course', header: 'Course', className: 'min-w-[280px]', render: (course) => <Link to={`/courses/${course.id}`} className="flex min-w-0 items-center gap-3"><CourseCover compact course={course} /><span className="min-w-0"><span className="block truncate font-medium text-ink hover:text-accent dark:text-white">{course.title}</span><span className="mt-1 block truncate text-xs text-muted">{course.slug}</span></span></Link> },
    { key: 'type', header: 'Type', render: (course) => <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${course.isPremium ? 'bg-[#F8EFE2] text-[#94682E]' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{course.isPremium ? 'Premium' : 'Free'}</span> },
    { key: 'status', header: 'Status', render: (course) => <StatusPill status={course.status} /> },
    { key: 'chapters', header: 'Chapters', render: (course) => <span className="text-xs text-slate-600 dark:text-slate-300">{course.chapterCount ?? '—'}</span> },
    { key: 'learners', header: 'Learners', render: (course) => <span className="text-xs text-slate-600 dark:text-slate-300">{course.learnerCount?.toLocaleString() ?? '—'}</span> },
    { key: 'updated', header: 'Created', render: (course) => <span className="whitespace-nowrap text-xs text-muted">{formatDate(course.createdAt ?? course.updatedAt)}</span> },
    { key: 'actions', header: '', className: 'w-12 text-right', render: (course) => <DropdownMenu.Root><DropdownMenu.Trigger asChild><button className="rounded-lg p-2 text-muted hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={`Actions for ${course.title}`}><MoreHorizontal className="size-4" /></button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="end" className="z-30 min-w-40 rounded-xl border border-line bg-white p-1 shadow-card dark:border-slate-700 dark:bg-slate-900"><DropdownMenu.Item asChild><Link to={`/courses/${course.id}`} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs text-ink outline-none hover:bg-slate-50 dark:text-white dark:hover:bg-slate-800"><Pencil className="size-3.5" />Edit course</Link></DropdownMenu.Item><DropdownMenu.Separator className="my-1 h-px bg-line dark:bg-slate-700" /><DropdownMenu.Item onSelect={() => setDeleteTarget(course)} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-600 outline-none hover:bg-red-50"><Trash2 className="size-3.5" />Delete</DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root> },
  ];

  return <>
    <PageHeader eyebrow="Content library" title="Courses" description="Create and manage the learning experiences your community sees." action={<Button variant="primary" onClick={() => setNewOpen(true)}><Plus className="size-4" />New course</Button>} />
    <div className="mb-4 flex flex-wrap items-center gap-2.5"><div className="relative min-w-48 flex-1 sm:max-w-sm"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><label htmlFor="course-search" className="sr-only">Search courses</label><input id="course-search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search courses" className="field pl-9" /></div>
      <div className="relative"><label className="sr-only" htmlFor="course-status-filter">Filter by status</label><select id="course-status-filter" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="field w-auto min-w-32 appearance-none pr-8 text-xs"><option value="">All statuses</option>{(['published', 'scheduled', 'draft'] satisfies CourseStatus[]).map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" /></div>
      <div className="relative"><label className="sr-only" htmlFor="course-type-filter">Filter by price</label><select id="course-type-filter" value={premium} onChange={(event) => { setPremium(event.target.value); setPage(1); }} className="field w-auto min-w-32 appearance-none pr-8 text-xs"><option value="">All course types</option><option value="free">Free</option><option value="premium">Premium</option></select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" /></div>
      <span className="ml-auto text-xs text-muted">{courses.data?.meta.total ?? '—'} courses</span></div>
    {courses.isError && <div role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{courses.error.message || 'Could not load courses.'}</div>}
    <DataTable rows={courses.data?.data ?? []} columns={columns} loading={courses.isLoading} emptyTitle="No courses found" emptyDescription={deferredSearch ? 'Try a different search or clear the filters.' : 'Create your first course to start building your library.'} page={page} pages={pages} onPageChange={setPage} />
    <Modal open={newOpen} onOpenChange={setNewOpen} title="Create a course" description="Start with the course details. You can add chapters and lessons next."><CourseForm onSave={(values) => void create(values)} onCancel={() => setNewOpen(false)} saving={createCourse.isPending} /></Modal>
    <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)} title="Delete this course?" description={`This will permanently remove ${deleteTarget?.title ?? 'the course'} and its learning content.`} confirmLabel="Delete course" destructive busy={removeCourse.isPending} onConfirm={() => void remove()} />
  </>;
}
