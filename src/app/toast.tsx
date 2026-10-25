import { useCallback, useState, type ReactNode } from 'react';
import { Check, CircleAlert, X } from 'lucide-react';
import { ToastContext, type ToastItem } from './toast-context';

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const toast = useCallback((message: string, kind: ToastItem['kind'] = 'success') => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current, { id, message, kind }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 3600);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed right-5 top-5 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className="pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-white p-4 text-sm shadow-card dark:border-slate-700 dark:bg-slate-900">
            {item.kind === 'success' ? <Check className="mt-0.5 size-4 text-accent" /> : <CircleAlert className="mt-0.5 size-4 text-red-600" />}
            <p className="flex-1 text-ink dark:text-white">{item.message}</p>
            <button className="text-muted hover:text-ink" onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))} aria-label="Dismiss notification"><X className="size-4" /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
