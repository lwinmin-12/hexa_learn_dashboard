import { useEffect, useState, type FormEvent } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DndContext, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as Tabs from '@radix-ui/react-tabs';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, FileQuestion, GripVertical, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DataTable, type Column } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { Modal } from '@/components/common/Modal';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusPill } from '@/components/common/StatusPill';
import { useToast } from '@/app/toast-context';
import { useDeleteQuestion, useQuiz, useQuizAttempts, useReorderQuestions, useSaveQuestion, useSaveQuiz } from '../hooks';
import type { Quiz, QuizQuestionInput } from '../api';
import { formatDate, messageFromError } from '@/lib/utils';

const questionSchema = z.object({
  questionText: z.string().trim().min(1, 'Enter the question').max(10000),
  points: z.number().int().min(1),
  explanation: z.string().max(10000),
  options: z.array(z.object({ id: z.string().optional(), optionText: z.string().trim().min(1, 'Enter an option').max(4000), isCorrect: z.boolean() })).min(2, 'Add at least two options').max(6, 'A question can have up to six options.'),
}).superRefine((values, context) => {
  if (!values.options.some((option) => option.isCorrect)) context.addIssue({ code: 'custom', path: ['options'], message: 'Mark at least one correct answer.' });
});
type QuestionValues = z.infer<typeof questionSchema>;

export function QuizBuilderPage() {
  const { id = '' } = useParams();
  const quiz = useQuiz(id);
  const attempts = useQuizAttempts(id);
  const saveQuiz = useSaveQuiz(id);
  const saveQuestion = useSaveQuestion(id);
  const deleteQuestion = useDeleteQuestion(id);
  const reorder = useReorderQuestions(id);
  const toast = useToast();
  const [questionOpen, setQuestionOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Quiz['questions'][number] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Quiz['questions'][number] | null>(null);
  const [title, setTitle] = useState('');
  const [passScore, setPassScore] = useState('70');
  const [timeLimit, setTimeLimit] = useState('');
  useEffect(() => {
    if (!quiz.data) return;
    setTitle(quiz.data.title);
    setPassScore(String(quiz.data.passScore));
    setTimeLimit(quiz.data.timeLimitSec ? String(quiz.data.timeLimitSec) : '');
  }, [quiz.data]);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try { await saveQuiz.mutateAsync({ title: title.trim(), passScore: Number(passScore), timeLimitSec: timeLimit ? Number(timeLimit) : null }); toast('Quiz settings saved.'); }
    catch (error) { toast(messageFromError(error), 'error'); }
  }

  function onReorder(event: DragEndEvent) {
    const questions = quiz.data?.questions ?? [];
    if (!event.over || event.active.id === event.over.id) return;
    const from = questions.findIndex((question) => question.id === event.active.id);
    const to = questions.findIndex((question) => question.id === event.over?.id);
    if (from < 0 || to < 0) return;
    reorder.mutate(arrayMove(questions, from, to).map((question) => question.id), { onError: () => toast('Could not reorder questions. Your changes were restored.', 'error') });
  }

  async function removeQuestion() {
    if (!deleteTarget) return;
    try { await deleteQuestion.mutateAsync(deleteTarget.id); setDeleteTarget(null); toast('Question deleted.'); }
    catch (error) { toast(messageFromError(error), 'error'); }
  }

  if (quiz.isLoading) return <div className="h-80 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />;
  if (quiz.isError || !quiz.data) return <div className="surface-card p-8"><PageHeader title="Quiz unavailable" description="Check the quiz ID or confirm that you have access." action={<Link to="/quizzes"><Button><ArrowLeft className="size-4" />Back to quizzes</Button></Link>} /></div>;
  const currentQuiz = quiz.data;
  const questions = currentQuiz.questions ?? [];

  return <>
    <Link to="/quizzes" className="mb-4 inline-flex items-center gap-2 text-xs font-medium text-muted hover:text-accent"><ArrowLeft className="size-3.5" />Quizzes</Link>
    <PageHeader eyebrow="Quiz builder" title={currentQuiz.title} description={`Attached to ${currentQuiz.courseId ? 'course' : currentQuiz.chapterId ? 'chapter' : currentQuiz.episodeId ? 'episode' : 'content'} · ${currentQuiz.courseId ?? currentQuiz.chapterId ?? currentQuiz.episodeId ?? currentQuiz.id}`} />
    <Tabs.Root defaultValue="questions"><Tabs.List className="mb-5 flex gap-1 border-b border-line dark:border-slate-800" aria-label="Quiz sections"><Tabs.Trigger value="questions" className="inline-flex items-center gap-2 border-b-2 border-transparent px-3 py-3 text-xs font-medium text-muted outline-none data-[state=active]:border-accent data-[state=active]:text-accent"><FileQuestion className="size-3.5" />Questions</Tabs.Trigger><Tabs.Trigger value="attempts" className="border-b-2 border-transparent px-3 py-3 text-xs font-medium text-muted outline-none data-[state=active]:border-accent data-[state=active]:text-accent">Attempts</Tabs.Trigger></Tabs.List>
      <Tabs.Content value="questions" className="space-y-5 focus:outline-none"><form onSubmit={(event) => void saveSettings(event)} className="surface-card grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_150px_180px_auto] md:items-end"><div><label className="field-label" htmlFor="quiz-title-setting">Quiz title</label><input id="quiz-title-setting" className="field" value={title} onChange={(event) => setTitle(event.target.value)} /></div><div><label className="field-label" htmlFor="quiz-pass-score-setting">Pass score</label><input id="quiz-pass-score-setting" type="number" min="0" className="field" value={passScore} onChange={(event) => setPassScore(event.target.value)} /></div><div><label className="field-label" htmlFor="quiz-time-limit-setting">Time limit (seconds)</label><input id="quiz-time-limit-setting" type="number" min="1" className="field" value={timeLimit} onChange={(event) => setTimeLimit(event.target.value)} placeholder="No limit" /></div><Button type="submit" variant="primary" disabled={!title.trim() || saveQuiz.isPending}><Save className="size-4" />Save settings</Button></form>
        <section className="surface-card"><div className="flex items-center justify-between border-b border-line px-5 py-4 dark:border-slate-800"><div><h2 className="text-sm font-semibold">Questions</h2><p className="mt-1 text-xs text-muted">{questions.length} questions <span className="mx-1">·</span> At least one correct answer per question</p></div><Button variant="primary" onClick={() => { setEditTarget(null); setQuestionOpen(true); }}><Plus className="size-4" />Add question</Button></div>
          {questions.length ? <DndContext onDragEnd={onReorder}><SortableContext items={questions.map((question) => question.id)} strategy={verticalListSortingStrategy}><div className="divide-y divide-line dark:divide-slate-800">{questions.map((question, index) => <SortableQuestion key={question.id} question={question} index={index} onEdit={() => { setEditTarget(question); setQuestionOpen(true); }} onDelete={() => setDeleteTarget(question)} />)}</div></SortableContext></DndContext> : <EmptyState title="No questions yet" description="Add a question and its answer options to build your quiz." action={<Button variant="primary" onClick={() => setQuestionOpen(true)}><Plus className="size-4" />Add question</Button>} />}
        </section>
      </Tabs.Content>
      <Tabs.Content value="attempts" className="focus:outline-none"><AttemptsPanel query={attempts} /></Tabs.Content>
    </Tabs.Root>
    <Modal open={questionOpen} onOpenChange={(open) => { setQuestionOpen(open); if (!open) setEditTarget(null); }} title={editTarget ? 'Edit question' : 'New question'} description="Write the question and select one or more correct answers." className="max-w-2xl"><QuestionForm key={editTarget?.id ?? 'new'} question={editTarget} saving={saveQuestion.isPending} onCancel={() => { setQuestionOpen(false); setEditTarget(null); }} onSave={(values, optionIds) => { const input: QuizQuestionInput = values; void saveQuestion.mutateAsync({ id: editTarget?.id ?? null, values: input, existingOptionIds: optionIds }).then(() => { setQuestionOpen(false); setEditTarget(null); toast('Question saved.'); }).catch((error: unknown) => toast(messageFromError(error), 'error')); }} /></Modal>
    <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)} title="Delete this question?" description="This will remove the question and its answer options from the quiz." confirmLabel="Delete question" destructive busy={deleteQuestion.isPending} onConfirm={() => void removeQuestion()} />
  </>;
}

