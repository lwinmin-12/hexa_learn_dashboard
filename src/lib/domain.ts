export type AdminRole = 'super_admin' | 'page_admin';
export type UserRole = AdminRole | 'learner';
export type CourseStatus = 'draft' | 'scheduled' | 'published';
export type PaymentStatus = 'pending' | 'slip_uploaded' | 'approved' | 'rejected';
export type EpisodeVideoState = 'not_uploaded' | 'uploading' | 'ready' | 'failed';

export type AdminUser = {
  id: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  status: 'active' | 'suspended';
};

export type Episode = {
  id: string;
  chapterId: string;
  title: string;
  description: string | null;
  position: number;
  status: CourseStatus;
  publishAt: string | null;
  playbackUrl: string | null;
  captionsUrl?: string | null;
  videoDurationSec: number | null;
  videoUploadStatus: 'pending' | 'uploading' | 'ready' | 'failed' | null;
  videoScheduledAt: string | null;
};

export type Chapter = {
  id: string;
  courseId: string;
  title: string;
  position: number;
  status: CourseStatus;
  bookCount?: number;
  episodes: Episode[];
};

export type Course = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  isPremium: boolean;
  price: string | null;
  currency: string | null;
  status: CourseStatus;
  publishAt: string | null;
  updatedAt?: string;
  createdAt?: string;
  chapters?: Chapter[];
  bookCount?: number;
};

export type Book = {
  id: string;
  title: string;
  description: string | null;
  fileName: string;
  mimeType: 'application/pdf';
  sizeBytes: number;
  pageCount: number | null;
  canView: boolean;
  canDownload: boolean;
  status: 'draft' | 'published';
  position: number;
  scope: 'course' | 'chapter';
  attachedTo: { type: 'course' | 'chapter'; id: string; title: string };
  createdAt: string;
};

export type Payment = {
  id: string;
  user: { id: string; displayName: string };
  course: { title: string; currency: string };
  paymentMethod: { name: string; type: 'qr' | 'bank_transfer' };
  promoCode: { code: string } | null;
  amount: string;
  discountAmount: string;
  finalAmount: string;
  hasSlip: boolean;
  slipUrl?: string | null;
  status: PaymentStatus;
  rejectReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type PaymentListItem = Omit<Payment, 'paymentMethod' | 'promoCode' | 'slipUrl'>;

export type PromoCode = {
  id: string;
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: string;
  courseId: string | null;
  maxUses: number | null;
  usedCount: number;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
};

export type PaymentMethod = {
  id: string;
  type: 'qr' | 'bank_transfer';
  name: string;
  accountName: string | null;
  accountNo: string | null;
  qrImageUrl: string | null;
  isActive: boolean;
};

export type Page<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number };
};

export type ApiError = {
  statusCode: number;
  code: string;
  message: string | string[];
};
