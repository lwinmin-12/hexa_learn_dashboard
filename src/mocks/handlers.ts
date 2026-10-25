import { http, HttpResponse } from 'msw';
import { z } from 'zod';
import { API_URL } from '@/lib/constants';
import type { QuizListItem } from '@/features/quizzes/courseQuizApi';
import type { Book, Course, PaymentMethod } from '@/lib/domain';
import { parseFlashcardCsv } from '@/features/content/csv';
import { copy, COURSE_IDS, seedBooks, seedCourses, seedFlashcards, seedAudioTracks, seedPaymentMethods, seedPayments, seedPromos, seedRevenue } from './data';

let courses = copy(seedCourses);
let books = copy(seedBooks);
let pageAdminCourseIds = new Set([COURSE_IDS.beginner, COURSE_IDS.hiragana]);
let payments = copy(seedPayments);
let promos = copy(seedPromos);
let methods = copy(seedPaymentMethods);
let messages: { id: string; channelId: string; title: string; body: string; createdAt: string }[] = [];
let channelNames: Record<string, string> = {};
let members = [
  { id: 'member-1', user: { id: 'u-11', displayName: 'Aiko Tanaka', email: 'aiko@example.com' }, joinedAt: new Date().toISOString() },
  { id: 'member-2', user: { id: 'u-12', displayName: 'Kenji Mori', email: 'kenji@example.com' }, joinedAt: new Date().toISOString() },
];
type MockQuestion = { id: string; questionText: string; position: number; points: number; explanation: string | null; options: { id: string; optionText: string; isCorrect: boolean; position: number }[] };
type MockQuiz = { id: string; title: string; passScore: number; timeLimitSec: number | null; courseId: string | null; chapterId: string | null; episodeId: string | null; questions: MockQuestion[] };
type MockFlashcard = { id: string; chapterId: string; frontText: string; backText: string; audioUrl: string | null; position: number };
type MockAudio = { id: string; chapterId: string; title: string; type: 'vocab' | 'speaking'; durationSec: number; audioUrl: string; position: number; fileSize?: number };
const previewQuizResults: Record<string, { attemptCount: number; passRate: number; averageScore: number }> = {
  'preview-quiz-course': { attemptCount: 28, passRate: 75, averageScore: 8 },
  'preview-quiz-chapter': { attemptCount: 16, passRate: 87.5, averageScore: 5.2 },
  'preview-quiz-lesson-two': { attemptCount: 7, passRate: 57.1, averageScore: 2.7 },
  'mock-beginner-course': { attemptCount: 12, passRate: 75, averageScore: 7 },
  'mock-beginner-chapter': { attemptCount: 3, passRate: 33.3, averageScore: 3 },
  'mock-hiragana-course': { attemptCount: 5, passRate: 80, averageScore: 6 },
  'mock-hiragana-chapter': { attemptCount: 9, passRate: 55.6, averageScore: 4 },
  'mock-hiragana-lesson': { attemptCount: 1, passRate: 100, averageScore: 3 },
};
function previewQuizzes(): MockQuiz[] {
  return [
    { id: 'preview-quiz-course', title: 'Course progress check', courseId: COURSE_IDS.contentPreview, chapterId: null, episodeId: null, count: 10, passScore: 7, timeLimitSec: 300 },
    { id: 'preview-quiz-chapter', title: 'Hiragana and first words', courseId: null, chapterId: 'preview-chapter-1', episodeId: null, count: 6, passScore: 4, timeLimitSec: 180 },
    { id: 'preview-quiz-lesson', title: 'Vowel listening check', courseId: null, chapterId: null, episodeId: 'preview-episode-1', count: 3, passScore: 2, timeLimitSec: null },
    { id: 'preview-quiz-empty', title: 'Conversation warm-up', courseId: null, chapterId: 'preview-chapter-2', episodeId: null, count: 0, passScore: 1, timeLimitSec: null },
    { id: 'preview-quiz-lesson-two', title: 'Sentence pattern practice', courseId: null, chapterId: null, episodeId: 'preview-episode-4', count: 4, passScore: 3, timeLimitSec: 120 },
    { id: 'mock-beginner-course', title: 'Beginner course checkpoint', courseId: COURSE_IDS.beginner, chapterId: null, episodeId: null, count: 8, passScore: 6, timeLimitSec: 300 },
    { id: 'mock-beginner-chapter', title: 'First conversations review', courseId: null, chapterId: '75c861e5-45da-4d30-8682-49c533b1bd5e', episodeId: null, count: 3, passScore: 2, timeLimitSec: null },
    { id: 'mock-beginner-lesson', title: 'Vowel sounds practice', courseId: null, chapterId: null, episodeId: '1b19ade0-911e-4a5f-8ed9-10d7699ade88', count: 2, passScore: 1, timeLimitSec: 180 },
    { id: 'mock-hiragana-course', title: 'Seven day review', courseId: COURSE_IDS.hiragana, chapterId: null, episodeId: null, count: 5, passScore: 4, timeLimitSec: 240 },
    { id: 'mock-hiragana-chapter', title: 'Hiragana reading check', courseId: null, chapterId: '05f1c08a-ed29-4a6a-8224-b2da611c648a', episodeId: null, count: 4, passScore: 3, timeLimitSec: 120 },
    { id: 'mock-hiragana-lesson', title: 'Character recognition', courseId: null, chapterId: null, episodeId: 'preview-episode-1', count: 0, passScore: 0, timeLimitSec: null },
  ].map(({ count, ...quiz }) => ({
    ...quiz,
    questions: Array.from({ length: count }, (_, position) => ({
      id: `${quiz.id}-question-${position}`, questionText: `Practice question ${position + 1}`, position, points: 1, explanation: null,
      options: [
        { id: `${quiz.id}-option-${position}-yes`, optionText: 'Correct answer', isCorrect: true, position: 0 },
        { id: `${quiz.id}-option-${position}-no`, optionText: 'Try again', isCorrect: false, position: 1 },
      ],
    })),
  }));
}
let quizzes: MockQuiz[] = [{ id: 'quiz-demo', title: 'Hiragana review', passScore: 70, timeLimitSec: 600, courseId: COURSE_IDS.beginner, chapterId: null, episodeId: null, questions: [{ id: 'question-demo', questionText: 'What does こんにちは mean?', position: 0, points: 1, explanation: 'A common daytime greeting.', options: [{ id: 'option-hello', optionText: 'Hello', isCorrect: true, position: 0 }, { id: 'option-goodbye', optionText: 'Goodbye', isCorrect: false, position: 1 }] }] }, ...previewQuizzes()];
let flashcards: MockFlashcard[] = [{ id: 'fc-1', chapterId: '2cfcceab-bf49-48c5-a9bb-512bbd530302', frontText: 'こんにちは', backText: 'Hello', audioUrl: null, position: 0 }, ...copy(seedFlashcards)];
let audioTracks: MockAudio[] = copy(seedAudioTracks);

