import type { ReactNode } from 'react';

export function PageHeader({ title, description, action, eyebrow }: { title: ReactNode; description?: string; action?: ReactNode; eyebrow?: string }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
    <div>{eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</p>}<h1 className="text-[28px] font-semibold leading-tight tracking-[-0.035em] text-ink dark:text-white">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>}</div>
    {action}
  </div>;
}
