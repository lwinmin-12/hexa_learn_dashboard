import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({ open, onOpenChange, title, description, children, className = 'max-w-xl' }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: ReactNode; className?: string }) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-[2px]" /><Dialog.Content className={`fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-white p-6 shadow-xl focus:outline-none dark:border-slate-700 dark:bg-slate-900 ${className}`}>
    <div className="flex items-start justify-between gap-4"><div><Dialog.Title className="text-lg font-semibold text-ink dark:text-white">{title}</Dialog.Title>{description && <Dialog.Description className="mt-1 text-sm text-muted">{description}</Dialog.Description>}</div><Dialog.Close aria-label="Close dialog" className="rounded-lg p-1 text-muted hover:bg-slate-100 dark:hover:bg-slate-800"><X className="size-4" /></Dialog.Close></div>
    <div className="mt-5">{children}</div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
