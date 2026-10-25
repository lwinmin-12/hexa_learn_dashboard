import { useRef, useState } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Dialog from '@radix-ui/react-dialog';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BookOpen, CheckCircle2, Download, Eye, FileText, GripVertical, MoreHorizontal, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ForbiddenPage, NotFoundPage } from '@/app/system-pages';
import { useToast } from '@/app/toast-context';
import type { Book, Course } from '@/lib/domain';
import { queryKeys } from '@/lib/query-keys';
import { BookDialog, type BookDialogMode } from './BookDialog';
import { deleteBook, getBook, getCourseBooks, reorderChapterBooks, reorderCourseBooks, updateBook } from './api';

type BookGroup = { id: string; title: string; parent: 'course' | 'chapter'; parentId: string; books: Book[]; totalBooks: number };
type Permission = 'canView' | 'canDownload';
const primaryClass = 'bg-teal-700 hover:bg-teal-800';
const scopes = [{ value: 'all', label: 'All' }, { value: 'course', label: 'Whole course' }, { value: 'chapter', label: 'Chapters' }] as const;

function errorStatus(error: unknown) { return axios.isAxiosError(error) ? error.response?.status : undefined; }
function sizeLabel(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }

export function BooksTab({ course }: { course: Course }) {
  const [params, setParams] = useSearchParams();
  const [dialog, setDialog] = useState<BookDialogMode | null>(null);
  const [preview, setPreview] = useState<Book | null>(null);
  const [deleting, setDeleting] = useState<Book | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const client = useQueryClient();
  const toast = useToast();
  const key = queryKeys.books.course(course.id);
  const query = useQuery({ queryKey: key, queryFn: () => getCourseBooks(course.id), staleTime: 0 });
  const books = query.data ?? [];
  const search = params.get('bookSearch') ?? '';
  const rawScope = params.get('bookScope');
  const scope = rawScope === 'course' || rawScope === 'chapter' ? rawScope : 'all';
  const chapterFilter = params.get('chapter') ?? '';
  const filtered = books.filter((book) => (scope === 'all' || book.scope === scope) && (!chapterFilter || book.scope === 'chapter' && book.attachedTo.id === chapterFilter) && book.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const counts = { all: books.length, course: books.filter((book) => book.scope === 'course').length, chapter: books.filter((book) => book.scope === 'chapter').length };
  const groups = makeGroups(filtered, books, course);
  const restoreFocus = () => requestAnimationFrame(() => opener.current?.isConnected && opener.current.focus());
  function openDialog(next: BookDialogMode, trigger?: HTMLElement) {
    opener.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setDialog(next);
  }
  function updateFilters(nextSearch: string, nextScope: typeof scope, nextChapter = chapterFilter) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (nextSearch) next.set('bookSearch', nextSearch); else next.delete('bookSearch');
      if (nextScope === 'all') next.delete('bookScope'); else next.set('bookScope', nextScope);
      if (nextChapter) next.set('chapter', nextChapter); else next.delete('chapter');
      return next;
    }, { replace: true });
  }
  function invalidate() {
    void client.invalidateQueries({ queryKey: key });
    void client.invalidateQueries({ queryKey: queryKeys.courses.detail(course.id) });
  }

  const toggle = useMutation({
    mutationFn: ({ id, field, value }: { id: string; field: Permission; value: boolean }) => updateBook(id, { [field]: value }),
    onMutate: async ({ id, field, value }) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<Book[]>(key);
      client.setQueryData<Book[]>(key, (current) => current?.map((book) => book.id === id ? { ...book, [field]: value } : book));
      return { previous };
    },
    onError: (_error, _input, context) => { if (context?.previous) client.setQueryData(key, context.previous); toast('Could not update learner access. Please try again.', 'error'); },
    onSettled: () => { void client.invalidateQueries({ queryKey: key }); },
  });
  const reorder = useMutation({
    mutationFn: ({ group, ids }: { group: BookGroup; ids: string[] }) => group.parent === 'course' ? reorderCourseBooks(course.id, ids) : reorderChapterBooks(group.parentId, ids),
    onMutate: async ({ group, ids }) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<Book[]>(key);
      client.setQueryData<Book[]>(key, (current) => current?.map((book) => book.scope === group.parent && book.attachedTo.id === group.parentId ? { ...book, position: ids.indexOf(book.id) + 1 } : book));
      return { previous };
    },
    onError: (_error, _input, context) => { if (context?.previous) client.setQueryData(key, context.previous); toast('Could not reorder books. Your changes were restored.', 'error'); },
    onSettled: () => { void client.invalidateQueries({ queryKey: key }); },
  });
  const remove = useMutation({
    mutationFn: deleteBook,
    onSuccess: async () => { await client.invalidateQueries({ queryKey: key }); await client.invalidateQueries({ queryKey: queryKeys.courses.detail(course.id) }); setDeleting(null); restoreFocus(); toast('Book deleted.'); },
    onError: () => toast('Could not delete this book. Please try again.', 'error'),
  });

  function moveBooks(group: BookGroup, { active, over }: DragEndEvent) {
    if (!over || active.id === over.id || search.trim()) return;
    const from = group.books.findIndex((book) => book.id === active.id);
    const to = group.books.findIndex((book) => book.id === over.id);
    if (from < 0 || to < 0) return;
    reorder.mutate({ group, ids: arrayMove(group.books, from, to).map((book) => book.id) });
  }

  const accessHelp = <p className="mb-3 text-xs text-slate-600 dark:text-slate-300">View: learners read it in the app. Download: learners can save the file.</p>;
  return <section className="space-y-5" aria-labelledby="course-books-heading">
    <header className="sticky top-[68px] z-20 -mx-1 rounded-xl bg-[#F7F8F8]/95 px-1 py-3 backdrop-blur dark:bg-slate-950/95">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><h2 id="course-books-heading" className="text-lg font-semibold">Books</h2>{!query.isPending && !query.isError && <span className="text-xs text-slate-600 dark:text-slate-300">{books.length} {books.length === 1 ? 'book' : 'books'}</span>}</div><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Files for learners to read or download. Optional.</p></div><Button variant="primary" className={primaryClass} onClick={(event) => openDialog({ kind: 'create' }, event.currentTarget)}><Plus aria-hidden="true" className="size-4" />Add book</Button></div>
      <div className="mt-5 flex flex-wrap items-center gap-3"><div className="relative w-full sm:max-w-xs"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 size-4 text-slate-500" /><label className="sr-only" htmlFor="book-search">Search books by title</label><input id="book-search" type="search" className="field pl-9" placeholder="Search books" value={search} onChange={(event) => updateFilters(event.target.value, scope)} /></div><div className="flex flex-wrap gap-2" role="group" aria-label="Filter books by attachment">{scopes.map((filter) => <button key={filter.value} type="button" aria-pressed={scope === filter.value} onClick={() => updateFilters(search, filter.value, '')} className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${scope === filter.value ? 'border-teal-700 bg-teal-50 text-teal-900 dark:bg-teal-950 dark:text-teal-100' : 'border-line bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}><span>{filter.label}</span><span className="tabular-nums">{query.isPending || query.isError ? '—' : counts[filter.value]}</span></button>)}</div></div>
    </header>
    {query.isPending ? <div role="status" aria-label="Loading books" className="space-y-3">{[1, 2, 3].map((row) => <div key={row} className="h-20 animate-pulse rounded-xl border border-line bg-slate-100 dark:border-slate-700 dark:bg-slate-900" />)}</div>
      : query.isError && errorStatus(query.error) === 403 ? <ForbiddenPage />
      : query.isError && errorStatus(query.error) === 404 ? <NotFoundPage />
      : query.isError ? <div role="alert" className="surface-card flex flex-wrap items-center justify-between gap-3 p-5"><div><h3 className="text-sm font-semibold">Could not load books</h3><p className="mt-1 text-sm text-muted">Please try again.</p></div><Button onClick={() => void query.refetch()} disabled={query.isFetching}>Retry</Button></div>
      : !books.length ? <div className="surface-card py-8"><EmptyState title="No books yet" description="Add a PDF for your learners to read or download." action={<Button variant="primary" className={primaryClass} onClick={(event) => openDialog({ kind: 'create' }, event.currentTarget)}><Plus className="size-4" />Add book</Button>} /></div>
      : !filtered.length ? <div className="surface-card py-8"><EmptyState title="No matching books" description="Try another title or show books from every part of the course." action={<Button onClick={() => updateFilters('', 'all', '')}>Clear filters</Button>} /></div>
      : <>{accessHelp}<div className="space-y-6">{groups.map((group) => <BookSection key={group.id} group={group} disabled={toggle.isPending || reorder.isPending} reorderDisabled={Boolean(search.trim())} onReorder={(event) => moveBooks(group, event)} onPreview={(book) => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setPreview(book); }} onEdit={(book) => openDialog({ kind: 'edit', book })} onReplace={(book) => openDialog({ kind: 'replace', book })} onDelete={(book) => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setDeleting(book); }} onAdd={(trigger) => openDialog({ kind: 'create', target: { scope: 'chapter', id: group.parentId } }, trigger)} onToggle={(book, field, checked) => { const otherIsOff = field === 'canView' ? !book.canDownload : !book.canView; if (book.status === 'published' && !checked && otherIsOff) { toast('Turn on view or download, or set the book to Draft.', 'error'); return; } toggle.mutate({ id: book.id, field, value: checked }); }} />)}</div></>}
    {dialog && <BookDialog key={`${dialog.kind}-${dialog.kind === 'create' ? dialog.target?.id ?? 'course' : dialog.book.id}`} mode={dialog} course={course} onClose={() => { setDialog(null); restoreFocus(); }} onSaved={() => { invalidate(); setDialog(null); restoreFocus(); }} onReplace={(book) => setDialog({ kind: 'replace', book })} />}
    {preview && <BookPreviewDialog book={preview} onClose={() => { setPreview(null); restoreFocus(); }} />}
    <ConfirmDialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open && !remove.isPending) { setDeleting(null); restoreFocus(); } }} title="Delete this book?" description="Learners will lose access." confirmLabel="Delete book" destructive busy={remove.isPending} onConfirm={() => { if (deleting) remove.mutate(deleting.id); }} />
  </section>;
}

