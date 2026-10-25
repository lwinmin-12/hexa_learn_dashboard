import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, ChevronDown, Clock3, ExternalLink, FileImage, X } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Modal } from '@/components/common/Modal';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusPill } from '@/components/common/StatusPill';
import { useToast } from '@/app/toast-context';
import { usePayments, usePayment, useReviewPayment } from '../hooks';
import { useCourses } from '@/features/courses/hooks';
import type { PaymentListItem, PaymentStatus } from '@/lib/domain';
import { formatCurrency, formatDate, messageFromError } from '@/lib/utils';

const tabs: { key: string; label: string; status?: PaymentStatus }[] = [
  { key: 'slip_uploaded', label: 'Needs review', status: 'slip_uploaded' },
  { key: 'all', label: 'All payments' },
  { key: 'approved', label: 'Approved', status: 'approved' },
  { key: 'rejected', label: 'Rejected', status: 'rejected' },
];

export function PaymentsPage() {
  const [activeTab, setActiveTab] = useState('slip_uploaded');
  const [courseId, setCourseId] = useState('');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const filters = { page, limit: 10, ...(tabs.find((tab) => tab.key === activeTab)?.status ? { status: tabs.find((tab) => tab.key === activeTab)?.status } : {}), ...(courseId ? { courseId } : {}) };
  const payments = usePayments(filters);
  const courses = useCourses({ page: 1, limit: 100 });
  const selected = usePayment(paymentId);

  const columns: Column<PaymentListItem>[] = [
    { key: 'learner', header: 'Learner', render: (payment) => <div><p className="text-xs font-medium text-ink dark:text-white">{payment.user.displayName}</p><p className="mt-1 font-mono text-[10px] text-slate-400">{payment.id.slice(0, 12)}</p></div> },
    { key: 'course', header: 'Course', className: 'min-w-48', render: (payment) => <span className="block truncate text-xs text-slate-600 dark:text-slate-300">{payment.course.title}</span> },
    { key: 'amount', header: 'Amount', render: (payment) => <div><p className="text-xs font-semibold text-ink dark:text-white">{formatCurrency(payment.finalAmount, payment.course.currency)}</p>{Number(payment.discountAmount) > 0 && <p className="mt-1 text-[10px] text-slate-400">Saved {formatCurrency(payment.discountAmount, payment.course.currency)}</p>}</div> },
    { key: 'status', header: 'Status', render: (payment) => <StatusPill status={payment.status} /> },
    { key: 'date', header: 'Submitted', render: (payment) => <span className="whitespace-nowrap text-xs text-muted">{formatDate(payment.createdAt, 'MMM d, h:mm a')}</span> },
    { key: 'review', header: '', className: 'text-right', render: (payment) => <Button size="sm" onClick={() => setPaymentId(payment.id)}>Review</Button> },
  ];

  return <>
    <PageHeader eyebrow="Revenue operations" title="Payments" description="Review payment slips and keep learner access moving." />
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1 dark:bg-slate-900">{tabs.map((tab) => <button key={tab.key} onClick={() => { setActiveTab(tab.key); setPage(1); }} className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium transition ${activeTab === tab.key ? 'bg-white text-ink shadow-sm dark:bg-slate-800 dark:text-white' : 'text-muted hover:text-ink dark:hover:text-white'}`}>{tab.label}</button>)}</div><div className="relative"><label className="sr-only" htmlFor="payment-course-filter">Filter by course</label><select id="payment-course-filter" value={courseId} onChange={(event) => { setCourseId(event.target.value); setPage(1); }} className="field w-auto min-w-44 appearance-none pr-8 text-xs"><option value="">All courses</option>{(courses.data?.data ?? []).map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" /></div></div>
    {payments.isError && <div role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{messageFromError(payments.error)}</div>}
    <DataTable rows={payments.data?.data ?? []} columns={columns} loading={payments.isLoading} emptyTitle="No payments found" emptyDescription={activeTab === 'slip_uploaded' ? 'There are no payment slips waiting for review.' : 'Try another status or course filter.'} page={page} pages={Math.max(1, Math.ceil((payments.data?.meta.total ?? 0) / 10))} onPageChange={setPage} />
    <PaymentDrawer paymentId={paymentId} payment={selected.data} loading={selected.isLoading} onClose={() => setPaymentId(null)} />
  </>;
}

