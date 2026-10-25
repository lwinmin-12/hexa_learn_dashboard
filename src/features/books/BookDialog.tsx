import { useEffect, useRef, useState, type FormEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import axios from 'axios';
import { z } from 'zod';
import { Check, FileText, X } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FileDropzone, primaryActionClass } from '@/features/content/LearningToolsShared';
import { useToast } from '@/app/toast-context';
import { BOOK_MAX_MB } from '@/lib/constants';
import type { Book, Course } from '@/lib/domain';
import { createChapterBook, createCourseBook, replaceBookFile, updateBook, type BookInput } from './api';

const bookInputSchema = z.object({
  title: z.string().trim().min(2, 'Enter a title with at least 2 characters.').max(120, 'Titles can be up to 120 characters.'),
  description: z.string().max(500, 'Descriptions can be up to 500 characters.'),
  canView: z.boolean(),
  canDownload: z.boolean(),
  status: z.enum(['draft', 'published']),
}).superRefine((input, context) => {
  if (input.status === 'published' && !input.canView && !input.canDownload) context.addIssue({ code: 'custom', path: ['permissions'], message: 'Published books need view or download access.' });
});
export type BookDialogMode = { kind: 'create'; target?: { scope: 'chapter'; id: string } } | { kind: 'edit' | 'replace'; book: Book };
type Mode = BookDialogMode;
type Fields = z.infer<typeof bookInputSchema>;
const initialFields = { title: '', description: '', canView: true, canDownload: false, status: 'draft' } satisfies Fields;

function errorMessage(error: unknown) {
  if (axios.isAxiosError<{ code?: string }>(error)) {
    switch (error.response?.data.code) {
      case 'BOOK_TOO_LARGE': return `Choose a PDF that is ${BOOK_MAX_MB} MB or smaller.`;
      case 'BOOK_INVALID_FILE': return 'Choose a valid PDF file.';
      case 'BOOK_NO_ACCESS_MODE': return 'Turn on view or download access, or set the book to Draft.';
    }
  }
  return 'Could not save this book. Please try again.';
}