function makeGroups(books: Book[], allBooks: Book[], course: Course): BookGroup[] {
  const courseBooks = books.filter((book) => book.scope === 'course').sort((a, b) => a.position - b.position);
  const groups: BookGroup[] = [{ id: course.id, title: 'Whole course', parent: 'course', parentId: course.id, books: courseBooks, totalBooks: allBooks.filter((book) => book.scope === 'course').length }];
  (course.chapters ?? []).forEach((chapter, index) => {
    const chapterBooks = books.filter((book) => book.scope === 'chapter' && book.attachedTo.id === chapter.id).sort((a, b) => a.position - b.position);
    const totalBooks = allBooks.filter((book) => book.scope === 'chapter' && book.attachedTo.id === chapter.id).length;
    if (chapterBooks.length) groups.push({ id: chapter.id, title: `Chapter ${index + 1}: ${chapter.title}`, parent: 'chapter', parentId: chapter.id, books: chapterBooks, totalBooks });
  });
  return groups;
}

function BookSection({ group, disabled, reorderDisabled, onReorder, onPreview, onEdit, onReplace, onDelete, onAdd, onToggle }: { group: BookGroup; disabled: boolean; reorderDisabled: boolean; onReorder: (event: DragEndEvent) => void; onPreview: (book: Book) => void; onEdit: (book: Book) => void; onReplace: (book: Book) => void; onDelete: (book: Book) => void; onAdd: (trigger: HTMLElement) => void; onToggle: (book: Book, field: Permission, checked: boolean) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  return <section aria-label={group.title}><header className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{group.title}</h3>{group.parent === 'chapter' && <button type="button" onClick={(event) => onAdd(event.currentTarget)} className="inline-flex items-center gap-1 rounded text-xs font-medium text-teal-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:text-teal-200"><Plus className="size-3.5" />Add book</button>}</header>{group.books.length ? <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onReorder}><SortableContext items={group.books.map((book) => book.id)} strategy={verticalListSortingStrategy}><div className="space-y-2">{group.books.map((book) => <BookRow key={book.id} book={book} disabled={disabled} reorderDisabled={reorderDisabled} onPreview={() => onPreview(book)} onEdit={() => onEdit(book)} onReplace={() => onReplace(book)} onDelete={() => onDelete(book)} onToggle={(field, checked) => onToggle(book, field, checked)} />)}</div></SortableContext></DndContext> : group.totalBooks === 0 ? <div className="rounded-xl border border-dashed border-line bg-white px-4 py-4 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-300">No course-level book. Optional.</div> : null}</section>;
}

