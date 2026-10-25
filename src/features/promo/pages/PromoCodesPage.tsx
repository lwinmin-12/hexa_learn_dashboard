import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronDown, Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Modal } from '@/components/common/Modal';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusPill } from '@/components/common/StatusPill';
import { useToast } from '@/app/toast-context';
import { useAuth } from '@/app/auth-context';
import { formatDate, messageFromError } from '@/lib/utils';
import type { PromoCode } from '@/lib/domain';
import { usePromoCodes, useDeletePromo, useSavePromo } from '../hooks';
import { useCourses } from '@/features/courses/hooks';

const promoSchema = z.object({
  code: z.string().trim().min(1, 'Enter a code').max(80).regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, hyphens, and underscores'),
  discountType: z.enum(['percent', 'fixed']),
  discountValue: z.string().min(1, 'Enter a discount value'),
  courseId: z.string(),
  maxUses: z.string(),
  validFrom: z.string(),
  validTo: z.string(),
  isActive: z.boolean(),
}).superRefine((values, context) => {
  const amount = Number(values.discountValue);
  if (!Number.isFinite(amount) || amount <= 0 || (values.discountType === 'percent' && amount > 100)) context.addIssue({ code: 'custom', path: ['discountValue'], message: values.discountType === 'percent' ? 'Use a value from 1 to 100.' : 'Use a value greater than zero.' });
  if (values.maxUses && (!Number.isInteger(Number(values.maxUses)) || Number(values.maxUses) < 1)) context.addIssue({ code: 'custom', path: ['maxUses'], message: 'Maximum uses must be a positive whole number.' });
  if (values.validFrom && values.validTo && new Date(values.validFrom) > new Date(values.validTo)) context.addIssue({ code: 'custom', path: ['validTo'], message: 'End date must be after the start date.' });
});

type PromoValues = z.infer<typeof promoSchema>;
function localDate(value: string | null) { if (!value) return ''; const date = new Date(value); const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }

export function PromoCodesPage() {
  const query = usePromoCodes();
  const courses = useCourses({ page: 1, limit: 100 });
  const savePromo = useSavePromo();
  const deletePromo = useDeletePromo();
  const toast = useToast();
  const { isSuper } = useAuth();
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PromoCode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PromoCode | null>(null);
  const courseNames = new Map((courses.data?.data ?? []).map((course) => [course.id, course.title]));

  const columns: Column<PromoCode>[] = [
    { key: 'code', header: 'Code', render: (item) => <div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-[#E9F5F3] text-accent"><Tag className="size-4" /></span><span className="font-mono text-xs font-semibold tracking-wide">{item.code}</span></div> },
    { key: 'discount', header: 'Discount', render: (item) => <span className="text-xs font-medium">{item.discountType === 'percent' ? `${item.discountValue}%` : item.discountValue}</span> },
    { key: 'course', header: 'Applies to', render: (item) => <span className="text-xs text-muted">{item.courseId ? courseNames.get(item.courseId) ?? 'Assigned course' : 'All courses'}</span> },
    { key: 'usage', header: 'Uses', render: (item) => <span className="text-xs text-slate-600 dark:text-slate-300">{item.usedCount}{item.maxUses ? ` / ${item.maxUses}` : ' / ∞'}</span> },
    { key: 'validity', header: 'Valid until', render: (item) => <span className="text-xs text-muted">{item.validTo ? formatDate(item.validTo) : 'No end date'}</span> },
    { key: 'status', header: 'Status', render: (item) => <StatusPill status={item.isActive ? 'active' : 'draft'} label={item.isActive ? 'Active' : 'Inactive'} /> },
    { key: 'actions', header: '', className: 'w-24 text-right', render: (item) => <div className="flex justify-end gap-1"><button onClick={() => { setEditTarget(item); setOpen(true); }} className="rounded-lg p-2 text-muted hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={`Edit ${item.code}`}><Pencil className="size-3.5" /></button><button onClick={() => setDeleteTarget(item)} className="rounded-lg p-2 text-red-500 hover:bg-red-50" aria-label={`Delete ${item.code}`}><Trash2 className="size-3.5" /></button></div> },
  ];

  async function submit(values: PromoValues) {
    try {
      await savePromo.mutateAsync({ id: editTarget?.id ?? null, values: { code: values.code.toUpperCase(), discountType: values.discountType, discountValue: values.discountValue, courseId: values.courseId || null, maxUses: values.maxUses ? Number(values.maxUses) : null, validFrom: values.validFrom ? new Date(values.validFrom).toISOString() : null, validTo: values.validTo ? new Date(values.validTo).toISOString() : null, isActive: values.isActive } });
      setOpen(false); setEditTarget(null); toast(editTarget ? 'Promo code updated.' : 'Promo code created.');
    } catch (error) { toast(messageFromError(error), 'error'); }
  }

  async function remove() {
    if (!deleteTarget) return;
    try { await deletePromo.mutateAsync(deleteTarget.id); setDeleteTarget(null); toast('Promo code deleted.'); }
    catch (error) { toast(messageFromError(error), 'error'); }
  }

  return <>
    <PageHeader eyebrow="Promotions" title="Promo codes" description="Create discounts and track how learners use them." action={<Button variant="primary" onClick={() => { setEditTarget(null); setOpen(true); }}><Plus className="size-4" />New promo code</Button>} />
    {query.isError && <div role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{messageFromError(query.error)}</div>}
    <DataTable rows={query.data?.data ?? []} columns={columns} loading={query.isLoading} emptyTitle="No promo codes yet" emptyDescription="Create a code to offer a discount to learners." />
    <Modal open={open} onOpenChange={(value) => { setOpen(value); if (!value) setEditTarget(null); }} title={editTarget ? 'Edit promo code' : 'Create promo code'} description="Choose the discount, course, and validity period."><PromoForm key={editTarget?.id ?? 'new'} promo={editTarget} courses={courses.data?.data ?? []} isSuper={isSuper} saving={savePromo.isPending} onCancel={() => { setOpen(false); setEditTarget(null); }} onSave={(values) => void submit(values)} /></Modal>
    <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={(value) => !value && setDeleteTarget(null)} title="Delete this promo code?" description={`Learners will no longer be able to use ${deleteTarget?.code ?? 'this code'}.`} confirmLabel="Delete code" destructive busy={deletePromo.isPending} onConfirm={() => void remove()} />
  </>;
}

function PromoForm({ promo, courses, isSuper, saving, onCancel, onSave }: { promo: PromoCode | null; courses: { id: string; title: string }[]; isSuper: boolean; saving: boolean; onCancel: () => void; onSave: (values: PromoValues) => void }) {
  const form = useForm<PromoValues>({ resolver: zodResolver(promoSchema), defaultValues: { code: promo?.code ?? '', discountType: promo?.discountType ?? 'percent', discountValue: promo?.discountValue ?? '', courseId: promo?.courseId ?? '', maxUses: promo?.maxUses ? String(promo.maxUses) : '', validFrom: localDate(promo?.validFrom ?? null), validTo: localDate(promo?.validTo ?? null), isActive: promo?.isActive ?? true } });
  const discountType = form.watch('discountType');
  return <form onSubmit={form.handleSubmit((values) => { if (!isSuper && !values.courseId) { form.setError('courseId', { type: 'manual', message: 'Choose a course.' }); return; } onSave(values); })} className="space-y-4"><div><label className="field-label" htmlFor="promo-code">Code</label><input id="promo-code" className="field font-mono uppercase" maxLength={80} {...form.register('code', { onChange: (event) => form.setValue('code', event.target.value.toUpperCase()) })} placeholder="WELCOME20" />{form.formState.errors.code && <ErrorText>{form.formState.errors.code.message}</ErrorText>}</div>
    <div className="grid grid-cols-2 gap-3"><div><label className="field-label" htmlFor="promo-type">Discount type</label><select id="promo-type" className="field" {...form.register('discountType')}><option value="percent">Percent</option><option value="fixed">Fixed amount</option></select></div><div><label className="field-label" htmlFor="promo-value">Value {discountType === 'percent' ? '(1–100%)' : ''}</label><input id="promo-value" type="number" min="0.01" step="0.01" max={discountType === 'percent' ? 100 : undefined} className="field" {...form.register('discountValue')} />{form.formState.errors.discountValue && <ErrorText>{form.formState.errors.discountValue.message}</ErrorText>}</div></div>
    <div><label className="field-label" htmlFor="promo-course">Applies to</label><div className="relative"><select id="promo-course" className="field appearance-none pr-8" {...form.register('courseId', { onChange: () => form.clearErrors('courseId') })}><option value="">{isSuper ? 'All courses' : 'Choose a course'}</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" /></div>{form.formState.errors.courseId && <ErrorText>{form.formState.errors.courseId.message}</ErrorText>}{!isSuper && <p className="mt-1 text-[10px] text-muted">Page admins must select a course.</p>}</div>
    <div className="grid grid-cols-3 gap-3"><div><label className="field-label" htmlFor="promo-max-uses">Max uses</label><input id="promo-max-uses" type="number" min="1" className="field" placeholder="Unlimited" {...form.register('maxUses')} />{form.formState.errors.maxUses && <ErrorText>{form.formState.errors.maxUses.message}</ErrorText>}</div><div className="col-span-2"><label className="field-label" htmlFor="promo-valid-from">Valid from</label><input id="promo-valid-from" type="datetime-local" className="field" {...form.register('validFrom')} /></div></div>
    <div><label className="field-label" htmlFor="promo-valid-to">Valid until <span className="font-normal text-slate-400">(optional)</span></label><input id="promo-valid-to" type="datetime-local" className="field" {...form.register('validTo')} />{form.formState.errors.validTo && <ErrorText>{form.formState.errors.validTo.message}</ErrorText>}</div>
    <label className="flex items-center justify-between rounded-xl border border-line p-3.5 dark:border-slate-700"><span><span className="block text-xs font-medium">Active</span><span className="mt-1 block text-[10px] text-muted">Learners can redeem this code.</span></span><input type="checkbox" aria-label="Promo code active" className="size-4 accent-accent" {...form.register('isActive')} /></label>
    <div className="flex justify-end gap-2 border-t border-line pt-4 dark:border-slate-800"><Button type="button" onClick={onCancel}>Cancel</Button><Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : promo ? 'Save changes' : 'Create code'}</Button></div>
  </form>;
}

function ErrorText({ children }: { children?: string }) { return children ? <p role="alert" className="mt-1.5 text-xs text-red-600">{children}</p> : null; }
