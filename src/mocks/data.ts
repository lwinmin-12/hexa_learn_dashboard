import type { Book, Course, Episode, Payment, PaymentMethod, PromoCode } from '@/lib/domain';

export const COURSE_IDS = {
  beginner: 'c9b2eb29-ecf1-4750-80bb-7426e344eb74',
  hiragana: 'f9df9080-4f41-45fd-890f-3eb1b3c34467',
  conversation: '9c133a35-0871-4771-81f0-e143a48e406e',
  contentPreview: '4bf337be-727d-4f83-b0ec-64a464de8154',
};

const now = new Date();
const daysAgo = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();
const inDays = (days: number) => new Date(now.getTime() + days * 86400000).toISOString();

export const seedCourses: Course[] = [
  {
    id: COURSE_IDS.beginner,
    title: 'Japanese for Beginners (JLPT N5)',
    slug: 'japanese-for-beginners-jlpt-n5',
    description: 'Build a strong foundation in Japanese with short lessons and guided practice.',
    coverUrl: null,
    isPremium: true,
    price: '49.00',
    currency: 'USD',
    status: 'published',
    publishAt: null,
    updatedAt: daysAgo(1),
    bookCount: 5,
    chapters: [
      {
        id: '2cfcceab-bf49-48c5-a9bb-512bbd530302',
        courseId: COURSE_IDS.beginner,
        title: 'Hiragana',
        position: 0,
        status: 'published',
        bookCount: 3,
        episodes: [
          { id: '1b19ade0-911e-4a5f-8ed9-10d7699ade88', chapterId: '2cfcceab-bf49-48c5-a9bb-512bbd530302', title: 'Meet the vowels', description: 'Learn the five vowel sounds.', position: 0, status: 'published', publishAt: null, playbackUrl: null, videoDurationSec: 420, videoUploadStatus: 'ready', videoScheduledAt: null },
          { id: '2bbc1d69-ff6b-48a8-a681-1631dd01a755', chapterId: '2cfcceab-bf49-48c5-a9bb-512bbd530302', title: 'The K row', description: 'Read and write か, き, く, け, こ.', position: 1, status: 'scheduled', publishAt: inDays(2), playbackUrl: null, videoDurationSec: null, videoUploadStatus: 'pending', videoScheduledAt: inDays(2) },
        ],
      },
      { id: '75c861e5-45da-4d30-8682-49c533b1bd5e', courseId: COURSE_IDS.beginner, title: 'First conversations', position: 1, status: 'draft', bookCount: 1, episodes: [] },
    ],
  },
  {
    id: COURSE_IDS.hiragana,
    title: 'Hiragana in 7 Days',
    slug: 'hiragana-in-7-days',
    description: 'A focused week of daily reading and writing practice.',
    coverUrl: null,
    isPremium: false,
    price: null,
    currency: null,
    status: 'published',
    publishAt: null,
    updatedAt: daysAgo(3),
    chapters: [{ id: '05f1c08a-ed29-4a6a-8224-b2da611c648a', courseId: COURSE_IDS.hiragana, title: 'Hiragana', position: 0, status: 'published', episodes: [] }],
  },
  {
    id: COURSE_IDS.conversation,
    title: 'Everyday Japanese Conversation',
    slug: 'everyday-japanese-conversation',
    description: 'Practical phrases for everyday situations in Japan.',
    coverUrl: null,
    isPremium: true,
    price: '29.00',
    currency: 'USD',
    status: 'scheduled',
    publishAt: inDays(5),
    updatedAt: daysAgo(5),
    chapters: [],
  },
  {
    id: '22cfc678-846a-4e4e-a6d4-f99c99d9d96a',
    title: 'Kanji Foundations',
    slug: 'kanji-foundations',
    description: 'Start recognizing everyday kanji through meaningful groups.',
    coverUrl: null,
    isPremium: true,
    price: '39.00',
    currency: 'USD',
    status: 'draft',
    publishAt: null,
    updatedAt: daysAgo(9),
    chapters: [],
  },
];