function BookRow({ book, disabled, reorderDisabled, onPreview, onEdit, onReplace, onDelete, onToggle }: { book: Book; disabled: boolean; reorderDisabled: boolean; onPreview: () => void; onEdit: () => void; onReplace: () => void; onDelete: () => void; onToggle: (field: Permission, checked: boolean) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: book.id, disabled: disabled || reorderDisabled });
  return <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`min-h-16 rounded-xl border border-line bg-white px-3 py-3 transition hover:bg-[#F7F8F8] dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 ${isDragging ? 'z-20 shadow-md ring-2 ring-teal-700' : ''}`}>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-3"><button {...attributes} {...listeners} type="button" aria-label={`Reorder ${book.title}`} disabled={disabled || reorderDisabled} className="touch-none rounded p-1 text-slate-500 focus-visible:ring-2 focus-visible:ring-teal-700 disabled:opacity-40"><GripVertical className="size-4" /></button><FileText aria-hidden="true" className="size-5 shrink-0 text-teal-800 dark:text-teal-200" /><div className="min-w-0 flex-1"><button type="button" onClick={onPreview} className="max-w-full truncate rounded text-left text-sm font-semibold text-ink underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-teal-700 dark:text-white">{book.title}</button><p className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-300" title={book.fileName}>{sizeLabel(book.sizeBytes)}{book.pageCount ? ` · ${book.pageCount} pages` : ''} · {book.fileName}</p></div><span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-slate-50 px-2.5 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"><BookOpen aria-hidden="true" className="size-3.5" />{book.scope === 'course' ? 'Course' : `Chapter: ${book.attachedTo.title}`}</span><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${book.status === 'published' ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100' : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'}`}>{book.status === 'published' ? <CheckCircle2 aria-hidden="true" className="size-3.5" /> : <FileText aria-hidden="true" className="size-3.5" />}{book.status === 'published' ? 'Published' : 'Draft'}</span>
      <PermissionSwitch title={book.title} field="canView" checked={book.canView} disabled={disabled} onChange={(value) => onToggle('canView', value)} /><PermissionSwitch title={book.title} field="canDownload" checked={book.canDownload} disabled={disabled} onChange={(value) => onToggle('canDownload', value)} />
      <DropdownMenu.Root><DropdownMenu.Trigger asChild><button type="button" aria-label={`Actions for ${book.title}`} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-teal-700 dark:text-slate-300 dark:hover:bg-slate-800"><MoreHorizontal className="size-4" /></button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={5} className="z-40 min-w-40 rounded-lg border border-line bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"><MenuItem onSelect={onPreview}>Preview</MenuItem><MenuItem onSelect={onEdit}>Edit</MenuItem><MenuItem onSelect={onReplace}>Replace file</MenuItem><DropdownMenu.Separator className="my-1 h-px bg-line dark:bg-slate-700" /><DropdownMenu.Item onSelect={onDelete} className="cursor-pointer rounded px-3 py-2 text-sm text-red-700 outline-none focus:bg-red-50 dark:text-red-300 dark:focus:bg-red-950">Delete</DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>
    </div>
  </article>;
}

