import { BookOpen } from 'lucide-react';
import type { Course } from '@/lib/domain';

const colors = ['bg-[#E8F4F1] text-[#35766D]', 'bg-[#F8EFE0] text-[#9A7040]', 'bg-[#E9EEF8] text-[#536C9A]', 'bg-[#F2EAF4] text-[#7E5F8B]'];

export function CourseCover({ course, compact = false }: { course: Pick<Course, 'title' | 'coverUrl' | 'id'>; compact?: boolean }) {
  if (course.coverUrl) return <img src={course.coverUrl} alt={`${course.title} cover`} className={`${compact ? 'size-10' : 'h-36 w-full'} rounded-lg object-cover`} />;
  const index = course.id.charCodeAt(0) % colors.length;
  return <div className={`relative grid place-items-center overflow-hidden rounded-lg ${colors[index]} ${compact ? 'size-10' : 'h-36 w-full'}`} aria-label={`${course.title} cover placeholder`}>
    <div className="absolute right-2 top-1 text-3xl font-medium opacity-20" lang="ja">日本語</div><BookOpen className={compact ? 'size-4' : 'size-8'} strokeWidth={1.5} /><span className="sr-only">{course.title}</span>
  </div>;
}
