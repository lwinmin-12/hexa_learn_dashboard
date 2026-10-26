import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, ImagePlus, Pencil, Plus, QrCode, Trash2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { Modal } from '@/components/common/Modal';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusPill } from '@/components/common/StatusPill';
import { useToast } from '@/app/toast-context';
import { useDeletePaymentMethod, usePaymentMethods, useSavePaymentMethod } from '../hooks';
import type { PaymentMethod } from '@/lib/domain';
import { messageFromError } from '@/lib/utils';

const methodSchema = z.object({
  type: z.enum(['qr', 'bank_transfer']),
  name: z.string().trim().min(1, 'Enter a method name').max(200),
  accountName: z.string().max(200),
  accountNo: z.string().max(100),
  isActive: z.boolean(),
}).superRefine((values, context) => {
  if (values.type === 'bank_transfer' && !values.accountNo.trim()) context.addIssue({ code: 'custom', path: ['accountNo'], message: 'Enter the bank account number.' });
});
type MethodValues = z.infer<typeof methodSchema>;

export function PaymentMethodsPage() {
  const query = usePaymentMethods();
  const save = useSavePaymentMethod();
  const remove = useDeletePaymentMethod();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PaymentMethod | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaymentMethod | null>(null);

  async function submit(values: MethodValues, qrImage: File | null) {
    try {
      await save.mutateAsync({ id: editTarget?.id ?? null, values: { type: values.type, name: values.name, accountName: values.accountName || null, accountNo: values.accountNo || null, qrImageUrl: values.type === 'bank_transfer' ? null : editTarget?.qrImageUrl ?? null, isActive: values.isActive }, qrImage });
      setOpen(false); setEditTarget(null); toast(editTarget ? 'Payment method updated.' : 'Payment method added.');
    } catch (error) { toast(messageFromError(error), 'error'); }
  }

  async function toggleActive(method: PaymentMethod) {
    try { await save.mutateAsync({ id: method.id, values: { ...method, isActive: !method.isActive } }); toast(method.isActive ? 'Payment method deactivated.' : 'Payment method activated.'); }
    catch (error) { toast(messageFromError(error), 'error'); }
  }

  async function deleteMethod() {
    if (!deleteTarget) return;
    try { await remove.mutateAsync(deleteTarget.id); setDeleteTarget(null); toast('Payment method deleted.'); }
    catch (error) { toast(messageFromError(error), 'error'); }
  }

  return <>
    <PageHeader eyebrow="Settings" title="Payment methods" description="Manage the ways learners can pay for premium courses." action={<Button variant="primary" onClick={() => { setEditTarget(null); setOpen(true); }}><Plus className="size-4" />Add method</Button>} />
    {query.isError && <div role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{messageFromError(query.error)}</div>}
    {query.isLoading ? <div className="grid gap-4 md:grid-cols-2">{[1, 2].map((item) => <div key={item} className="h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900" />)}</div> : query.data?.data.length ? <div className="grid gap-4 md:grid-cols-2">{query.data.data.map((method) => <article key={method.id} className="surface-card p-5"><div className="flex items-start justify-between"><span className="grid size-10 place-items-center rounded-xl bg-[#E9F5F3] text-accent">{method.type === 'qr' ? <QrCode className="size-5" /> : <Building2 className="size-5" />}</span><div className="flex items-center gap-1"><button onClick={() => { setEditTarget(method); setOpen(true); }} className="rounded-lg p-2 text-muted hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={`Edit ${method.name}`}><Pencil className="size-3.5" /></button><button onClick={() => setDeleteTarget(method)} className="rounded-lg p-2 text-red-500 hover:bg-red-50" aria-label={`Delete ${method.name}`}><Trash2 className="size-3.5" /></button></div></div><div className="mt-4 flex items-center justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-sm font-semibold">{method.name}</h2><p className="mt-1 text-xs text-muted">{method.type === 'qr' ? 'QR payment' : 'Bank transfer'}</p></div><StatusPill status={method.isActive ? 'active' : 'draft'} label={method.isActive ? 'Active' : 'Inactive'} /></div><div className="mt-4 flex items-center justify-between border-t border-line pt-3 dark:border-slate-800"><div><p className="text-[10px] text-muted">Account holder</p><p className="mt-1 text-xs font-medium">{method.accountName ?? '—'}</p></div><div className="text-right"><p className="text-[10px] text-muted">Account number</p><p className="mt-1 text-xs font-medium">{method.accountNo ?? '—'}</p></div><Button size="sm" onClick={() => void toggleActive(method)}>{method.isActive ? 'Deactivate' : 'Activate'}</Button></div></article>)}</div> : <div className="surface-card"><EmptyState title="No payment methods" description="Add a payment method to accept payments for premium courses." action={<Button variant="primary" onClick={() => setOpen(true)}><Plus className="size-4" />Add method</Button>} /></div>}
    <Modal open={open} onOpenChange={(value) => { setOpen(value); if (!value) setEditTarget(null); }} title={editTarget ? 'Edit payment method' : 'Add payment method'} description="Set the payment details shown to learners."><MethodForm key={editTarget?.id ?? 'new'} method={editTarget} saving={save.isPending} onCancel={() => { setOpen(false); setEditTarget(null); }} onSave={(values, image) => void submit(values, image)} /></Modal>
    <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={(value) => !value && setDeleteTarget(null)} title="Delete this payment method?" description={`${deleteTarget?.name ?? 'This method'} will no longer be available to learners.`} confirmLabel="Delete method" destructive busy={remove.isPending} onConfirm={() => void deleteMethod()} />
  </>;
}

function MethodForm({ method, saving, onCancel, onSave }: { method: PaymentMethod | null; saving: boolean; onCancel: () => void; onSave: (values: MethodValues, image: File | null) => void }) {
  const form = useForm<MethodValues>({ resolver: zodResolver(methodSchema), defaultValues: { type: method?.type ?? 'qr', name: method?.name ?? '', accountName: method?.accountName ?? '', accountNo: method?.accountNo ?? '', isActive: method?.isActive ?? true } });
  const type = form.watch('type');
  const [image, setImage] = useState<File | null>(null);
  const [imageError, setImageError] = useState('');
  const [preview, setPreview] = useState<string | null>(method?.qrImageUrl ?? null);
  useEffect(() => {
    if (!image) { setPreview(method?.qrImageUrl ?? null); return; }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image, method?.qrImageUrl]);
  return <form onSubmit={form.handleSubmit((values) => {
    if (values.type === 'qr' && !image && !method?.qrImageUrl) { setImageError('Upload a QR image to continue.'); return; }
    setImageError(''); onSave(values, image);
  })} className="space-y-4"><div><label className="field-label" htmlFor="method-type">Type</label><select id="method-type" className="field" {...form.register('type')}><option value="qr">QR payment</option><option value="bank_transfer">Bank transfer</option></select></div><div><label className="field-label" htmlFor="method-name">Name</label><input id="method-name" className="field" {...form.register('name')} placeholder="e.g. Hexa Learn QR" />{form.formState.errors.name && <ErrorText>{form.formState.errors.name.message}</ErrorText>}</div><div><label className="field-label" htmlFor="method-account-name">Account name</label><input id="method-account-name" className="field" {...form.register('accountName')} /></div>{type === 'bank_transfer' && <div><label className="field-label" htmlFor="method-account-no">Account number</label><input id="method-account-no" className="field" {...form.register('accountNo')} />{form.formState.errors.accountNo && <ErrorText>{form.formState.errors.accountNo.message}</ErrorText>}</div>}
    {type === 'qr' && <div><span className="field-label">QR image</span><div className="flex items-center gap-4 rounded-xl border border-line p-3 dark:border-slate-700">{preview ? <img src={preview} alt="Payment QR preview" className="size-20 rounded-lg border border-line object-contain" /> : <span className="grid size-20 place-items-center rounded-lg bg-slate-50 text-muted dark:bg-slate-900"><QrCode className="size-7" /></span>}<div className="min-w-0 flex-1"><p className="text-xs text-muted">JPG, PNG, or WebP. Up to 5 MB.</p><label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><ImagePlus className="size-4" />{image ? 'Change image' : method?.qrImageUrl ? 'Replace image' : 'Upload image'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (!file) return; if (file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setImageError('Choose a JPG, PNG, or WebP image under 5 MB.'); return; } setImageError(''); setImage(file); }} /></label></div></div>{imageError && <ErrorText>{imageError}</ErrorText>}</div>}
    <label className="flex items-center justify-between rounded-xl border border-line p-3.5 dark:border-slate-700"><span className="text-xs font-medium">Available to learners</span><input type="checkbox" aria-label="Payment method active" className="size-4 accent-accent" {...form.register('isActive')} /></label><div className="flex justify-end gap-2 border-t border-line pt-4 dark:border-slate-800"><Button type="button" onClick={onCancel}>Cancel</Button><Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : method ? 'Save changes' : 'Add method'}</Button></div></form>;
}

function ErrorText({ children }: { children?: string }) { return children ? <p role="alert" className="mt-1.5 text-xs text-red-600">{children}</p> : null; }