export const contentPreviewCourse: Course = {
  id: COURSE_IDS.contentPreview, title: 'Content layout preview', slug: 'content-layout-preview',
  description: 'Three chapters and eight episodes for reviewing the course editor.',
  coverUrl: null, isPremium: false, price: null, currency: null, status: 'draft', publishAt: null,
  chapters: [
    { title: 'Start with the basics', status: 'published', lessons: ['Meet the vowels', 'The K row', 'Read your first words'] },
    { title: 'Build a conversation', status: 'scheduled', lessons: ['The A は B です pattern', 'Ask a simple question', 'Introduce yourself'] },
    { title: 'Put it into practice', status: 'draft', lessons: ['At the café', 'Your first conversation'] },
  ].map((chapter, chapterIndex) => {
    const chapterId = `preview-chapter-${chapterIndex + 1}`;
    return {
      id: chapterId, courseId: COURSE_IDS.contentPreview, title: chapter.title,
      position: chapterIndex + 5, status: chapterIndex === 0 ? 'published' : chapterIndex === 1 ? 'scheduled' : 'draft',
      episodes: chapter.lessons.map((title, episodeIndex) => {
        const index = chapterIndex * 3 + episodeIndex;
        const videoStates = ['ready', 'pending', null, 'uploading', 'failed', 'ready', null, 'ready'] satisfies Episode['videoUploadStatus'][];
        return {
          id: `preview-episode-${index + 1}`, chapterId, title, description: null,
          position: episodeIndex + 4, status: index % 3 === 0 ? 'published' : index % 3 === 1 ? 'scheduled' : 'draft',
          publishAt: index % 3 === 1 ? inDays(index + 1) : null,
          playbackUrl: null, videoDurationSec: null, videoUploadStatus: videoStates[index],
          videoScheduledAt: index === 1 ? inDays(2) : null,
        };
      }),
    };
  }),
};
seedCourses.push(contentPreviewCourse);

export const seedBooks: Book[] = [
  { id: 'book-course-guide', title: 'Beginner study guide', description: 'A course overview and weekly plan.', fileName: 'beginner-study-guide.pdf', mimeType: 'application/pdf', sizeBytes: 2_400_000, pageCount: 18, canView: true, canDownload: false, status: 'published', position: 1, scope: 'course', attachedTo: { type: 'course', id: COURSE_IDS.beginner, title: 'Japanese for Beginners (JLPT N5)' }, createdAt: daysAgo(15) },
  { id: 'book-hiragana-chart', title: 'Hiragana practice sheets', description: null, fileName: 'hiragana-practice-sheets.pdf', mimeType: 'application/pdf', sizeBytes: 1_850_000, pageCount: 12, canView: true, canDownload: true, status: 'published', position: 1, scope: 'chapter', attachedTo: { type: 'chapter', id: '2cfcceab-bf49-48c5-a9bb-512bbd530302', title: 'Hiragana' }, createdAt: daysAgo(9) },
  { id: 'book-hiragana-strokes', title: 'Stroke order reference', description: 'Printable reference for the first hiragana set.', fileName: 'stroke-order.pdf', mimeType: 'application/pdf', sizeBytes: 950_000, pageCount: 6, canView: true, canDownload: false, status: 'published', position: 2, scope: 'chapter', attachedTo: { type: 'chapter', id: '2cfcceab-bf49-48c5-a9bb-512bbd530302', title: 'Hiragana' }, createdAt: daysAgo(8) },
  { id: 'book-hiragana-draft', title: 'Kana writing workbook', description: null, fileName: 'kana-workbook.pdf', mimeType: 'application/pdf', sizeBytes: 4_200_000, pageCount: null, canView: false, canDownload: false, status: 'draft', position: 3, scope: 'chapter', attachedTo: { type: 'chapter', id: '2cfcceab-bf49-48c5-a9bb-512bbd530302', title: 'Hiragana' }, createdAt: daysAgo(3) },
  { id: 'book-conversation-phrases', title: 'First conversation phrase list', description: null, fileName: 'first-phrases.pdf', mimeType: 'application/pdf', sizeBytes: 725_000, pageCount: 4, canView: false, canDownload: true, status: 'published', position: 1, scope: 'chapter', attachedTo: { type: 'chapter', id: '75c861e5-45da-4d30-8682-49c533b1bd5e', title: 'First conversations' }, createdAt: daysAgo(2) },
];