function PermissionSwitch({ title, field, checked, disabled, onChange }: { title: string; field: Permission; checked: boolean; disabled: boolean; onChange: (checked: boolean) => void }) {
  const action = field === 'canView' ? 'view' : 'download';
  const Icon = field === 'canView' ? Eye : Download;
  return <label className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-xs text-slate-700 dark:text-slate-200"><Icon aria-hidden="true" className="size-3.5 text-slate-500" /><span className="whitespace-nowrap">Learners can {action}</span><input type="checkbox" role="switch" aria-label={`Learners can ${action}: ${title}`} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700" /></label>;
}

function MenuItem({ children, onSelect }: { children: string; onSelect: () => void }) { return <DropdownMenu.Item onSelect={onSelect} className="cursor-pointer rounded px-3 py-2 text-sm outline-none focus:bg-slate-100 dark:focus:bg-slate-800">{children}</DropdownMenu.Item>; }

function BookPreviewDialog({ book, onClose }: { book: Book; onClose: () => void }) {
  const query = useQuery({ queryKey: queryKeys.books.detail(book.id), queryFn: () => getBook(book.id), staleTime: 0 });
  const refetched = useRef(false);
  const [previewError, setPreviewError] = useState(false);
  const can = [book.canView && 'view', book.canDownload && 'download'].filter(Boolean).join(', ') || 'no access';
  function onFrameError() {
    if (!refetched.current) { refetched.current = true; void query.refetch(); }
    else setPreviewError(true);
  }
  return <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-[2px]" /><Dialog.Content aria-describedby="book-preview-description" className="fixed inset-y-0 right-0 z-50 flex w-full max-w-4xl flex-col overflow-hidden border-l border-line bg-white shadow-xl focus:outline-none dark:border-slate-700 dark:bg-slate-900"><header className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4 dark:border-slate-800"><div className="min-w-0"><Dialog.Title className="truncate text-base font-semibold">{book.title}</Dialog.Title><Dialog.Description id="book-preview-description" className="mt-1 text-xs text-muted">Learners can: {can}.</Dialog.Description></div><button type="button" aria-label="Close preview" onClick={onClose} className="rounded-lg p-2 text-muted hover:bg-slate-100 dark:hover:bg-slate-800"><X className="size-4" /></button></header><p className="px-5 py-3 text-xs leading-5 text-slate-600 dark:text-slate-300">Learners who can view but not download still see the file in their browser, so this is a convenience control, not strong copy protection.</p><div className="min-h-0 flex-1 bg-slate-100 dark:bg-slate-950">{query.isPending ? <div role="status" className="grid h-full place-items-center text-sm text-muted">Loading preview…</div> : query.isError || previewError ? <div role="alert" className="grid h-full place-items-center p-6 text-center"><div><p className="text-sm font-medium">Preview unavailable</p><Button className="mt-3" onClick={() => { refetched.current = false; setPreviewError(false); void query.refetch(); }}>Retry preview</Button></div></div> : <iframe title={`Preview ${book.title}`} src={query.data.previewUrl} onError={onFrameError} className="size-full border-0" />}</div><footer className="flex shrink-0 justify-end border-t border-line px-5 py-3 dark:border-slate-800">{query.data && <a href={query.data.previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:text-teal-200 dark:hover:bg-teal-950">Open in new tab</a>}</footer></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
