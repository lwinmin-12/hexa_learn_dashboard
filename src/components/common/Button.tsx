import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' };

export function Button({ variant = 'secondary', size = 'md', className, ...props }: ButtonProps) {
  return <button className={cn('inline-flex items-center justify-center gap-2 rounded-lg font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50', size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm', variant === 'primary' && 'bg-accent text-white hover:bg-teal-700', variant === 'secondary' && 'border border-line bg-white text-ink hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800', variant === 'ghost' && 'text-muted hover:bg-slate-100 hover:text-ink dark:hover:bg-slate-800 dark:hover:text-white', variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700', className)} {...props} />;
}