function PaymentDrawer({ paymentId, payment, loading, onClose }: { paymentId: string | null; payment: ReturnType<typeof usePayment>['data']; loading: boolean; onClose: () => void }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [reason, setReason] = useState('');
  const review = useReviewPayment();
  const toast = useToast();

  async function approve() {
    if (!paymentId) return;
    try { await review.mutateAsync({ id: paymentId, action: 'approve' }); setConfirmOpen(false); onClose(); toast('Payment approved.'); }
    catch (error) { toast(messageFromError(error), 'error'); }
  }

  async function reject() {
    if (!paymentId || !reason.trim()) return;
    try { await review.mutateAsync({ id: paymentId, action: 'reject', rejectReason: reason.trim() }); setRejectOpen(false); setReason(''); onClose(); toast('Payment rejected.'); }
    catch (error) { toast(messageFromError(error), 'error'); }
  }

  return <>
    <Dialog.Root open={Boolean(paymentId)} onOpenChange={(open) => !open && onClose()}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/30" /><Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-[min(560px,100vw)] flex-col overflow-hidden border-l border-line bg-white shadow-2xl focus:outline-none dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start justify-between border-b border-line px-6 py-5 dark:border-slate-800"><div><Dialog.Title className="text-lg font-semibold">Payment review</Dialog.Title><Dialog.Description className="mt-1 text-xs text-muted">Check the slip and payment details before updating access.</Dialog.Description></div><Dialog.Close asChild><button className="rounded-lg p-2 text-muted hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close payment details"><X className="size-4" /></button></Dialog.Close></div>
      {loading || !payment ? <div className="flex-1 animate-pulse p-6"><div className="h-60 rounded-xl bg-slate-100 dark:bg-slate-900" /></div> : <div className="flex-1 overflow-y-auto p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs text-muted">Learner</p><p className="mt-1 text-sm font-semibold">{payment.user.displayName}</p></div><StatusPill status={payment.status} /></div><div className="mt-5 rounded-xl bg-[#F7F8F8] p-4 dark:bg-slate-900"><p className="text-xs text-muted">Course</p><p className="mt-1 text-sm font-medium">{payment.course.title}</p><div className="mt-4 grid grid-cols-2 gap-4"><div><p className="text-[11px] text-muted">Payment method</p><p className="mt-1 text-xs font-medium">{payment.paymentMethod?.name ?? '—'}</p></div><div><p className="text-[11px] text-muted">Promo code</p><p className="mt-1 text-xs font-medium">{payment.promoCode?.code ?? '—'}</p></div></div></div>
        <div className="mt-5 grid grid-cols-3 gap-3"><Amount label="Amount" value={payment.amount} currency={payment.course.currency} /><Amount label="Discount" value={payment.discountAmount} currency={payment.course.currency} /><Amount label="Final amount" value={payment.finalAmount} currency={payment.course.currency} strong /></div>
        <div className="mt-6"><div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-semibold">Payment slip</h3>{payment.slipUrl && <a href={payment.slipUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-accent">Open image <ExternalLink className="size-3" /></a>}</div>{payment.slipUrl ? <button className="block w-full overflow-hidden rounded-xl border border-line bg-slate-50 dark:border-slate-700 dark:bg-slate-900" onClick={() => setZoomOpen(true)} aria-label="Zoom payment slip"><img src={payment.slipUrl} alt="Uploaded payment slip" className="max-h-[340px] w-full object-contain" /></button> : <div className="grid h-48 place-items-center rounded-xl border border-dashed border-line bg-slate-50 dark:border-slate-700 dark:bg-slate-900"><div className="text-center"><FileImage className="mx-auto size-7 text-slate-300" /><p className="mt-2 text-xs text-muted">No slip image is available in this record.</p></div></div>}</div>
        <div className="mt-6 border-t border-line pt-4 dark:border-slate-800"><h3 className="mb-3 text-xs font-semibold">Timeline</h3><div className="flex gap-3"><span className="mt-0.5 grid size-7 place-items-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800"><Clock3 className="size-3.5" /></span><div><p className="text-xs font-medium">Payment submitted</p><p className="mt-1 text-[11px] text-muted">{formatDate(payment.createdAt, 'MMMM d, yyyy · h:mm a')}</p></div></div>{payment.reviewedAt && <div className="mt-3 flex gap-3"><span className="mt-0.5 grid size-7 place-items-center rounded-full bg-[#E8F4F1] text-accent"><Check className="size-3.5" /></span><div><p className="text-xs font-medium">Reviewed</p><p className="mt-1 text-[11px] text-muted">{formatDate(payment.reviewedAt, 'MMMM d, yyyy · h:mm a')}</p></div></div>}</div>
        {payment.rejectReason && <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700"><span className="font-semibold">Rejection reason</span><p className="mt-1">{payment.rejectReason}</p></div>}
      </div>}
      {payment && payment.status === 'slip_uploaded' && <div className="flex justify-end gap-2 border-t border-line px-6 py-4 dark:border-slate-800"><Button variant="danger" onClick={() => setRejectOpen(true)}>Reject</Button><Button variant="primary" onClick={() => setConfirmOpen(true)}><Check className="size-4" />Approve payment</Button></div>}
    </Dialog.Content></Dialog.Portal></Dialog.Root>
    <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} title="Approve this payment?" description="The learner will get access to this course immediately." confirmLabel="Approve payment" busy={review.isPending} onConfirm={() => void approve()} />
    <Modal open={rejectOpen} onOpenChange={setRejectOpen} title="Reject payment" description="Share a reason so the learner knows what to fix."><form onSubmit={(event) => { event.preventDefault(); void reject(); }} className="space-y-4"><div><label className="field-label" htmlFor="reject-reason">Reason</label><textarea id="reject-reason" className="field h-28 py-2.5" maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} required placeholder="For example, the transfer amount does not match." /><p className="mt-1 text-right text-[10px] text-muted">{reason.length}/2000</p></div><div className="flex justify-end gap-2"><Button type="button" onClick={() => setRejectOpen(false)}>Cancel</Button><Button type="submit" variant="danger" disabled={!reason.trim() || review.isPending}>Reject payment</Button></div></form></Modal>
    <Modal open={zoomOpen} onOpenChange={setZoomOpen} title="Payment slip" className="max-w-2xl">{payment?.slipUrl && <img src={payment.slipUrl} alt="Payment slip, enlarged" className="max-h-[75vh] w-full object-contain" />}</Modal>
  </>;
}

function Amount({ label, value, currency, strong = false }: { label: string; value: string; currency: string; strong?: boolean }) {
  return <div><p className="text-[10px] text-muted">{label}</p><p className={`mt-1 ${strong ? 'text-sm font-semibold' : 'text-xs font-medium'}`}>{formatCurrency(value, currency)}</p></div>;
}