const toolsPreviewChapter = 'preview-chapter-1';
const sampleOrigin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
export const seedFlashcards = [
  ['あ', 'a'], ['い', 'i'], ['う', 'u'], ['え', 'e'], ['お', 'o'],
  ['か', 'ka'], ['き', 'ki'], ['く', 'ku'], ['ねこ', 'cat'], ['いぬ', 'dog'],
  ['ありがとう', 'thank you'], ['こんにちは', 'hello'],
].map(([frontText, backText], position) => ({
  id: `preview-card-${position + 1}`, chapterId: toolsPreviewChapter, frontText, backText,
  audioUrl: position === 0 ? `${sampleOrigin}/mock-audio/vocabulary.mp3` : null, position,
}));
export const seedAudioTracks: { id: string; chapterId: string; title: string; type: 'vocab' | 'speaking'; durationSec: number; audioUrl: string; position: number; fileSize?: number }[] = [
  { id: 'preview-audio-1', chapterId: toolsPreviewChapter, title: 'Vocabulary sample A', type: 'vocab', durationSec: 4, audioUrl: `${sampleOrigin}/mock-audio/vocabulary.mp3`, position: 0 },
  { id: 'preview-audio-2', chapterId: toolsPreviewChapter, title: 'Vocabulary sample B', type: 'vocab', durationSec: 4, audioUrl: `${sampleOrigin}/mock-audio/vocabulary.mp3`, position: 1 },
  { id: 'preview-audio-3', chapterId: toolsPreviewChapter, title: 'Speaking sample A', type: 'speaking', durationSec: 6, audioUrl: `${sampleOrigin}/mock-audio/speaking.mp3`, position: 2 },
  { id: 'preview-audio-4', chapterId: toolsPreviewChapter, title: 'Speaking sample B', type: 'speaking', durationSec: 6, audioUrl: `${sampleOrigin}/mock-audio/speaking.mp3`, position: 3 },
];

export const seedPayments: Payment[] = [
  { id: 'pmt-1001', user: { id: 'u-11', displayName: 'Aiko Tanaka' }, course: { title: 'Japanese for Beginners (JLPT N5)', currency: 'USD' }, paymentMethod: { name: 'Visa ending 4242', type: 'bank_transfer' }, promoCode: { code: 'WELCOME20' }, amount: '49.00', discountAmount: '9.80', finalAmount: '39.20', hasSlip: true, slipUrl: null, status: 'slip_uploaded', rejectReason: null, reviewedAt: null, createdAt: daysAgo(0) },
  { id: 'pmt-1002', user: { id: 'u-12', displayName: 'Kenji Mori' }, course: { title: 'Everyday Japanese Conversation', currency: 'USD' }, paymentMethod: { name: 'Bank transfer', type: 'bank_transfer' }, promoCode: null, amount: '29.00', discountAmount: '0.00', finalAmount: '29.00', hasSlip: true, slipUrl: null, status: 'slip_uploaded', rejectReason: null, reviewedAt: null, createdAt: daysAgo(1) },
  { id: 'pmt-1003', user: { id: 'u-13', displayName: 'Mina Park' }, course: { title: 'Japanese for Beginners (JLPT N5)', currency: 'USD' }, paymentMethod: { name: 'QR payment', type: 'qr' }, promoCode: null, amount: '49.00', discountAmount: '0.00', finalAmount: '49.00', hasSlip: true, slipUrl: null, status: 'approved', rejectReason: null, reviewedAt: daysAgo(2), createdAt: daysAgo(2) },
  { id: 'pmt-1004', user: { id: 'u-14', displayName: 'David Chen' }, course: { title: 'Hiragana in 7 Days', currency: 'USD' }, paymentMethod: { name: 'QR payment', type: 'qr' }, promoCode: null, amount: '0.00', discountAmount: '0.00', finalAmount: '0.00', hasSlip: false, slipUrl: null, status: 'pending', rejectReason: null, reviewedAt: null, createdAt: daysAgo(4) },
];

export const seedPromos: PromoCode[] = [
  { id: 'promo-01', code: 'WELCOME20', discountType: 'percent', discountValue: '20', courseId: null, maxUses: 100, usedCount: 46, validFrom: daysAgo(30), validTo: inDays(30), isActive: true },
  { id: 'promo-02', code: 'HIRAGANA10', discountType: 'fixed', discountValue: '10', courseId: COURSE_IDS.hiragana, maxUses: 50, usedCount: 14, validFrom: daysAgo(14), validTo: inDays(14), isActive: true },
  { id: 'promo-03', code: 'SPRINGPAUSE', discountType: 'percent', discountValue: '15', courseId: COURSE_IDS.beginner, maxUses: 25, usedCount: 25, validFrom: daysAgo(45), validTo: daysAgo(2), isActive: false },
];

export const seedPaymentMethods: PaymentMethod[] = [
  { id: 'method-01', type: 'qr', name: 'Hexa Learn QR', accountName: 'Hexa Learn Co.', accountNo: null, qrImageUrl: null, isActive: true },
  { id: 'method-02', type: 'bank_transfer', name: 'Mizuho Bank', accountName: 'Hexa Learn Co.', accountNo: '1234567', qrImageUrl: null, isActive: true },
];

export const seedRevenue = Array.from({ length: 12 }, (_, index) => {
  const date = new Date(now.getTime() - (11 - index) * 86400000);
  return { date: date.toISOString().slice(0, 10), revenue: String(520 + ((index * 317) % 920)) };
});

export function copy<T>(value: T): T {
  return structuredClone(value);
}
