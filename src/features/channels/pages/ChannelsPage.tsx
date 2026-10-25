import { useEffect, useState } from 'react';
import { ChevronDown, MessageCircle } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { useCourses } from '@/features/courses/hooks';
import { ChannelPanel } from '@/features/courses/pages/CourseEditorPage';

export function ChannelsPage() {
  const courses = useCourses({ page: 1, limit: 100 });
  const [courseId, setCourseId] = useState('');
  useEffect(() => { if (!courseId && courses.data?.data[0]) setCourseId(courses.data.data[0].id); }, [courseId, courses.data]);

  return <>
    <PageHeader eyebrow="Community" title="Channels" description="Share updates with learners enrolled in a course." />
    <div className="mb-5 max-w-md"><label className="field-label" htmlFor="channel-course">Choose a course</label><div className="relative"><select id="channel-course" className="field appearance-none pr-8" value={courseId} onChange={(event) => setCourseId(event.target.value)}><option value="">Select a course</option>{(courses.data?.data ?? []).map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" /></div>{courses.isError && <p role="alert" className="mt-2 text-xs text-red-600">Could not load your courses.</p>}</div>
    {courseId ? <ChannelPanel courseId={courseId} /> : courses.isLoading ? <div className="h-72 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900" /> : <div className="surface-card"><EmptyState title="No courses available" description="Create a course before sending a channel update." action={<MessageCircle className="size-4 text-accent" />} /></div>}
  </>;
}