export function resetMockState() {
  courses = copy(seedCourses);
  books = copy(seedBooks);
  pageAdminCourseIds = new Set([COURSE_IDS.beginner, COURSE_IDS.hiragana]);
  payments = copy(seedPayments);
  promos = copy(seedPromos);
  methods = copy(seedPaymentMethods);
  messages = [];
  channelNames = {};
  members = [
    { id: 'member-1', user: { id: 'u-11', displayName: 'Aiko Tanaka', email: 'aiko@example.com' }, joinedAt: new Date().toISOString() },
    { id: 'member-2', user: { id: 'u-12', displayName: 'Kenji Mori', email: 'kenji@example.com' }, joinedAt: new Date().toISOString() },
  ];
  quizzes = [{ id: 'quiz-demo', title: 'Hiragana review', passScore: 70, timeLimitSec: 600, courseId: COURSE_IDS.beginner, chapterId: null, episodeId: null, questions: [{ id: 'question-demo', questionText: 'What does こんにちは mean?', position: 0, points: 1, explanation: 'A common daytime greeting.', options: [{ id: 'option-hello', optionText: 'Hello', isCorrect: true, position: 0 }, { id: 'option-goodbye', optionText: 'Goodbye', isCorrect: false, position: 1 }] }] }, ...previewQuizzes()];
  flashcards = [{ id: 'fc-1', chapterId: '2cfcceab-bf49-48c5-a9bb-512bbd530302', frontText: 'こんにちは', backText: 'Hello', audioUrl: null, position: 0 }, ...copy(seedFlashcards)];
  audioTracks = copy(seedAudioTracks);
}

function page<T>(items: T[], request: Request) {
  const url = new URL(request.url);
  const pageNo = Math.max(1, Number(url.searchParams.get('page') ?? 1));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 20)));
  const start = (pageNo - 1) * limit;
  return HttpResponse.json({ data: items.slice(start, start + limit), meta: { page: pageNo, limit, total: items.length } });
}

function isPageAdmin(request: Request) {
  return (request.headers.get('authorization') ?? '').includes('mock-page_admin');
}

function canAccessCourse(request: Request, courseId: string) {
  return !isPageAdmin(request) || pageAdminCourseIds.has(courseId);
}

function visibleCourses(request: Request) {
  return courses.filter((course) => canAccessCourse(request, course.id));
}

function courseForChapter(chapterId: string) {
  return courses.find((course) => course.chapters?.some((chapter) => chapter.id === chapterId));
}

function courseForEpisode(episodeId: string) {
  return courses.find((course) => course.chapters?.some((chapter) => chapter.episodes.some((episode) => episode.id === episodeId)));
}

function canAccessChapter(request: Request, chapterId: string) {
  const course = courseForChapter(chapterId);
  return Boolean(course && canAccessCourse(request, course.id));
}

function bookCourseId(book: Book) {
  return book.scope === 'course' ? book.attachedTo.id : courseForChapter(book.attachedTo.id)?.id;
}

function canAccessBook(request: Request, book: Book) {
  const courseId = bookCourseId(book);
  return Boolean(courseId && canAccessCourse(request, courseId));
}

function courseWithBookCounts(course: Course): Course {
  return {
    ...course,
    bookCount: books.filter((book) => bookCourseId(book) === course.id).length,
    chapters: course.chapters?.map((chapter) => ({
      ...chapter,
      bookCount: books.filter((book) => book.scope === 'chapter' && book.attachedTo.id === chapter.id).length,
    })),
  };
}

const bookError = (status: number, code: string, message: string) => HttpResponse.json({ statusCode: status, code, message }, { status });
const bookPatchSchema = z.object({ title: z.string().min(2).max(120).optional(), description: z.string().max(500).nullable().optional(), canView: z.boolean().optional(), canDownload: z.boolean().optional(), status: z.enum(['draft', 'published']).optional() });
async function createBookFromForm(request: Request, parent: { scope: 'course' | 'chapter'; id: string }, attachedTo: { type: 'course' | 'chapter'; id: string; title: string }) {
  const form = await request.formData();
  const file = form.get('file');
  const title = String(form.get('title') ?? '').trim();
  const canView = form.get('canView') === 'true';
  const canDownload = form.get('canDownload') === 'true';
  const status = form.get('status') === 'published' ? 'published' : 'draft';
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.pdf') || file.type !== 'application/pdf') return bookError(400, 'BOOK_INVALID_FILE', 'Choose a valid PDF file');
  if (file.size > 50 * 1024 * 1024) return bookError(413, 'BOOK_TOO_LARGE', 'Book exceeds BOOK_MAX_MB');
  if (title.length < 2 || title.length > 120) return badRequest('Book title is invalid');
  if (status === 'published' && !canView && !canDownload) return bookError(400, 'BOOK_NO_ACCESS_MODE', 'Published books require view or download permission');
  const siblings = books.filter((book) => book.scope === parent.scope && book.attachedTo.id === parent.id);
  const book: Book = { id: crypto.randomUUID(), title, description: String(form.get('description') ?? '') || null, fileName: file.name, mimeType: 'application/pdf', sizeBytes: file.size, pageCount: null, canView, canDownload, status, position: Math.max(0, ...siblings.map((item) => item.position)) + 1, scope: parent.scope, attachedTo, createdAt: new Date().toISOString() };
  books.push(book);
  return HttpResponse.json(book, { status: 201 });
}

function canAccessEpisode(request: Request, episodeId: string) {
  const course = courseForEpisode(episodeId);
  return Boolean(course && canAccessCourse(request, course.id));
}

function canAccessQuiz(request: Request, quiz: MockQuiz) {
  return !isPageAdmin(request) || (quiz.courseId ? canAccessCourse(request, quiz.courseId) : quiz.chapterId ? canAccessChapter(request, quiz.chapterId) : quiz.episodeId ? canAccessEpisode(request, quiz.episodeId) : false);
}

function quizForQuestion(questionId: string) {
  return quizzes.find((quiz) => quiz.questions.some((question) => question.id === questionId));
}

function quizForOption(optionId: string) {
  return quizzes.find((quiz) => quiz.questions.some((question) => question.options.some((option) => option.id === optionId)));
}

function canAccessPayment(request: Request, payment: typeof payments[number]) {
  const courseTitles = new Set(visibleCourses(request).map((course) => course.title));
  return courseTitles.has(payment.course.title);
}

function canAccessPromo(request: Request, promo: typeof promos[number]) {
  return !isPageAdmin(request) || Boolean(promo.courseId && canAccessCourse(request, promo.courseId));
}

function canAccessChannel(request: Request, channelId: string) {
  const courseId = channelId.replace(/^channel-/, '');
  return canAccessCourse(request, courseId);
}

const forbidden = () => HttpResponse.json({ statusCode: 403, code: 'FORBIDDEN', message: 'Role is not permitted' }, { status: 403 });

