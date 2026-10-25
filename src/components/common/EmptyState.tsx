import type { ReactNode } from 'react';

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center"><div className="mb-3 grid size-10 place-items-center rounded-xl bg-slate-100 text-muted dark:bg-slate-800">◌</div><h3 className="text-sm font-semibold text-ink dark:text-white">{title}</h3>{description && <p className="mt-1 max-w-sm text-xs leading-5 text-muted">{description}</p>}{action && <div className="mt-4">{action}</div>}</div>;
}
