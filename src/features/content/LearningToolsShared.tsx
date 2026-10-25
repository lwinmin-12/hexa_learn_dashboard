import { useId, useRef, useState, type ReactNode } from 'react';
import { UploadCloud } from 'lucide-react';
import { Button } from '@/components/common/Button';

export const primaryActionClass = 'bg-teal-700 hover:bg-teal-800';

export function FileDropzone({ label, accept, onFile, disabled = false, autoFocus = false }: { label: string; accept: string; onFile: (file: File) => void; disabled?: boolean; autoFocus?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const [dragging, setDragging] = useState(false);
  return <div>
    <input id={id} ref={input} type="file" accept={accept} aria-label={label} className="sr-only" tabIndex={-1} disabled={disabled} onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); event.target.value = ''; }} />
    <button type="button" autoFocus={autoFocus} disabled={disabled} onClick={() => input.current?.click()} onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file && !disabled) onFile(file); }} className={`flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-5 text-center text-sm text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-teal-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 ${dragging ? 'border-slate-600 bg-slate-100 dark:bg-slate-800' : 'border-slate-300 bg-slate-50 hover:bg-[#F7F8F8] dark:border-slate-600 dark:bg-slate-900'}`}><UploadCloud className="size-5" aria-hidden="true" /><span>{label}</span><span className="text-xs">Drop a file here or click to choose</span></button>
  </div>;
}

export function LearningToolsEmpty({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <div className="flex min-h-60 flex-col items-center justify-center gap-3 p-8 text-center"><h3 className="text-base font-semibold">{title}</h3><p className="max-w-sm text-sm text-slate-600 dark:text-slate-300">{description}</p>{children}</div>;
}

export function LearningToolsError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 p-4 text-sm text-red-700 dark:border-red-900 dark:text-red-300"><p>{message}</p><Button onClick={onRetry}>Retry</Button></div>;
}

export function LearningToolsLoading() {
  return <div role="status" aria-label="Loading learning materials" className="space-y-3 p-4">{[1, 2, 3].map((row) => <div key={row} className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />)}</div>;
}