function SortableQuestion({ question, index, onEdit, onDelete }: { question: Quiz['questions'][number]; index: number; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });
  return <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`flex items-start gap-3 px-5 py-4 ${isDragging ? 'bg-slate-50 shadow-md dark:bg-slate-900' : ''}`}><button ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Reorder question ${index + 1}`} className="touch-none rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><GripVertical className="size-4" /></button><div className="min-w-0 flex-1"><p className="text-sm font-medium"><span className="mr-2 text-xs text-slate-400">{String(index + 1).padStart(2, '0')}</span>{question.questionText}</p><div className="mt-3 flex flex-wrap gap-2">{question.options.map((option) => <span key={option.id} className={`rounded-lg px-2.5 py-1.5 text-[11px] ${option.isCorrect ? 'bg-[#E9F5F3] font-medium text-[#0B786A]' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>{option.isCorrect && <Check className="mr-1 inline size-3" />}{option.optionText}</span>)}</div><p className="mt-2 text-[10px] text-muted">{question.points} point{question.points === 1 ? '' : 's'} <span className="mx-1">·</span>{question.options.filter((option) => option.isCorrect).length > 1 ? 'Multiple choice' : 'Single choice'}</p></div><div className="flex shrink-0 gap-1"><Button size="sm" onClick={onEdit}>Edit</Button><button onClick={onDelete} className="rounded-lg p-2 text-red-500 hover:bg-red-50" aria-label={`Delete question ${index + 1}`}><Trash2 className="size-3.5" /></button></div></article>;
}

