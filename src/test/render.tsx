import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '@/app/toast';

export function renderWithProviders(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return {
    client,
    ...render(<QueryClientProvider client={client}><ToastProvider>{ui}</ToastProvider></QueryClientProvider>),
  };
}