export function BookDialog({ mode, course, onClose, onSaved, onReplace }: { mode: Mode; course: Course; onClose: () => void; onSaved: () => void; onReplace: (book: Book) => void }) {
  const toast = useToast();
  const [target, setTarget] = useState<'course' | 'chapter'>(mode.kind === 'create' && mode.target ? 'chapter' : 'course');
  const [chapterId, setChapterId] = useState(mode.kind === 'create' ? mode.target?.id ?? course.chapters?.[0]?.id ?? '' : '');
  const [fields, setFields] = useState<Fields>(mode.kind === 'create' ? initialFields : { title: mode.book.title, description: mode.book.description ?? '', canView: mode.book.canView, canDownload: mode.book.canDownload, status: mode.book.status });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [discardOpen, setDiscardOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<'uploading' | 'saving'>('uploading');
  const controller = useRef<AbortController | null>(null);
  const isReplace = mode.kind === 'replace';
  const isCreate = mode.kind === 'create';
  useEffect(() => () => controller.current?.abort(), []);

  function selectFile(next: File) {
    if (!next.name.toLowerCase().endsWith('.pdf') || (next.type && next.type !== 'application/pdf')) {
      setError('Choose a PDF file.');
      setFile(null);
      return;
    }
    if (!next.size || next.size > BOOK_MAX_MB * 1024 * 1024) {
      setError(`Choose a PDF that is no larger than ${BOOK_MAX_MB} MB.`);
      setFile(null);
      return;
    }
    setFile(next);
    setError(null);
    if (isCreate && !fields.title.trim()) setFields((current) => ({ ...current, title: next.name.replace(/\.pdf$/i, '').slice(0, 120) }));
  }

  function changed() {
    if (isCreate) return Boolean(file || fields.title || fields.description || fields.status !== 'draft' || !fields.canView || fields.canDownload || target !== (mode.target ? 'chapter' : 'course') || (target === 'chapter' && chapterId !== (mode.target?.id ?? course.chapters?.[0]?.id ?? '')));
    if (isReplace) return Boolean(file);
    return fields.title !== mode.book.title || fields.description !== (mode.book.description ?? '') || fields.canView !== mode.book.canView || fields.canDownload !== mode.book.canDownload || fields.status !== mode.book.status;
  }

  function requestClose() {
    if (busy) { setDiscardOpen(true); return; }
    if (changed()) setDiscardOpen(true); else onClose();
  }

  function cancelAndClose() {
    controller.current?.abort();
    controller.current = null;
    setDiscardOpen(false);
    onClose();
  }

  function update<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: '', ...((key === 'canView' || key === 'canDownload') ? { permissions: '' } : {}) }));
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (isReplace && !file) { setError('Choose a PDF file to replace the current one.'); return; }
    const parsed = bookInputSchema.safeParse(fields);
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
      return;
    }
    if (isCreate && !file) { setError('Choose a PDF file.'); return; }
    if (isCreate && target === 'chapter' && !chapterId) { setError('Choose a chapter.'); return; }

    setBusy(true);
    setProgress(0);
    setUploadStage('uploading');
    setError(null);
    const request = new AbortController();
    controller.current = request;
    const options = { signal: request.signal, onUploadProgress: (event: { loaded: number; total?: number }) => {
      if (!event.total) return;
      const next = Math.round((event.loaded / event.total) * 100);
      setProgress(next);
      if (next >= 100) setUploadStage('saving');
    } };
    try {
      if (isCreate && file) {
        const pdf = file.type ? file : new File([file], file.name, { type: 'application/pdf' });
        if (target === 'course') await createCourseBook(course.id, parsed.data, pdf, options);
        else await createChapterBook(chapterId, parsed.data, pdf, options);
      } else if (isReplace && file) {
        const pdf = file.type ? file : new File([file], file.name, { type: 'application/pdf' });
        await replaceBookFile(mode.book.id, pdf, options);
      } else if (mode.kind === 'edit') {
        const input: BookInput = { ...parsed.data, description: parsed.data.description || null };
        await updateBook(mode.book.id, input);
      }
      if (!request.signal.aborted) { toast(isReplace ? 'Book file replaced.' : isCreate ? 'Book saved.' : 'Book updated.'); onSaved(); }
    } catch (failure) {
      if (!request.signal.aborted) setError(errorMessage(failure));
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }

  const title = isCreate ? 'Add book' : isReplace ? 'Replace PDF' : 'Edit book';
  const description = isReplace ? `Choose a new PDF for “${mode.book.title}”.` : isCreate ? 'Add a PDF for learners to read or download.' : 'Update the book details and learner access.';
  const progressShown = (isCreate || isReplace) && busy;
  return <>
    <Dialog.Root open onOpenChange={(open) => { if (!open) requestClose(); }}>
      <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-[2px]" />
        <Dialog.Content aria-describedby="book-dialog-description" className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[calc(100vw-2rem)] max-w-[640px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-xl focus:outline-none dark:border-slate-700 dark:bg-slate-900">
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-6 py-5 dark:border-slate-800"><div><Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title><Dialog.Description id="book-dialog-description" className="mt-1 text-sm text-muted">{description}</Dialog.Description></div><button type="button" aria-label="Close dialog" onClick={requestClose} className="rounded-lg p-2 text-muted hover:bg-slate-100 dark:hover:bg-slate-800"><X className="size-4" /></button></header>
          <form onSubmit={(event) => void submit(event)} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {isCreate && <fieldset disabled={busy}><legend className="field-label">Attach to</legend><div className="flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">{(['course', 'chapter'] as const).map((scope) => <label key={scope} className={`flex flex-1 cursor-pointer items-center justify-center rounded-md px-3 py-2 text-sm font-medium ${target === scope ? 'bg-white text-teal-800 shadow-sm dark:bg-slate-700 dark:text-teal-200' : 'text-slate-600 dark:text-slate-300'}`}><input className="sr-only" type="radio" name="book-target" checked={target === scope} onChange={() => setTarget(scope)} />{scope === 'course' ? 'Whole course' : 'Chapter'}</label>)}</div>{target === 'chapter' && <label className="mt-3 block"><span className="field-label">Chapter</span><select className="field" value={chapterId} onChange={(event) => setChapterId(event.target.value)}><option value="">Choose a chapter</option>{(course.chapters ?? []).map((chapter, index) => <option key={chapter.id} value={chapter.id}>{index + 1}. {chapter.title}</option>)}</select></label>}</fieldset>}
              {!isReplace && <><label className="block" htmlFor="book-title"><span className="field-label">Title</span><input id="book-title" className="field" required minLength={2} maxLength={120} value={fields.title} disabled={busy} onChange={(event) => update('title', event.target.value)} />{fieldErrors.title && <FieldError>{fieldErrors.title}</FieldError>}<span className="mt-1 block text-xs text-muted">2 to 120 characters.</span></label><label className="block" htmlFor="book-description"><span className="field-label">Description <span className="font-normal text-muted">(optional)</span></span><textarea id="book-description" className="field h-auto py-2" rows={3} maxLength={500} value={fields.description} disabled={busy} onChange={(event) => update('description', event.target.value)} /></label></>}
              {(isCreate || isReplace) && <div><span className="field-label">{isReplace ? 'New PDF' : 'PDF file'}</span>{file ? <div className="flex items-center gap-3 rounded-xl border border-line p-3"><FileText aria-hidden="true" className="size-5 shrink-0 text-teal-700" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium" title={file.name}>{file.name}</p><p className="mt-0.5 text-xs text-muted">{formatBytes(file.size)}</p></div><Button type="button" size="sm" aria-label="Remove selected PDF" disabled={busy} onClick={() => setFile(null)}><X className="size-3.5" />Remove</Button></div> : <FileDropzone label="Choose or drop a PDF" accept="application/pdf,.pdf" disabled={busy} onFile={selectFile} />}<p className="mt-1.5 text-xs text-muted">PDF only. Up to {BOOK_MAX_MB} MB.</p></div>}
              {!isReplace && <><fieldset disabled={busy}><legend className="field-label">Learner access</legend><PermissionToggle label="Learners can view" checked={fields.canView} onChange={(checked) => update('canView', checked)} /><PermissionToggle label="Learners can download" checked={fields.canDownload} onChange={(checked) => update('canDownload', checked)} />{fieldErrors.permissions && <FieldError>{fieldErrors.permissions}</FieldError>}</fieldset><fieldset disabled={busy}><legend className="field-label">Status</legend><div className="flex gap-2">{(['draft', 'published'] as const).map((status) => <label key={status} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${fields.status === status ? 'border-teal-700 bg-teal-50 text-teal-900 dark:bg-teal-950 dark:text-teal-100' : 'border-line text-slate-600 dark:text-slate-300'}`}><input type="radio" name="book-status" value={status} checked={fields.status === status} onChange={() => update('status', status)} />{status === 'draft' ? 'Draft' : 'Published'}</label>)}</div></fieldset>{isEdit(mode) && <button type="button" disabled={busy} onClick={() => onReplace(mode.book)} className="text-sm font-medium text-teal-800 underline-offset-4 hover:underline dark:text-teal-200">Replace file</button>}</>}
              {progressShown && <div aria-live="polite"><div className="mb-1 flex justify-between text-xs text-muted"><span>{uploadStage === 'saving' ? 'Saving' : `Uploading ${progress}%`}</span><span>{progress}%</span></div><div role="progressbar" aria-label="PDF upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-teal-700 transition-[width]" style={{ width: `${progress}%` }} /></div></div>}
              {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
            </div>
            <footer className="flex shrink-0 justify-end gap-2 border-t border-line px-6 py-4 dark:border-slate-800"><Button type="button" onClick={requestClose}>{busy ? 'Cancel upload' : 'Cancel'}</Button><Button type="submit" variant="primary" className={primaryActionClass} disabled={busy || (isCreate && !file) || (isReplace && !file)}>{busy ? uploadStage === 'saving' ? 'Saving…' : 'Uploading…' : error ? 'Try again' : isCreate ? 'Save book' : isReplace ? 'Replace file' : 'Save changes'}</Button></footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    <ConfirmDialog open={discardOpen} onOpenChange={setDiscardOpen} title="Discard changes?" description={busy ? 'The upload will stop and your unsaved changes will be lost.' : 'Your unsaved changes will be lost.'} confirmLabel={busy ? 'Cancel upload' : 'Discard changes'} destructive onConfirm={cancelAndClose} />
  </>;
}

function isEdit(mode: Mode): mode is { kind: 'edit'; book: Book } { return mode.kind === 'edit'; }
function PermissionToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 border-b border-line py-2 text-sm last:border-0 dark:border-slate-800"><span>{label}</span><button type="button" role="switch" aria-label={label} aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${checked ? 'bg-teal-700' : 'bg-slate-300 dark:bg-slate-600'}`}><span className={`absolute top-0.5 grid size-5 place-items-center rounded-full bg-white transition ${checked ? 'left-[22px]' : 'left-0.5'}`}>{checked && <Check aria-hidden="true" className="size-3 text-teal-800" />}</span></button></label>;
}
function FieldError({ children }: { children: string }) { return <span role="alert" className="mt-1 block text-xs text-red-700 dark:text-red-300">{children}</span>; }
function formatBytes(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
