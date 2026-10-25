import * as Dialog from '@radix-ui/react-dialog';
import { Button } from './Button';

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = 'Confirm', destructive = false, busy = false, onConfirm }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
}) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-[2px]" />
    <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-white p-6 shadow-xl focus:outline-none dark:border-slate-700 dark:bg-slate-900">
      <Dialog.Title className="text-lg font-semibold text-ink dark:text-white">{title}</Dialog.Title><Dialog.Description className="mt-2 text-sm leading-6 text-muted">{description}</Dialog.Description>
      <div className="mt-6 flex justify-end gap-2"><Dialog.Close asChild><Button disabled={busy}>Cancel</Button></Dialog.Close><Button variant={destructive ? 'danger' : 'primary'} disabled={busy} onClick={onConfirm}>{busy ? 'Saving…' : confirmLabel}</Button></div>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
