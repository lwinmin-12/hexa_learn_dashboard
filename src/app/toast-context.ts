import { createContext, useContext } from 'react';

export type ToastItem = { id: number; message: string; kind: 'success' | 'error' };
export type ToastContextValue = { toast: (message: string, kind?: ToastItem['kind']) => void };
export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used within ToastProvider');
  return value.toast;
}
