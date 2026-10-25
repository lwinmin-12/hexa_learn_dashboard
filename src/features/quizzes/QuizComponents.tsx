import { useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { BookOpen, FileQuestion, Layers, MoreHorizontal, Video } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { useToast } from '@/app/toast-context';
import { getAllCourses, getCourse } from '@/features/courses/api';
import type { Course } from '@/lib/domain';
import { messageFromError } from '@/lib/utils';
import { queryKeys } from '@/lib/query-keys';
import { createCourseQuiz, type QuizListItem } from './courseQuizApi';

type Attachment = { scope: 'course' } | { scope: 'chapter'; chapterId: string } | { scope: 'episode'; chapterId: string; episodeId: string };

export function QuizList({ children, className = 'space-y-3' }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function QuizRow({ quiz, courseTitle, onDelete, table = false, showCourse = false, global = false }: { quiz: QuizListItem; courseTitle?: string; onDelete: (trigger: HTMLElement | null) => void; table?: boolean; showCourse?: boolean; global?: boolean }) {
  const menuButton = useState<HTMLButtonElement | null>(null);
  const Icon = quiz.scope === 'course' ? BookOpen : quiz.scope === 'chapter' ? Layers : Video;
  const attachment = quiz.scope === 'course' ? 'Course' : quiz.scope === 'chapter' ? `${global ? 'Chapter: ' : 'Chapter'}${global ? quiz.attachedTo.title : ''}` : `Lesson: ${quiz.attachedTo.title}`;
  const action = quiz.questionCount === 0 ? 'Add questions' : 'Edit';
  const link = <Link to={`/quizzes/${quiz.id}`} className="outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:ring-2 focus-visible:ring-teal-700" aria-label={`${action} ${quiz.title}`}>{quiz.title}</Link>;
  const attachmentChip = <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-200"><Icon aria-hidden="true" className="size-3 shrink-0" />{attachment}</span>;
  const questions = <span>{quiz.questionCount} {quiz.questionCount === 1 ? 'question' : 'questions'} · {quiz.totalPoints} {quiz.totalPoints === 1 ? 'point' : 'points'}</span>;
  const results = quiz.attemptCount === 0 ? <span className="text-slate-500">No attempts yet</span> : <div><span>{quiz.attemptCount} {quiz.attemptCount === 1 ? 'attempt' : 'attempts'}</span>{quiz.passRate !== null && <div className="mt-1 flex items-center gap-2"><div role="progressbar" aria-label={`Pass rate for ${quiz.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={quiz.passRate} className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full bg-teal-700" style={{ width: `${Math.max(0, Math.min(100, quiz.passRate))}%` }} /></div><span>{Math.round(quiz.passRate)}%</span></div>}</div>;
  return table ? <tr className="relative border-b border-line text-sm hover:bg-slate-50/80 dark:border-slate-700 dark:hover:bg-slate-800/50">
    <td className="px-3 py-4"><div className="min-w-48"><div className="font-semibold">{link}</div><div className="mt-1 flex flex-wrap gap-1.5">{attachmentChip}{quiz.questionCount === 0 && <><span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200"><FileQuestion className="size-3" />No questions yet</span><span className="text-xs font-medium text-teal-800 dark:text-teal-200">Add questions</span></>}</div></div></td>
    <td className="px-3 py-4 text-slate-600 dark:text-slate-300">{courseTitle ?? quiz.course?.title ?? '—'}</td><td className="px-3 py-4 text-slate-600 dark:text-slate-300">{questions}</td><td className="px-3 py-4 text-slate-600 dark:text-slate-300">{quiz.passScore}</td><td className="px-3 py-4 text-slate-600 dark:text-slate-300">{results}</td><td className="relative z-10 px-3 py-4"><Actions quiz={quiz} menuButton={menuButton[0]} setMenuButton={menuButton[1]} onDelete={onDelete} global={global} /></td>
  </tr> : <article className="relative flex min-h-16 flex-wrap items-center gap-4 rounded-xl border border-line bg-white p-4 transition hover:bg-[#F7F8F8] focus-within:ring-2 focus-within:ring-teal-700 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
    <div className="min-w-0 flex-1 pr-10"><div className="flex flex-wrap items-center gap-2"><h4 className="break-words text-sm font-semibold">{link}</h4>{attachmentChip}{quiz.questionCount === 0 && <><span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200"><FileQuestion className="size-3" />No questions yet</span><span className="text-xs font-medium text-teal-800 dark:text-teal-200">Add questions</span></>}</div><p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{showCourse && `${courseTitle ?? quiz.course?.title ?? ''} · `}{questions} · Pass at {quiz.passScore}</p><div className="mt-2 text-xs text-slate-600 dark:text-slate-300">{results}{quiz.averageScore !== null && <p className="mt-1">Average score {Number(quiz.averageScore.toFixed(1))}</p>}</div></div><div className="absolute right-3 top-3 z-10"><Actions quiz={quiz} menuButton={menuButton[0]} setMenuButton={menuButton[1]} onDelete={onDelete} global={global} /></div>
  </article>;
}

function Actions({ quiz, menuButton, setMenuButton, onDelete, global }: { quiz: QuizListItem; menuButton: HTMLButtonElement | null; setMenuButton: (value: HTMLButtonElement | null) => void; onDelete: (trigger: HTMLElement | null) => void; global: boolean }) {
  return <DropdownMenu.Root><DropdownMenu.Trigger asChild><button ref={setMenuButton} type="button" title={`Quiz actions for ${quiz.title}`} aria-label={`Quiz actions for ${quiz.title}`} className="relative rounded-lg p-2 text-slate-600 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-teal-700 dark:text-slate-300 dark:hover:bg-slate-700"><MoreHorizontal aria-hidden="true" className="size-4" /></button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={5} className="z-40 min-w-36 rounded-lg border border-line bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"><DropdownMenu.Item asChild><Link to={`/quizzes/${quiz.id}`} className="block rounded px-3 py-2 text-sm outline-none focus:bg-slate-100 dark:focus:bg-slate-800">{global ? 'Open' : 'Edit'}</Link></DropdownMenu.Item>{global && quiz.course && <DropdownMenu.Item asChild><Link to={`/courses/${quiz.course.id}`} className="block rounded px-3 py-2 text-sm outline-none focus:bg-slate-100 dark:focus:bg-slate-800">Go to course</Link></DropdownMenu.Item>}<DropdownMenu.Separator className="my-1 h-px bg-line dark:bg-slate-700" /><DropdownMenu.Item onSelect={() => onDelete(menuButton)} className="cursor-pointer rounded px-3 py-2 text-sm text-red-700 outline-none focus:bg-red-50 dark:text-red-300 dark:focus:bg-red-950">Delete</DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>;
}

export function NewQuizDialog({ course, onClose, onCreated }: { course?: Course; onClose: () => void; onCreated: () => void }) {
  const coursesQuery = useQuery({ queryKey: queryKeys.courses.all, queryFn: getAllCourses, enabled: !course });
  const [selectedCourseId, setSelectedCourseId] = useState(course?.id ?? '');
  const [courseSearch, setCourseSearch] = useState('');
  const selectedCourse = course ?? coursesQuery.data?.find((item) => item.id === selectedCourseId);
  const courseDetail = useQuery({ queryKey: ['courses', selectedCourseId], queryFn: () => getCourse(selectedCourseId), enabled: Boolean(selectedCourseId) && !course });
  const details = course ?? courseDetail.data;
  const chapters = details?.chapters ?? [];
  const [title, setTitle] = useState('');
  const [attachment, setAttachment] = useState<Attachment>({ scope: 'course' });
  const [passScore, setPassScore] = useState('1');
  const [timeLimit, setTimeLimit] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const toast = useToast();
  const selectedChapter = attachment.scope === 'course' ? undefined : chapters.find((chapter) => chapter.id === attachment.chapterId);
  const validAttachment = attachment.scope === 'course' || (attachment.scope === 'chapter' ? Boolean(selectedChapter) : Boolean(selectedChapter?.episodes.some((episode) => episode.id === attachment.episodeId)));
  const valid = Boolean(selectedCourse) && title.trim().length >= 2 && title.trim().length <= 120 && validAttachment && passScore !== '' && Number.isInteger(Number(passScore)) && Number(passScore) >= 0 && (timeLimit === '' || (Number.isInteger(Number(timeLimit)) && Number(timeLimit) > 0));
  const create = useMutation({
    mutationFn: () => {
      const target = attachment.scope === 'course' ? { courseId: selectedCourse!.id } : attachment.scope === 'chapter' ? { chapterId: attachment.chapterId } : { episodeId: attachment.episodeId };
      return createCourseQuiz({ title: title.trim(), passScore: Number(passScore), timeLimitSec: timeLimit === '' ? null : Number(timeLimit) * 60, ...target });
    },
    onSuccess: (quiz) => { toast('Quiz created.'); onCreated(); navigate(`/quizzes/${quiz.id}`); },
    onError: (cause) => { const message = messageFromError(cause); setError(message); toast(message, 'error'); },
  });
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (valid && !create.isPending) { setError(null); create.mutate(); } }
  return <Modal open onOpenChange={(open) => { if (!open && !create.isPending) onClose(); }} title="New quiz" description="Choose a course and where learners will take this quiz." className="max-w-lg"><form onSubmit={submit} className="space-y-5">
    {!course && <div><label htmlFor="new-quiz-course" className="field-label">Course</label><input id="new-quiz-course" className="field" list="quiz-course-options" required value={courseSearch} placeholder="Search courses" onChange={(event) => { setCourseSearch(event.target.value); const match = coursesQuery.data?.find((item) => item.title === event.target.value); setSelectedCourseId(match?.id ?? ''); setAttachment({ scope: 'course' }); }} /><datalist id="quiz-course-options">{coursesQuery.data?.map((item) => <option key={item.id} value={item.title} />)}</datalist>{coursesQuery.isError && <p role="alert" className="text-sm text-red-700">Could not load courses. Please try again.</p>}</div>}
    <div><label htmlFor="new-quiz-title" className="field-label">Title</label><input autoFocus={Boolean(course)} id="new-quiz-title" className="field" required minLength={2} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="For example, Hiragana review" disabled={create.isPending} /></div>
    <fieldset disabled={create.isPending || !selectedCourse}><legend className="field-label">Attach to</legend><div className="flex rounded-lg border border-line p-1 dark:border-slate-700">{[{ value: 'course', label: 'Whole course' }, { value: 'chapter', label: 'Chapter' }, { value: 'episode', label: 'Lesson' }].map((item) => <label key={item.value} className={`relative flex-1 cursor-pointer rounded-md px-2 py-2 text-center text-xs font-medium ${attachment.scope === item.value ? 'bg-teal-700 text-white' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}`}><input type="radio" name="new-quiz-attachment" className="peer sr-only" checked={attachment.scope === item.value} onChange={() => { if (item.value === 'course') setAttachment({ scope: 'course' }); else if (item.value === 'chapter') setAttachment({ scope: 'chapter', chapterId: '' }); else setAttachment({ scope: 'episode', chapterId: '', episodeId: '' }); }} /><span className="pointer-events-none absolute inset-0 rounded-md peer-focus-visible:ring-2 peer-focus-visible:ring-teal-700 peer-focus-visible:ring-offset-2" />{item.label}</label>)}</div></fieldset>
    {attachment.scope !== 'course' && <div><label htmlFor="new-quiz-chapter" className="field-label">Chapter</label><select id="new-quiz-chapter" className="field" required disabled={create.isPending || courseDetail.isFetching || !chapters.length} value={attachment.chapterId} onChange={(event) => setAttachment(attachment.scope === 'chapter' ? { scope: 'chapter', chapterId: event.target.value } : { scope: 'episode', chapterId: event.target.value, episodeId: '' })}><option value="">Choose a chapter</option>{chapters.map((chapter, index) => <option key={chapter.id} value={chapter.id}>Chapter {index + 1}: {chapter.title}</option>)}</select></div>}
    {attachment.scope === 'episode' && <div><label htmlFor="new-quiz-lesson" className="field-label">Lesson</label><select id="new-quiz-lesson" className="field" required disabled={create.isPending || !selectedChapter?.episodes.length} value={attachment.episodeId} onChange={(event) => setAttachment({ scope: 'episode', chapterId: attachment.chapterId, episodeId: event.target.value })}><option value="">Choose a lesson</option>{selectedChapter?.episodes.map((episode) => <option key={episode.id} value={episode.id}>{episode.title}</option>)}</select></div>}
    <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="new-quiz-pass-score" className="field-label">Pass score (points)</label><input id="new-quiz-pass-score" className="field" type="number" required min={0} step={1} value={passScore} disabled={create.isPending} onChange={(event) => setPassScore(event.target.value)} /></div><div><label htmlFor="new-quiz-time-limit" className="field-label">Time limit (minutes)</label><input id="new-quiz-time-limit" className="field" type="number" min={1} step={1} placeholder="No limit" value={timeLimit} disabled={create.isPending} onChange={(event) => setTimeLimit(event.target.value)} /></div></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
    <div className="flex justify-end gap-2 border-t border-line pt-4 dark:border-slate-700"><Button type="button" onClick={onClose} disabled={create.isPending}>Cancel</Button><Button type="submit" variant="primary" className="bg-teal-700 hover:bg-teal-800" disabled={!valid || create.isPending}>{create.isPending ? 'Creating…' : 'Create quiz'}</Button></div>
  </form></Modal>;
}
