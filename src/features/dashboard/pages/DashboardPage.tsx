import { useState } from 'react';
import { addDays, differenceInCalendarDays, endOfDay, format, startOfDay, subDays } from 'date-fns';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CalendarClock, CircleAlert, GraduationCap, MoreHorizontal, Wallet } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusPill } from '@/components/common/StatusPill';
import { Button } from '@/components/common/Button';
import { CourseCover } from '@/components/common/CourseCover';
import { EmptyState } from '@/components/common/EmptyState';
import { useRevenue, useScheduledContent, useSummary, useTopCourses } from '../hooks';
import { usePayments } from '@/features/payments/hooks';
import { formatCurrency, formatDate } from '@/lib/utils';

export function DashboardPage() {
  const [from, setFrom] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const summary = useSummary();
  const revenue = useRevenue(startOfDay(new Date(`${from}T00:00:00`)).toISOString(), endOfDay(new Date(`${to}T00:00:00`)).toISOString());
  const topCourses = useTopCourses();
  const scheduled = useScheduledContent(1, 5);
  const pending = usePayments({ page: 1, limit: 5, status: 'slip_uploaded' });

  function updateFrom(value: string) {
    if (!value) return;
    const nextFrom = new Date(`${value}T00:00:00`);
    const currentTo = new Date(`${to}T00:00:00`);
    setFrom(value);
    if (value > to) setTo(value);
    else if (differenceInCalendarDays(currentTo, nextFrom) > 365) setTo(format(addDays(nextFrom, 365), 'yyyy-MM-dd'));
  }

  function updateTo(value: string) {
    if (!value) return;
    const nextTo = new Date(`${value}T00:00:00`);
    const currentFrom = new Date(`${from}T00:00:00`);
    setTo(value);
    if (value < from) setFrom(value);
    else if (differenceInCalendarDays(nextTo, currentFrom) > 365) setFrom(format(subDays(nextTo, 365), 'yyyy-MM-dd'));
  }

  const stats = [
    { title: 'Total learners', value: summary.data?.totalLearners.toLocaleString() ?? '—', hint: 'Across your courses', icon: GraduationCap, accent: 'bg-[#E8F4F1] text-[#148777]' },
    { title: 'Active courses', value: summary.data?.totalCourses.toLocaleString() ?? '—', hint: 'Published and in progress', icon: BookOpen, accent: 'bg-[#EEF1F8] text-[#657CA8]' },
    { title: 'Total revenue', value: summary.data ? Number(summary.data.totalRevenue).toLocaleString() : '—', hint: 'API total, no currency conversion', icon: Wallet, accent: 'bg-[#F8EFE2] text-[#A87836]' },
    { title: 'Pending payments', value: summary.data?.pendingPayments.toLocaleString() ?? '—', hint: 'Slips waiting for review', icon: CircleAlert, accent: 'bg-[#F9EDEE] text-[#B46B71]' },
  ];

  return <>
    <PageHeader eyebrow={format(new Date(), 'EEEE, MMMM d')} title="Good morning" description="Here's what's happening across your learning community today." action={<Link to="/courses"><Button variant="primary"><BookOpen className="size-4" />Manage courses</Button></Link>} />
    {summary.isError && <InlineError message="We couldn't load dashboard totals." />}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Platform summary">{stats.map(({ title, value, hint, icon: Icon, accent }) => <div key={title} className="surface-card p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-muted">{title}</p><p className="mt-2 text-[26px] font-semibold tracking-[-0.04em] text-ink dark:text-white">{summary.isLoading ? <span className="inline-block h-7 w-20 animate-pulse rounded bg-slate-100 dark:bg-slate-800" /> : value}</p></div><span className={`grid size-9 place-items-center rounded-xl ${accent}`}><Icon className="size-[17px]" strokeWidth={1.7} /></span></div><p className="mt-4 text-[11px] text-slate-400">{hint}</p></div>)}</section>

    <section className="surface-card mt-5 p-5 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-sm font-semibold text-ink dark:text-white">Revenue</h2><p className="mt-1 text-xs text-muted">Approved payments over time</p></div><div className="flex items-center gap-2"><label className="sr-only" htmlFor="revenue-from">From date</label><input id="revenue-from" type="date" value={from} max={to} onChange={(event) => updateFrom(event.target.value)} className="h-8 rounded-lg border border-line bg-white px-2 text-xs text-muted outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-900" /><span className="text-xs text-slate-400">to</span><label className="sr-only" htmlFor="revenue-to">To date</label><input id="revenue-to" type="date" value={to} min={from} max={format(new Date(), 'yyyy-MM-dd')} onChange={(event) => updateTo(event.target.value)} className="h-8 rounded-lg border border-line bg-white px-2 text-xs text-muted outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-900" /></div></div>
      <div className="h-[250px] w-full">{revenue.isLoading ? <div className="h-full animate-pulse rounded-lg bg-slate-50 dark:bg-slate-800/50" /> : revenue.isError ? <InlineError message="Revenue data is temporarily unavailable." /> : revenue.data?.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={revenue.data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}><CartesianGrid stroke="#EDF0F0" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="date" tickFormatter={(date: string) => format(new Date(`${date}T00:00:00`), 'MMM d')} tickLine={false} axisLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} minTickGap={28} /><YAxis tickFormatter={(value: number) => `${Math.round(value / 100) / 10}k`} tickLine={false} axisLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} width={42} /><Tooltip labelFormatter={(date) => format(new Date(`${String(date)}T00:00:00`), 'MMMM d, yyyy')} formatter={(value) => [Number(value).toLocaleString(), 'Revenue']} contentStyle={{ border: '1px solid #E6E8E8', borderRadius: 10, boxShadow: '0 4px 14px rgba(16,24,40,.06)', fontSize: 12 }} /><Line type="monotone" dataKey="revenue" stroke="#0F9D8A" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#0F9D8A', stroke: '#fff', strokeWidth: 2 }} /></LineChart></ResponsiveContainer> : <EmptyState title="No revenue in this date range" description="Approved payments will appear here." />}</div>
      {revenue.isError && <p className="mt-2 text-xs text-red-600">{revenue.error instanceof Error ? revenue.error.message : 'Could not load revenue.'}</p>}
    </section>

    <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="surface-card"><div className="flex items-center justify-between border-b border-line px-5 py-4 dark:border-slate-800"><div><h2 className="text-sm font-semibold text-ink dark:text-white">Pending payments</h2><p className="mt-1 text-xs text-muted">Review recent payment slips</p></div><Link className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-teal-700" to="/payments">View all <ArrowRight className="size-3.5" /></Link></div>
        {pending.isLoading ? <div className="space-y-4 p-5">{[1, 2, 3].map((item) => <div key={item} className="h-10 animate-pulse rounded bg-slate-50 dark:bg-slate-800/50" />)}</div> : pending.isError ? <InlineError message="Payments are unavailable right now." /> : pending.data?.data.length ? <div className="divide-y divide-line dark:divide-slate-800">{pending.data.data.map((payment) => <Link to="/payments" key={payment.id} className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"><div className="min-w-0"><p className="truncate text-sm font-medium text-ink dark:text-white">{payment.user.displayName}</p><p className="mt-1 truncate text-xs text-muted">{payment.course.title}</p></div><div className="shrink-0 text-right"><p className="text-sm font-semibold text-ink dark:text-white">{formatCurrency(payment.finalAmount, payment.course.currency)}</p><div className="mt-1"><StatusPill status={payment.status} label="Needs review" /></div></div></Link>)}</div> : <EmptyState title="All caught up" description="No payment slips are waiting for review." />}
      </section>

      <section className="surface-card"><div className="flex items-center justify-between border-b border-line px-5 py-4 dark:border-slate-800"><div><h2 className="text-sm font-semibold text-ink dark:text-white">Top courses</h2><p className="mt-1 text-xs text-muted">By learner enrollment</p></div><MoreHorizontal className="size-4 text-slate-400" /></div>
        {topCourses.isLoading ? <div className="space-y-3 p-5">{[1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded bg-slate-50 dark:bg-slate-800/50" />)}</div> : topCourses.isError ? <InlineError message="Top courses are unavailable right now." /> : topCourses.data?.length ? <div className="divide-y divide-line dark:divide-slate-800">{topCourses.data.slice(0, 4).map((course, index) => <Link to={`/courses/${course.courseId}`} key={course.courseId} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"><span className="w-4 text-xs font-medium text-slate-400">0{index + 1}</span><CourseCover compact course={{ id: course.courseId, title: course.title, coverUrl: null }} /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-ink dark:text-white">{course.title}</span><span className="mt-1 block text-[11px] text-muted">{course.enrollmentCount.toLocaleString()} learners</span></span><span className="hidden text-right sm:block"><span className="block text-xs font-semibold text-ink dark:text-white">{Number(course.revenue).toLocaleString()}</span><span className="mt-1 block text-[10px] text-slate-400">revenue</span></span></Link>)}</div> : <EmptyState title="No course activity yet" description="Learner enrollments will appear here." />}
      </section>
    </div>

    <section className="surface-card mt-5"><div className="flex items-center justify-between border-b border-line px-5 py-4 dark:border-slate-800"><div><h2 className="text-sm font-semibold text-ink dark:text-white">Upcoming scheduled content</h2><p className="mt-1 text-xs text-muted">What's publishing next</p></div><Link to="/scheduled" className="inline-flex items-center gap-1 text-xs font-medium text-accent">Open calendar <ArrowRight className="size-3.5" /></Link></div>
      {scheduled.isLoading ? <div className="space-y-3 p-5">{[1, 2].map((item) => <div key={item} className="h-11 animate-pulse rounded bg-slate-50 dark:bg-slate-800/50" />)}</div> : scheduled.isError ? <InlineError message="Scheduled content is unavailable right now." /> : scheduled.data?.data.length ? <div className="divide-y divide-line dark:divide-slate-800">{scheduled.data.data.map((item) => <div key={item.id} className="flex items-center gap-3 px-5 py-4"><span className="grid size-9 place-items-center rounded-lg bg-[#F1F5F4] text-accent dark:bg-slate-800"><CalendarClock className="size-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink dark:text-white">{item.title}</p><p className="mt-1 text-xs text-muted">{item.type === 'course' ? 'Course' : 'Episode'} <span className="mx-1 text-slate-300">·</span>{formatDate(item.scheduledAt, 'MMM d, h:mm a')}</p></div><StatusPill status="scheduled" /></div>)}</div> : <EmptyState title="Nothing scheduled" description="Scheduled courses and episodes will show up here." />}
    </section>
  </>;
}

function InlineError({ message }: { message: string }) {
  return <div role="alert" className="m-5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">{message}</div>;
}