const notFound = () => HttpResponse.json({ statusCode: 404, code: 'NOT_FOUND', message: 'Record not found' }, { status: 404 });
const badRequest = (message: string) => HttpResponse.json({ statusCode: 400, code: 'VALIDATION_ERROR', message }, { status: 400 });
const courseStatus = z.enum(['draft', 'scheduled', 'published']);
const courseInput = z.object({ title: z.string().min(1), slug: z.string().optional(), description: z.string().optional(), coverUrl: z.string().nullable().optional(), isPremium: z.boolean().optional(), price: z.string().nullable().optional(), currency: z.string().nullable().optional(), status: courseStatus.optional(), publishAt: z.string().nullable().optional() });
const chapterInput = z.object({ title: z.string().min(1), status: courseStatus.optional() });
const episodeInput = chapterInput.extend({ description: z.string().optional(), publishAt: z.string().nullable().optional() });
const promoInput = z.object({ code: z.string(), discountType: z.enum(['percent', 'fixed']), discountValue: z.string(), courseId: z.string().nullable(), maxUses: z.number().nullable(), validFrom: z.string().nullable(), validTo: z.string().nullable(), isActive: z.boolean() });
const methodInput = z.object({ type: z.enum(['qr', 'bank_transfer']), name: z.string(), accountName: z.string().nullable(), accountNo: z.string().nullable(), qrImageUrl: z.string().nullable(), isActive: z.boolean() });
const messageInput = z.object({ title: z.string().min(1), body: z.string().min(1) });
const quizInput = z.object({ title: z.string().min(1), passScore: z.number().int().min(0), timeLimitSec: z.number().int().min(1).nullable(), courseId: z.string().nullable().optional(), chapterId: z.string().nullable().optional(), episodeId: z.string().nullable().optional() });
const questionInput = z.object({ questionText: z.string().min(1), points: z.number().int().min(1), explanation: z.string().nullable().optional(), options: z.array(z.object({ optionText: z.string().min(1), isCorrect: z.boolean(), position: z.number().int().optional() })).min(1) });

