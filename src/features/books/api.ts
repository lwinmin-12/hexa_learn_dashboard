import type { AxiosProgressEvent } from 'axios';
import { z } from 'zod';
import { api } from '@/lib/api';
import type { Book } from '@/lib/domain';

const bookSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  description: z.string().nullable(),
  fileName: z.string(),
  mimeType: z.literal('application/pdf'),
  sizeBytes: z.coerce.number().int().nonnegative(),
  pageCount: z.number().int().positive().nullable(),
  canView: z.boolean(),
  canDownload: z.boolean(),
  status: z.enum(['draft', 'published']),
  position: z.number().int(),
  scope: z.enum(['course', 'chapter']),
  attachedTo: z.object({ type: z.enum(['course', 'chapter']), id: z.string(), title: z.string() }),
  createdAt: z.string(),
}).refine((book) => book.scope === book.attachedTo.type);
const bookDetailsSchema = bookSchema.extend({ previewUrl: z.string().url() });
const bookPageSchema = z.object({ data: z.array(bookSchema), meta: z.object({ page: z.number(), limit: z.number(), total: z.number() }).optional() });
export type BookDetails = z.infer<typeof bookDetailsSchema>;
export type BookInput = Pick<Book, 'title' | 'description' | 'canView' | 'canDownload' | 'status'>;

export async function getCourseBooks(courseId: string): Promise<Book[]> {
  const books: Book[] = [];
  for (let page = 1; ; page += 1) {
    const response = await api.get<unknown>(`/admin/courses/${courseId}/books`, { params: { page, limit: 100 } });
    const result = bookPageSchema.parse(response.data);
    books.push(...result.data);
    if (!result.meta || books.length >= result.meta.total || !result.data.length) return books;
  }
}

function bookForm(file: File, input: BookInput) {
  const form = new FormData();
  form.append('title', input.title);
  if (input.description) form.append('description', input.description);
  form.append('canView', String(input.canView));
  form.append('canDownload', String(input.canDownload));
  form.append('status', input.status);
  form.append('file', file);
  return form;
}

export async function createCourseBook(courseId: string, input: BookInput, file: File, options: { signal: AbortSignal; onUploadProgress: (event: AxiosProgressEvent) => void }) {
  const { data } = await api.post<unknown>(`/admin/courses/${courseId}/books`, bookForm(file, input), options);
  return bookSchema.parse(data);
}

export async function createChapterBook(chapterId: string, input: BookInput, file: File, options: { signal: AbortSignal; onUploadProgress: (event: AxiosProgressEvent) => void }) {
  const { data } = await api.post<unknown>(`/admin/chapters/${chapterId}/books`, bookForm(file, input), options);
  return bookSchema.parse(data);
}

export async function getBook(id: string): Promise<BookDetails> {
  const { data } = await api.get<unknown>(`/admin/books/${id}`);
  return bookDetailsSchema.parse(data);
}

export async function updateBook(id: string, input: Partial<BookInput>) {
  const { data } = await api.patch<unknown>(`/admin/books/${id}`, input);
  return bookSchema.parse(data);
}

export async function replaceBookFile(id: string, file: File, options: { signal: AbortSignal; onUploadProgress: (event: AxiosProgressEvent) => void }) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.put<unknown>(`/admin/books/${id}/file`, form, options);
  return bookSchema.parse(data);
}

export async function deleteBook(id: string) {
  return api.delete(`/admin/books/${id}`);
}

export async function reorderCourseBooks(courseId: string, ids: string[]) {
  return api.put(`/admin/courses/${courseId}/books/reorder`, { ids });
}

export async function reorderChapterBooks(chapterId: string, ids: string[]) {
  return api.put(`/admin/chapters/${chapterId}/books/reorder`, { ids });
}