export function QuestionForm({ question, saving, onCancel, onSave }: { question: Quiz['questions'][number] | null; saving: boolean; onCancel: () => void; onSave: (values: QuestionValues, existingOptionIds: string[]) => void }) {
  const form = useForm<QuestionValues>({ resolver: zodResolver(questionSchema), defaultValues: { questionText: question?.questionText ?? '', points: question?.points ?? 1, explanation: question?.explanation ?? '', options: question?.options.length ? question.options.map((option) => ({ ...option })) : [{ optionText: '', isCorrect: true }, { optionText: '', isCorrect: false }] } });
  const options = useFieldArray({ control: form.control, name: 'options' });
  const correctCount = form.watch('options').filter((option) => option.isCorrect).length;
  return <form onSubmit={form.handleSubmit((values) => onSave(values, question?.options.map((option) => option.id) ?? []))} className="space-y-4"><div><label className="field-label" htmlFor="question-text">Question</label><textarea id="question-text" rows={3} className="field h-auto py-2.5" {...form.register('questionText')} placeholder="What does こんにちは mean?" />{form.formState.errors.questionText && <ErrorText>{form.formState.errors.questionText.message}</ErrorText>}</div><div className="grid grid-cols-2 gap-3"><div><label className="field-label" htmlFor="question-points">Points</label><input id="question-points" type="number" min="1" className="field" {...form.register('points', { valueAsNumber: true })} /></div><div><p className="field-label">Answer type</p><p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-muted dark:bg-slate-800">{correctCount > 1 ? 'Multiple choice' : 'Single choice'}</p></div></div>
    <div><div className="mb-2 flex items-center justify-between"><p className="field-label mb-0">Answer options</p><Button type="button" size="sm" onClick={() => options.append({ optionText: '', isCorrect: false })} disabled={options.fields.length >= 6}><Plus className="size-3.5" />Add option</Button></div><div className="space-y-2">{options.fields.map((field, index) => <div key={field.id} className="flex items-center gap-2"><label className="sr-only" htmlFor={`answer-option-${index}`}>Answer option {index + 1}</label><input id={`answer-option-${index}`} className="field" {...form.register(`options.${index}.optionText`)} placeholder={`Option ${index + 1}`} /><label className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted"><input type="checkbox" className="size-4 accent-accent" aria-label={`Option ${index + 1} is correct`} {...form.register(`options.${index}.isCorrect`)} />Correct</label><button type="button" className="rounded p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-40" disabled={options.fields.length <= 2} onClick={() => options.remove(index)} aria-label={`Remove option ${index + 1}`}><Trash2 className="size-3.5" /></button></div>)}</div>{form.formState.errors.options?.root && <ErrorText>{form.formState.errors.options.root.message}</ErrorText>}{form.formState.errors.options?.message && <ErrorText>{form.formState.errors.options.message}</ErrorText>}</div>
    <div><label className="field-label" htmlFor="question-explanation">Explanation <span className="font-normal text-slate-400">(optional)</span></label><textarea id="question-explanation" rows={2} className="field h-auto py-2.5" {...form.register('explanation')} /></div>
    <div className="flex justify-end gap-2 border-t border-line pt-4 dark:border-slate-800"><Button type="button" onClick={onCancel}>Cancel</Button><Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : 'Save question'}</Button></div>
  </form>;
}

function AttemptsPanel({ query }: { query: ReturnType<typeof useQuizAttempts> }) {
  type Attempt = NonNullable<typeof query.data>['data'][number];
  const columns: Column<Attempt>[] = [
    { key: 'learner', header: 'Learner', render: (attempt) => <span className="text-xs font-medium">{attempt.user.displayName}</span> },
    { key: 'score', header: 'Score', render: (attempt) => <span className="text-xs">{attempt.score}</span> },
    { key: 'result', header: 'Result', render: (attempt) => <StatusPill status={attempt.passed ? 'approved' : 'rejected'} label={attempt.passed ? 'Passed' : 'Failed'} /> },
    { key: 'submitted', header: 'Submitted', render: (attempt) => <span className="text-xs text-muted">{formatDate(attempt.submittedAt, 'MMM d, yyyy · h:mm a')}</span> },
  ];
  if (query.isError) return <div role="alert" className="surface-card p-5 text-sm text-red-700">Could not load quiz attempts.</div>;
  return <div className="space-y-4">{query.data && <div className="grid gap-3 sm:grid-cols-3"><Metric label="Attempts" value={query.data.meta.total.toLocaleString()} /><Metric label="Average score" value={query.data.stats.averageScore?.toFixed(1) ?? '—'} /><Metric label="Pass rate" value={`${query.data.stats.passRate.toFixed(1)}%`} /></div>}<DataTable rows={query.data?.data ?? []} columns={columns} loading={query.isLoading} emptyTitle="No attempts yet" emptyDescription="Attempt results will appear when learners complete the quiz." /></div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="surface-card p-4"><p className="text-xs text-muted">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></div>; }
function ErrorText({ children }: { children?: string }) { return children ? <p role="alert" className="mt-1.5 text-xs text-red-600">{children}</p> : null; }
