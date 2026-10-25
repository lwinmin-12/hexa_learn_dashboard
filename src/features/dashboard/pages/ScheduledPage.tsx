import { CalendarClock, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusPill } from '@/components/common/StatusPill';
import { useScheduledContent } from '../hooks';
import { formatDate } from '@/lib/utils';

export function ScheduledPage() {
  const query = useScheduledContent(1, 100);
  return <>
    <PageHeader eyebrow="Publishing" title="Scheduled content" description="Courses and episodes set to publish in the future." />
    {query.isError && <div role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">Could not load scheduled content.</div>}
    {query.isLoading ? <div className="h-60 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900" /> : query.data?.data.length ? <div className="surface-card overflow-hidden"><div className="divide-y divide-line dark:divide-slate-800">{query.data.data.map((item) => <article key={`${item.type}-${item.id}`} className="flex items-center gap-4 px-5 py-4"><span className="grid size-10 place-items-center rounded-xl bg-[#E9F5F3] text-accent"><CalendarClock className="size-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.title}</p><p className="mt-1 text-xs text-muted">{item.type === 'course' ? 'Course' : 'Episode'} <span className="mx-1 text-slate-300">·</span><Clock3 className="mr-1 inline size-3" />{formatDate(item.scheduledAt, 'MMMM d, yyyy · h:mm a')}</p></div><StatusPill status="scheduled" />{item.type === 'course' ? <Link to={`/courses/${item.id}`} className="text-xs font-medium text-accent hover:text-teal-700">Edit course</Link> : <Link to="/courses" className="text-xs font-medium text-accent hover:text-teal-700">Find course</Link>}</article>)}</div></div> : <div className="surface-card"><EmptyState title="Nothing scheduled" description="When you schedule a course or episode, it will appear here." /></div>}
  </>;
}