async function readBody<T extends z.ZodType>(request: Request, schema: T) {
  const value: unknown = await request.json();
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export const handlers = [
  http.get(`${API_URL}/me`, ({ request }) => {
    const token = request.headers.get('authorization') ?? '';
    const role = token.includes('mock-page_admin') ? 'page_admin' : 'super_admin';
    return HttpResponse.json({ id: `demo-${role}`, email: `${role.replace('_', '.')}@hexalearn.test`, displayName: role === 'page_admin' ? 'Keiko Sato' : 'Mika Tanaka', avatarUrl: null, role, status: 'active' });
  }),
  http.get(`${API_URL}/admin/dashboard/summary`, ({ request }) => {
    const courseTitles = new Set(visibleCourses(request).map((course) => course.title));
    const scopedPayments = payments.filter((payment) => courseTitles.has(payment.course.title));
    return HttpResponse.json({ totalLearners: isPageAdmin(request) ? 744 : 1284, totalCourses: isPageAdmin(request) ? visibleCourses(request).length : 18, totalRevenue: isPageAdmin(request) ? '15240.00' : '24850.00', pendingPayments: scopedPayments.filter((item) => item.status === 'slip_uploaded').length });
  }),
  http.get(`${API_URL}/admin/dashboard/revenue`, ({ request }) => {
    const url = new URL(request.url);
    const from = url.searchParams.get('from')?.slice(0, 10);
    const to = url.searchParams.get('to')?.slice(0, 10);
    const data = (isPageAdmin(request) ? seedRevenue.slice(-6) : seedRevenue).filter((item) => (!from || item.date >= from) && (!to || item.date <= to));
    return HttpResponse.json({ data });
  }),
  http.get(`${API_URL}/admin/dashboard/top-courses`, ({ request }) => HttpResponse.json({ data: [
    { courseId: COURSE_IDS.beginner, title: 'Japanese for Beginners (JLPT N5)', enrollmentCount: 426, revenue: '12240.00' },
    { courseId: COURSE_IDS.hiragana, title: 'Hiragana in 7 Days', enrollmentCount: 318, revenue: '0.00' },
    { courseId: COURSE_IDS.conversation, title: 'Everyday Japanese Conversation', enrollmentCount: 207, revenue: '6013.00' },
  ].filter((course) => canAccessCourse(request, course.courseId)) })),
  http.get(`${API_URL}/admin/scheduled-content`, ({ request }) => {
    const upcoming = [
      { id: '2bbc1d69-ff6b-48a8-a681-1631dd01a755', title: 'The K row', type: 'episode' as const, scheduledAt: courses[0].chapters?.[0].episodes[1].publishAt },
      { id: COURSE_IDS.conversation, title: 'Everyday Japanese Conversation', type: 'course' as const, scheduledAt: courses[2].publishAt },
    ].filter((item) => item.type === 'course' ? canAccessCourse(request, item.id) : !isPageAdmin(request) || pageAdminCourseIds.has(COURSE_IDS.beginner));
    return page(upcoming, request);
  }),
  http.get(`${API_URL}/admin/courses`, ({ request }) => {
    const url = new URL(request.url);
    const search = (url.searchParams.get('search') ?? '').toLowerCase();
    const status = url.searchParams.get('status');
    const premium = url.searchParams.get('isPremium');
    const items = visibleCourses(request).filter((course) => course.title.toLowerCase().includes(search) && (!status || course.status === status) && (premium === null || String(course.isPremium) === premium));
    return page(items.map(({ chapters: _chapters, ...course }) => ({ ...course, chapterCount: _chapters?.length ?? 0, learnerCount: course.id === COURSE_IDS.beginner ? 426 : course.id === COURSE_IDS.hiragana ? 318 : 207 })), request);
  }),
  http.post(`${API_URL}/admin/courses`, async ({ request }) => {
    const body = await readBody(request, courseInput);
    if (!body) return badRequest('Course details are invalid');
    const created: Course = { id: crypto.randomUUID(), title: body.title, slug: body.slug ?? body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), description: body.description ?? '', coverUrl: body.coverUrl ?? null, isPremium: body.isPremium ?? false, price: body.price ?? null, currency: body.currency ?? null, status: body.status ?? 'draft', publishAt: body.publishAt ?? null, updatedAt: new Date().toISOString(), chapters: [] };
    courses = [created, ...courses];
    if (isPageAdmin(request)) pageAdminCourseIds.add(created.id);
    return HttpResponse.json(created, { status: 201 });
  }),
  http.get(`${API_URL}/admin/courses/:id`, ({ params, request }) => {
    const course = courses.find((item) => item.id === params.id);
    return course && canAccessCourse(request, course.id) ? HttpResponse.json(courseWithBookCounts(course)) : notFound();
  }),
  http.patch(`${API_URL}/admin/courses/:id`, async ({ params, request }) => {
    const course = courses.find((item) => item.id === params.id);
    if (!course || !canAccessCourse(request, course.id)) return notFound();
    const body = await readBody(request, courseInput.partial());
    if (!body) return badRequest('Course details are invalid');
    Object.assign(course, body, { updatedAt: new Date().toISOString() });
    return HttpResponse.json(courseWithBookCounts(course));
  }),
  http.get(`${API_URL}/admin/courses/:id/books`, ({ params, request }) => {
    const course = courses.find((item) => item.id === params.id);
    if (!course || !canAccessCourse(request, course.id)) return notFound();
    const url = new URL(request.url);
    const scope = url.searchParams.get('scope');
    const chapterId = url.searchParams.get('chapterId');
    const search = (url.searchParams.get('search') ?? '').toLocaleLowerCase();
    const matching = books.filter((book) => bookCourseId(book) === course.id && (!scope || book.scope === scope) && (!chapterId || book.attachedTo.id === chapterId) && book.title.toLocaleLowerCase().includes(search)).sort((a, b) => a.position - b.position);
    return page(matching, request);
  }),
  http.post(`${API_URL}/admin/courses/:id/books`, async ({ params, request }) => {
    const course = courses.find((item) => item.id === params.id);
    if (!course || !canAccessCourse(request, course.id)) return notFound();
    return createBookFromForm(request, { scope: 'course', id: course.id }, { type: 'course', id: course.id, title: course.title });
  }),
  http.post(`${API_URL}/admin/chapters/:id/books`, async ({ params, request }) => {
    const course = courseForChapter(String(params.id));
    const chapter = course?.chapters?.find((item) => item.id === params.id);
    if (!course || !chapter || !canAccessCourse(request, course.id)) return notFound();
    return createBookFromForm(request, { scope: 'chapter', id: chapter.id }, { type: 'chapter', id: chapter.id, title: chapter.title });
  }),
  http.get(`${API_URL}/admin/books/:id`, ({ params, request }) => {
    const book = books.find((item) => item.id === params.id);
    return book && canAccessBook(request, book) ? HttpResponse.json({ ...book, previewUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' }) : notFound();
  }),
  http.patch(`${API_URL}/admin/books/:id`, async ({ params, request }) => {
    const book = books.find((item) => item.id === params.id);
    if (!book || !canAccessBook(request, book)) return notFound();
    const patch = await readBody(request, bookPatchSchema);
    if (!patch) return badRequest('Book details are invalid');
    const next = { ...book, ...patch };
    if (next.status === 'published' && !next.canView && !next.canDownload) return bookError(400, 'BOOK_NO_ACCESS_MODE', 'Published books require view or download permission');
    Object.assign(book, patch);
    return HttpResponse.json(book);
  }),
  http.put(`${API_URL}/admin/books/:id/file`, async ({ params, request }) => {
    const book = books.find((item) => item.id === params.id);
    if (!book || !canAccessBook(request, book)) return notFound();
    const file = (await request.formData()).get('file');
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.pdf') || file.type !== 'application/pdf') return bookError(400, 'BOOK_INVALID_FILE', 'Choose a valid PDF file');
    if (file.size > 50 * 1024 * 1024) return bookError(413, 'BOOK_TOO_LARGE', 'Book exceeds BOOK_MAX_MB');
    Object.assign(book, { fileName: file.name, sizeBytes: file.size, pageCount: null });
    return HttpResponse.json(book);
  }),
  http.delete(`${API_URL}/admin/books/:id`, ({ params, request }) => {
    const book = books.find((item) => item.id === params.id);
    if (!book || !canAccessBook(request, book)) return notFound();
    books = books.filter((item) => item.id !== book.id);
    return HttpResponse.json({ deleted: true });
  }),
  http.put(`${API_URL}/admin/courses/:id/books/reorder`, async ({ params, request }) => {
    const course = courses.find((item) => item.id === params.id);
    if (!course || !canAccessCourse(request, course.id)) return notFound();
    const body = await readBody(request, z.object({ ids: z.array(z.string()) }));
    const siblings = books.filter((book) => book.scope === 'course' && book.attachedTo.id === course.id);
    if (!body || body.ids.length !== siblings.length || new Set(body.ids).size !== siblings.length || body.ids.some((id) => !siblings.some((book) => book.id === id))) return badRequest('Book order is invalid');
    body.ids.forEach((id, position) => { const book = siblings.find((item) => item.id === id); if (book) book.position = position + 1; });
    return HttpResponse.json({ ids: body.ids });
  }),
  http.put(`${API_URL}/admin/chapters/:id/books/reorder`, async ({ params, request }) => {
    const course = courseForChapter(String(params.id));
    const chapter = course?.chapters?.find((item) => item.id === params.id);
    if (!course || !chapter || !canAccessCourse(request, course.id)) return notFound();
    const body = await readBody(request, z.object({ ids: z.array(z.string()) }));
    const siblings = books.filter((book) => book.scope === 'chapter' && book.attachedTo.id === chapter.id);
    if (!body || body.ids.length !== siblings.length || new Set(body.ids).size !== siblings.length || body.ids.some((id) => !siblings.some((book) => book.id === id))) return badRequest('Book order is invalid');
    body.ids.forEach((id, position) => { const book = siblings.find((item) => item.id === id); if (book) book.position = position + 1; });
    return HttpResponse.json({ ids: body.ids });
  }),
  http.delete(`${API_URL}/admin/courses/:id`, ({ params, request }) => {
    const existing = courses.find((item) => item.id === params.id);
    if (!existing || !canAccessCourse(request, existing.id)) return notFound();
    courses = courses.filter((item) => item.id !== params.id);
    pageAdminCourseIds.delete(existing.id);
    return HttpResponse.json({ id: existing.id });
  }),
  http.post(`${API_URL}/admin/courses/:id/chapters`, async ({ params, request }) => {
    const course = courses.find((item) => item.id === params.id);
    if (!course || !canAccessCourse(request, course.id)) return notFound();
    const body = await readBody(request, chapterInput);
    if (!body) return badRequest('Chapter details are invalid');
    const chapter = { id: crypto.randomUUID(), courseId: course.id, title: body.title, status: body.status ?? 'draft' as const, position: course.chapters?.length ?? 0, episodes: [] };
    course.chapters = [...(course.chapters ?? []), chapter];
    return HttpResponse.json(chapter, { status: 201 });
  }),
  http.patch(`${API_URL}/admin/chapters/:id`, async ({ params, request }) => {
    const course = courseForChapter(String(params.id));
    const chapter = course?.chapters?.find((item) => item.id === params.id);
    if (!course || !chapter || !canAccessCourse(request, course.id)) return notFound();
    const body = await readBody(request, chapterInput.partial());
    if (!body) return badRequest('Chapter details are invalid');
    Object.assign(chapter, body);
    return HttpResponse.json(chapter);
  }),
  http.delete(`${API_URL}/admin/chapters/:id`, ({ params, request }) => {
    const course = courseForChapter(String(params.id));
    if (!course || !canAccessCourse(request, course.id)) return notFound();
    course.chapters = course.chapters?.filter((chapter) => chapter.id !== params.id);
    return HttpResponse.json({ id: params.id });
  }),
  http.post(`${API_URL}/admin/courses/:id/cover`, ({ params, request }) => {
    const course = courses.find((item) => item.id === params.id);
    if (!course || !canAccessCourse(request, course.id)) return notFound();
    course.coverUrl = `https://images.example.test/courses/${course.id}.webp`;
    return HttpResponse.json({ coverUrl: course.coverUrl });
  }),
  http.put(`${API_URL}/admin/chapters/:id/episodes/reorder`, async ({ params, request }) => {
    const course = courseForChapter(String(params.id));
    const chapter = course?.chapters?.find((item) => item.id === params.id);
    if (!course || !chapter || !canAccessCourse(request, course.id)) return notFound();
    const body = await readBody(request, z.object({ ids: z.array(z.string()) }));
    if (!body) return badRequest('Episode order is invalid');
    chapter.episodes = body.ids.flatMap((id, position) => { const episode = chapter.episodes.find((item) => item.id === id); return episode ? [{ ...episode, position }] : []; });
    return HttpResponse.json({ success: true });
  }),
  http.patch(`${API_URL}/admin/episodes/:id`, async ({ params, request }) => {
    const course = courseForEpisode(String(params.id));
    const episode = course?.chapters?.flatMap((chapter) => chapter.episodes).find((item) => item.id === params.id);
    if (!course || !episode || !canAccessCourse(request, course.id)) return notFound();
    const body = await readBody(request, episodeInput.partial().extend({ scheduledAt: z.string().nullable().optional() }));
    if (!body) return badRequest('Episode details are invalid');
    const { scheduledAt, ...details } = body;
    Object.assign(episode, details);
    if (scheduledAt !== undefined) episode.videoScheduledAt = scheduledAt;
    return HttpResponse.json(episode);
  }),
  http.post(`${API_URL}/admin/episodes/:id/video/upload-url`, async ({ params, request }) => {
    const course = courseForEpisode(String(params.id));
    const episode = course?.chapters?.flatMap((chapter) => chapter.episodes).find((item) => item.id === params.id);
    const body = await readBody(request, z.object({ ext: z.enum(['mp4', 'mov', 'webm']) }));
    if (!course || !episode || !body || !canAccessCourse(request, course.id)) return notFound();
    const key = `${episode.id}-${crypto.randomUUID()}`;
    return HttpResponse.json({ uploadUrl: `${API_URL}/mock-storage/${key}`, storageKey: key, headers: { 'Content-Type': body.ext === 'mp4' ? 'video/mp4' : body.ext === 'mov' ? 'video/quicktime' : 'video/webm' } });
  }),
  http.put(`${API_URL}/mock-storage/:key`, () => new HttpResponse(null, { status: 200 })),
  http.post(`${API_URL}/admin/episodes/:id/video`, async ({ params, request }) => {
    const course = courseForEpisode(String(params.id));
    const episode = course?.chapters?.flatMap((chapter) => chapter.episodes).find((item) => item.id === params.id);
    const body = await readBody(request, z.object({ storageKey: z.string(), durationSec: z.number().int().min(1), scheduledAt: z.string().nullable().optional() }));
    if (!course || !episode || !body || !canAccessCourse(request, course.id)) return notFound();
    episode.playbackUrl = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
    episode.videoDurationSec = body.durationSec;
    episode.videoUploadStatus = 'ready';
    if (body.scheduledAt !== undefined) episode.videoScheduledAt = body.scheduledAt;
    return HttpResponse.json(episode);
  }),
  http.delete(`${API_URL}/admin/episodes/:id/video`, ({ params, request }) => {
    const course = courseForEpisode(String(params.id));
    const episode = course?.chapters?.flatMap((chapter) => chapter.episodes).find((item) => item.id === params.id);
    if (!course || !episode || !canAccessCourse(request, course.id)) return notFound();
    episode.playbackUrl = null; episode.videoDurationSec = null; episode.videoUploadStatus = null; episode.videoScheduledAt = null;
    return HttpResponse.json({ id: episode.id });
  }),
  http.put(`${API_URL}/admin/courses/:id/chapters/reorder`, async ({ params, request }) => {
    const course = courses.find((item) => item.id === params.id);
    if (!course || !canAccessCourse(request, course.id)) return notFound();
    const body = await request.json() as { ids: string[] };
    const chapters = course.chapters ?? [];
    course.chapters = body.ids.flatMap((id, position) => {
      const chapter = chapters.find((item) => item.id === id);
      return chapter ? [{ ...chapter, position }] : [];
    });
    return HttpResponse.json({ success: true });
  }),
  http.post(`${API_URL}/admin/chapters/:id/episodes`, async ({ params, request }) => {
    const course = courseForChapter(String(params.id));
    const chapter = course?.chapters?.find((item) => item.id === params.id);
    if (!course || !chapter || !canAccessCourse(request, course.id)) return notFound();
    const body = await readBody(request, episodeInput);
    if (!body) return badRequest('Episode details are invalid');
    const episode = { id: crypto.randomUUID(), chapterId: chapter.id, title: body.title, description: body.description ?? null, position: chapter.episodes.length, status: body.status ?? 'draft' as const, publishAt: null, playbackUrl: null, videoDurationSec: null, videoUploadStatus: null, videoScheduledAt: null };
    chapter.episodes.push(episode);
    return HttpResponse.json(episode, { status: 201 });
  }),
  http.get(`${API_URL}/admin/payments`, ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const courseId = url.searchParams.get('courseId');
    const eligibleTitles = new Set(visibleCourses(request).filter((course) => !courseId || course.id === courseId).map((course) => course.title));
    const items = payments.filter((payment) => eligibleTitles.has(payment.course.title) && (!status || payment.status === status)).map(({ id, user, course, amount, discountAmount, finalAmount, hasSlip, status: paymentStatus, rejectReason, reviewedAt, createdAt }) => ({ id, user, course, amount, discountAmount, finalAmount, hasSlip, status: paymentStatus, rejectReason, reviewedAt, createdAt }));
    return page(items, request);
  }),
  http.get(`${API_URL}/admin/payments/:id`, ({ params, request }) => {
    const payment = payments.find((item) => item.id === params.id);
    return payment && canAccessPayment(request, payment) ? HttpResponse.json(payment) : notFound();
  }),
  http.post(`${API_URL}/admin/payments/:id/approve`, ({ params, request }) => {
    const payment = payments.find((item) => item.id === params.id);
    if (!payment || !canAccessPayment(request, payment)) return notFound();
    if (payment.status !== 'slip_uploaded') return HttpResponse.json({ statusCode: 409, code: 'INVALID_PAYMENT_STATE', message: 'Only uploaded slips may be approved' }, { status: 409 });
    payment.status = 'approved';
    payment.reviewedAt = new Date().toISOString();
    return HttpResponse.json(payment);
  }),
  http.post(`${API_URL}/admin/payments/:id/reject`, async ({ params, request }) => {
    const payment = payments.find((item) => item.id === params.id);
    if (!payment || !canAccessPayment(request, payment)) return notFound();
    const body = await readBody(request, z.object({ rejectReason: z.string().min(1) }));
    if (!body) return badRequest('A rejection reason is required');
    if (!body.rejectReason?.trim()) return badRequest('A rejection reason is required');
    if (payment.status !== 'slip_uploaded') return HttpResponse.json({ statusCode: 409, code: 'INVALID_PAYMENT_STATE', message: 'Only uploaded slips may be rejected' }, { status: 409 });
    payment.status = 'rejected';
    payment.rejectReason = body.rejectReason;
    payment.reviewedAt = new Date().toISOString();
    return HttpResponse.json(payment);
  }),
  http.get(`${API_URL}/admin/promo-codes`, ({ request }) => page(promos.filter((promo) => canAccessPromo(request, promo)), request)),
  http.post(`${API_URL}/admin/promo-codes`, async ({ request }) => {
    const body = await readBody(request, promoInput);
    if (!body) return badRequest('Promo details are invalid');
    if (isPageAdmin(request) && (!body.courseId || !canAccessCourse(request, body.courseId))) return forbidden();
    if (promos.some((promo) => promo.code === body.code)) return HttpResponse.json({ statusCode: 409, code: 'CONFLICT', message: 'Promo code already exists' }, { status: 409 });
    const promo = { ...body, id: crypto.randomUUID(), usedCount: 0 };
    promos = [promo, ...promos];
    return HttpResponse.json(promo, { status: 201 });
  }),
  http.patch(`${API_URL}/admin/promo-codes/:id`, async ({ params, request }) => {
    const promo = promos.find((item) => item.id === params.id);
    if (!promo || !canAccessPromo(request, promo)) return notFound();
    const body = await readBody(request, promoInput.partial());
    if (!body) return badRequest('Promo details are invalid');
    if (isPageAdmin(request) && body.courseId !== undefined && (!body.courseId || !canAccessCourse(request, body.courseId))) return forbidden();
    Object.assign(promo, body);
    return HttpResponse.json(promo);
  }),
  http.delete(`${API_URL}/admin/promo-codes/:id`, ({ params, request }) => {
    const promo = promos.find((item) => item.id === params.id);
    if (!promo || !canAccessPromo(request, promo)) return notFound();
    promos = promos.filter((item) => item.id !== params.id);
    return HttpResponse.json({ id: promo.id });
  }),
  http.get(`${API_URL}/admin/payment-methods`, ({ request }) => isPageAdmin(request) ? forbidden() : page(methods, request)),
  http.post(`${API_URL}/admin/payment-methods`, async ({ request }) => {
    if (isPageAdmin(request)) return forbidden();
    const body = await readBody(request, methodInput);
    if (!body) return badRequest('Payment method details are invalid');
    const method: PaymentMethod = { ...body, id: crypto.randomUUID() };
    methods = [method, ...methods];
    return HttpResponse.json(method, { status: 201 });
  }),
  http.delete(`${API_URL}/admin/payment-methods/:id`, ({ params, request }) => {
    if (isPageAdmin(request)) return forbidden();
    const method = methods.find((item) => item.id === params.id);
    if (!method) return notFound();
    methods = methods.filter((item) => item.id !== params.id);
    return HttpResponse.json({ id: method.id });
  }),
  http.patch(`${API_URL}/admin/payment-methods/:id`, async ({ params, request }) => {
    if (isPageAdmin(request)) return forbidden();
    const method = methods.find((item) => item.id === params.id);
    if (!method) return notFound();
    const body = await readBody(request, methodInput.partial());
    if (!body) return badRequest('Payment method details are invalid');
    Object.assign(method, body);
    return HttpResponse.json(method);
  }),
  http.get(`${API_URL}/admin/courses/:id/learners`, ({ params, request }) => {
    if (!courses.some((course) => course.id === params.id && canAccessCourse(request, course.id))) return notFound();
    return page([
    { id: 'en-1', user: { id: 'u-11', displayName: 'Aiko Tanaka', avatarUrl: null }, progressPct: 68, enrolledAt: new Date().toISOString(), lastActivityAt: new Date().toISOString() },
    { id: 'en-2', user: { id: 'u-12', displayName: 'Kenji Mori', avatarUrl: null }, progressPct: 32, enrolledAt: new Date().toISOString(), lastActivityAt: new Date().toISOString() },
    { id: 'en-3', user: { id: 'u-13', displayName: 'Mina Park', avatarUrl: null }, progressPct: 91, enrolledAt: new Date().toISOString(), lastActivityAt: new Date().toISOString() },
    ], request);
  }),
  http.get(`${API_URL}/admin/courses/:id/stats`, ({ params, request }) => {
    if (!courses.some((course) => course.id === params.id && canAccessCourse(request, course.id))) return notFound();
    return HttpResponse.json({ enrollmentCount: 426, completionRate: 38.2, averageProgressPct: '64.8', quizzes: [{ id: 'quiz-1', title: 'Hiragana review', averageScore: 82, passRate: 76 }] });
  }),
  http.get(`${API_URL}/admin/courses/:id/channel`, ({ params, request }) => {
    if (!courses.some((course) => course.id === params.id && canAccessCourse(request, course.id))) return notFound();
    const id = `channel-${params.id}`;
    return HttpResponse.json({ id, courseId: params.id, name: channelNames[id] ?? 'Learner community', memberCount: 426 });
  }),
  http.patch(`${API_URL}/admin/channels/:id`, async ({ params, request }) => {
    if (!canAccessChannel(request, String(params.id))) return notFound();
    const body = await readBody(request, z.object({ name: z.string().min(1) }));
    if (!body) return badRequest('A channel name is required');
    channelNames[String(params.id)] = body.name;
    return HttpResponse.json({ id: params.id, name: body.name, memberCount: 426 });
  }),
  http.get(`${API_URL}/admin/channels/:id/messages`, ({ params, request }) => canAccessChannel(request, String(params.id)) ? page(messages.filter((item) => item.channelId === params.id), request) : notFound()),
  http.post(`${API_URL}/admin/channels/:id/messages`, async ({ params, request }) => {
    if (!canAccessChannel(request, String(params.id))) return notFound();
    const body = await readBody(request, messageInput);
    if (!body) return badRequest('Message title and body are required');
    const message = { ...body, id: crypto.randomUUID(), channelId: String(params.id), createdAt: new Date().toISOString() };
    messages = [message, ...messages];
    return HttpResponse.json(message, { status: 201 });
  }),
  http.delete(`${API_URL}/admin/messages/:id`, ({ params, request }) => {
    const message = messages.find((item) => item.id === params.id);
    if (!message || !canAccessChannel(request, message.channelId)) return notFound();
    messages = messages.filter((item) => item.id !== params.id);
    return HttpResponse.json({ id: message.id });
  }),
  http.get(`${API_URL}/admin/channels/:id/members`, ({ params, request }) => canAccessChannel(request, String(params.id)) ? page(members, request) : notFound()),
  http.delete(`${API_URL}/admin/channels/:id/members/:userId`, ({ params, request }) => {
    if (!canAccessChannel(request, String(params.id))) return notFound();
    members = members.filter((member) => member.user.id !== params.userId);
    return HttpResponse.json({ success: true });
  }),
  http.get(`${API_URL}/admin/quizzes`, ({ request }) => {
    const url = new URL(request.url);
    const items: QuizListItem[] = quizzes.flatMap((quiz): QuizListItem[] => {
      const course = quiz.courseId ? courses.find((item) => item.id === quiz.courseId) : quiz.chapterId ? courseForChapter(quiz.chapterId) : quiz.episodeId ? courseForEpisode(quiz.episodeId) : undefined;
      if (!course || !canAccessCourse(request, course.id) || !canAccessQuiz(request, quiz)) return [];
      const chapter = course.chapters?.find((item) => item.id === quiz.chapterId || item.episodes.some((episode) => episode.id === quiz.episodeId));
      const episode = chapter?.episodes.find((item) => item.id === quiz.episodeId);
      const common = { id: quiz.id, title: quiz.title, passScore: quiz.passScore, timeLimitSec: quiz.timeLimitSec, course: { id: course.id, title: course.title }, questionCount: quiz.questions.length, totalPoints: quiz.questions.reduce((sum, question) => sum + question.points, 0), attemptCount: previewQuizResults[quiz.id]?.attemptCount ?? 0, passRate: previewQuizResults[quiz.id]?.passRate ?? null, averageScore: previewQuizResults[quiz.id]?.averageScore ?? null };
      if (quiz.courseId) return [{ ...common, scope: 'course', attachedTo: { type: 'course', id: course.id, title: course.title } }];
      if (quiz.chapterId && chapter) return [{ ...common, scope: 'chapter', attachedTo: { type: 'chapter', id: chapter.id, title: chapter.title, chapterId: chapter.id, chapterTitle: chapter.title, chapterPosition: chapter.position } }];
      return episode && chapter ? [{ ...common, scope: 'episode', attachedTo: { type: 'episode', id: episode.id, title: episode.title, chapterId: chapter.id, chapterTitle: chapter.title, chapterPosition: chapter.position, episodePosition: episode.position } }] : [];
    }).filter((quiz) => (!url.searchParams.has('courseId') || quiz.course?.id === url.searchParams.get('courseId')) && (!url.searchParams.has('scope') || quiz.scope === url.searchParams.get('scope')) && (!url.searchParams.has('search') || quiz.title.toLocaleLowerCase().includes((url.searchParams.get('search') ?? '').toLocaleLowerCase())));
    const sort = url.searchParams.get('sort');
    if (sort === 'title') items.sort((left, right) => left.title.localeCompare(right.title));
    if (sort === 'attempts') items.sort((left, right) => right.attemptCount - left.attemptCount);
    if (sort === 'passRate') items.sort((left, right) => (left.passRate ?? Number.POSITIVE_INFINITY) - (right.passRate ?? Number.POSITIVE_INFINITY));
    return page(items, request);
  }),
  http.get(`${API_URL}/admin/courses/:id/quizzes`, ({ params, request }) => {
    const course = courses.find((item) => item.id === params.id);
    if (!course || !canAccessCourse(request, course.id)) return notFound();
    const items: QuizListItem[] = quizzes.flatMap((quiz): QuizListItem[] => {
      const summary = {
        id: quiz.id, title: quiz.title, passScore: quiz.passScore, timeLimitSec: quiz.timeLimitSec, course: { id: course.id, title: course.title },
        questionCount: quiz.questions.length, totalPoints: quiz.questions.reduce((sum, question) => sum + question.points, 0),
        attemptCount: previewQuizResults[quiz.id]?.attemptCount ?? 0,
        passRate: previewQuizResults[quiz.id]?.passRate ?? null,
        averageScore: previewQuizResults[quiz.id]?.averageScore ?? null,
      };
      if (quiz.courseId === course.id) return [{ ...summary, scope: 'course', attachedTo: { type: 'course', id: course.id, title: course.title } }];
      const chapter = course.chapters?.find((item) => item.id === quiz.chapterId || item.episodes.some((episode) => episode.id === quiz.episodeId));
      if (!chapter) return [];
      if (quiz.chapterId === chapter.id) return [{ ...summary, scope: 'chapter', attachedTo: { type: 'chapter', id: chapter.id, title: chapter.title, chapterId: chapter.id, chapterTitle: chapter.title, chapterPosition: chapter.position } }];
      const episode = chapter.episodes.find((item) => item.id === quiz.episodeId);
      return episode ? [{ ...summary, scope: 'episode', attachedTo: { type: 'episode', id: episode.id, title: episode.title, chapterId: chapter.id, chapterTitle: chapter.title, chapterPosition: chapter.position, episodePosition: episode.position } }] : [];
    });
    return page(items, request);
  }),
  http.delete(`${API_URL}/admin/quizzes/:id`, ({ params, request }) => {
    const quiz = quizzes.find((item) => item.id === params.id);
    if (!quiz || !canAccessQuiz(request, quiz)) return notFound();
    quizzes = quizzes.filter((item) => item.id !== params.id);
    return HttpResponse.json({ deleted: true });
  }),
  http.post(`${API_URL}/admin/quizzes`, async ({ request }) => {
    const body = await readBody(request, quizInput);
    if (!body || [body.courseId, body.chapterId, body.episodeId].filter(Boolean).length !== 1) return badRequest('Attach the quiz to exactly one course, chapter, or episode.');
    const quiz: MockQuiz = { id: crypto.randomUUID(), title: body.title, passScore: body.passScore, timeLimitSec: body.timeLimitSec, courseId: body.courseId ?? null, chapterId: body.chapterId ?? null, episodeId: body.episodeId ?? null, questions: [] };
    if (!canAccessQuiz(request, quiz)) return forbidden();
    quizzes = [quiz, ...quizzes];
    return HttpResponse.json(quiz, { status: 201 });
  }),
  http.get(`${API_URL}/admin/quizzes/:id`, ({ params, request }) => { const quiz = quizzes.find((item) => item.id === params.id); return quiz && canAccessQuiz(request, quiz) ? HttpResponse.json(quiz) : notFound(); }),
  http.patch(`${API_URL}/admin/quizzes/:id`, async ({ params, request }) => {
    const quiz = quizzes.find((item) => item.id === params.id);
    if (!quiz || !canAccessQuiz(request, quiz)) return notFound();
    const body = await readBody(request, quizInput.partial());
    if (!body) return badRequest('Quiz details are invalid');
    if (!canAccessQuiz(request, { ...quiz, ...body })) return forbidden();
    Object.assign(quiz, body);
    return HttpResponse.json(quiz);
  }),
  http.get(`${API_URL}/admin/quizzes/:id/attempts`, ({ params, request }) => {
    const quiz = quizzes.find((item) => item.id === params.id);
    return quiz && canAccessQuiz(request, quiz) ? HttpResponse.json({ data: [{ id: 'attempt-1', user: { displayName: 'Aiko Tanaka' }, score: 90, passed: true, submittedAt: new Date().toISOString() }, { id: 'attempt-2', user: { displayName: 'Kenji Mori' }, score: 60, passed: false, submittedAt: new Date().toISOString() }], meta: { page: 1, limit: 20, total: 2 }, stats: { averageScore: 75, passRate: 50 } }) : notFound();
  }),
  http.post(`${API_URL}/admin/quizzes/:id/questions`, async ({ params, request }) => {
    const quiz = quizzes.find((item) => item.id === params.id);
    const body = await readBody(request, questionInput);
    if (!quiz || !canAccessQuiz(request, quiz)) return notFound();
    if (!body || !body.options.some((option) => option.isCorrect)) return badRequest('At least one correct option is required');
    const question: MockQuestion = { id: crypto.randomUUID(), questionText: body.questionText, position: quiz.questions.length, points: body.points, explanation: body.explanation ?? null, options: body.options.map((option, position) => ({ id: crypto.randomUUID(), optionText: option.optionText, isCorrect: option.isCorrect, position })) };
    quiz.questions = [...quiz.questions, question];
    return HttpResponse.json(question, { status: 201 });
  }),
  http.put(`${API_URL}/admin/quizzes/:id/questions/reorder`, async ({ params, request }) => {
    const quiz = quizzes.find((item) => item.id === params.id);
    const body = await readBody(request, z.object({ ids: z.array(z.string()) }));
    if (!quiz || !canAccessQuiz(request, quiz) || !body) return notFound();
    quiz.questions = body.ids.flatMap((id, position) => { const question = quiz.questions.find((item) => item.id === id); return question ? [{ ...question, position }] : []; });
    return HttpResponse.json({ success: true });
  }),
  http.patch(`${API_URL}/admin/questions/:id`, async ({ params, request }) => {
    const quiz = quizForQuestion(String(params.id));
    const question = quiz?.questions.find((item) => item.id === params.id);
    if (!quiz || !question || !canAccessQuiz(request, quiz)) return notFound();
    const body = await readBody(request, questionInput.omit({ options: true }).partial());
    if (!body) return badRequest('Question details are invalid');
    Object.assign(question, body);
    return HttpResponse.json(question);
  }),
  http.delete(`${API_URL}/admin/questions/:id`, ({ params, request }) => {
    const quiz = quizForQuestion(String(params.id));
    if (!quiz || !canAccessQuiz(request, quiz)) return notFound();
    quiz.questions = quiz.questions.filter((question) => question.id !== params.id);
    return HttpResponse.json({ id: params.id });
  }),
  http.post(`${API_URL}/admin/questions/:id/options`, async ({ params, request }) => {
    const quiz = quizForQuestion(String(params.id));
    const question = quiz?.questions.find((item) => item.id === params.id);
    const body = await readBody(request, z.object({ optionText: z.string().min(1), isCorrect: z.boolean(), position: z.number().int() }));
    if (!quiz || !question || !canAccessQuiz(request, quiz) || !body) return notFound();
    const option = { ...body, id: crypto.randomUUID() };
    question.options.push(option);
    return HttpResponse.json(option, { status: 201 });
  }),
  http.patch(`${API_URL}/admin/options/:id`, async ({ params, request }) => {
    const quiz = quizForOption(String(params.id));
    const option = quiz?.questions.flatMap((question) => question.options).find((item) => item.id === params.id);
    const body = await readBody(request, z.object({ optionText: z.string().min(1), isCorrect: z.boolean(), position: z.number().int() }));
    if (!quiz || !option || !canAccessQuiz(request, quiz) || !body) return notFound();
    Object.assign(option, body);
    return HttpResponse.json(option);
  }),
  http.delete(`${API_URL}/admin/options/:id`, ({ params, request }) => {
    const quiz = quizForOption(String(params.id));
    if (!quiz || !canAccessQuiz(request, quiz)) return notFound();
    for (const question of quiz.questions) question.options = question.options.filter((option) => option.id !== params.id);
    return HttpResponse.json({ id: params.id });
  }),
  http.get(`${API_URL}/admin/chapters/:id/flashcards`, ({ params, request }) => canAccessChapter(request, String(params.id)) ? page(flashcards.filter((item) => item.chapterId === params.id), request) : notFound()),
  http.post(`${API_URL}/admin/chapters/:id/flashcards`, async ({ params, request }) => {
    if (!canAccessChapter(request, String(params.id))) return notFound();
    const body = await readBody(request, z.object({ frontText: z.string().min(1), backText: z.string().min(1), audioUrl: z.string().nullable().optional() }));
    if (!body) return badRequest('Flashcard details are invalid');
    const card = { id: crypto.randomUUID(), chapterId: String(params.id), frontText: body.frontText, backText: body.backText, audioUrl: body.audioUrl ?? null, position: flashcards.length };
    flashcards.push(card);
    return HttpResponse.json(card, { status: 201 });
  }),
  http.patch(`${API_URL}/admin/flashcards/:id`, async ({ params, request }) => {
    const card = flashcards.find((item) => item.id === params.id);
    if (!card || !canAccessChapter(request, card.chapterId)) return notFound();
    const body = await readBody(request, z.object({ frontText: z.string().min(1).optional(), backText: z.string().min(1).optional(), audioUrl: z.string().nullable().optional() }));
    if (!body) return badRequest('Flashcard details are invalid');
    Object.assign(card, body);
    return HttpResponse.json(card);
  }),
  http.delete(`${API_URL}/admin/flashcards/:id`, ({ params, request }) => {
    const card = flashcards.find((item) => item.id === params.id);
    if (!card || !canAccessChapter(request, card.chapterId)) return notFound();
    flashcards = flashcards.filter((item) => item.id !== params.id);
    return HttpResponse.json({ deleted: true });
  }),
  http.post(`${API_URL}/admin/chapters/:id/flashcards/import`, async ({ params, request }) => {
    if (!canAccessChapter(request, String(params.id))) return notFound();
    const file = (await request.formData()).get('file');
    if (!file || typeof file === 'string') return badRequest('Choose a CSV file');
    const preview = parseFlashcardCsv(await file.text());
    if (preview.errors.length) return badRequest(preview.errors.join(' '));
    flashcards.push(...preview.rows.map((row, index) => ({ id: crypto.randomUUID(), chapterId: String(params.id), ...row, position: flashcards.length + index })));
    return HttpResponse.json({ count: preview.rows.length });
  }),
  http.get(`${API_URL}/admin/chapters/:id/audio`, ({ params, request }) => canAccessChapter(request, String(params.id)) ? page(audioTracks.filter((item) => item.chapterId === params.id), request) : notFound()),
  http.post(`${API_URL}/admin/chapters/:id/audio`, async ({ params, request }) => {
    if (!canAccessChapter(request, String(params.id))) return notFound();
    const form = await request.formData();
    const title = form.get('title');
    const type = form.get('type');
    const file = form.get('file');
    if (typeof title !== 'string' || !title.trim() || (type !== 'vocab' && type !== 'speaking') || !file || typeof file === 'string') return badRequest('Audio title, type, and MP3 file are required');
    if (!file.name.toLowerCase().endsWith('.mp3') || file.size > 30 * 1024 * 1024) return badRequest('MP3 files must be 30 MB or smaller');
    const track: MockAudio = { id: crypto.randomUUID(), chapterId: String(params.id), title: title.trim(), type, durationSec: Number(form.get('durationSec')) || 0, audioUrl: seedAudioTracks[0].audioUrl, position: audioTracks.length, fileSize: file.size };
    audioTracks.push(track);
    return HttpResponse.json(track, { status: 201 });
  }),
  http.patch(`${API_URL}/admin/audio/:id`, async ({ params, request }) => {
    const track = audioTracks.find((item) => item.id === params.id);
    if (!track || !canAccessChapter(request, track.chapterId)) return notFound();
    const body = await readBody(request, z.object({ title: z.string().trim().min(2).max(120).optional() }));
    if (!body) return badRequest('Use a title between 2 and 120 characters.');
    Object.assign(track, body);
    return HttpResponse.json(track);
  }),
  http.delete(`${API_URL}/admin/audio/:id`, ({ params, request }) => {
    const track = audioTracks.find((item) => item.id === params.id);
    if (!track || !canAccessChapter(request, track.chapterId)) return notFound();
    audioTracks = audioTracks.filter((item) => item.id !== params.id);
    return HttpResponse.json({ deleted: true });
  }),
];
