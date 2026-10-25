import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './server';
import { resetMockState } from '@/mocks/handlers';
import { setTokenGetter } from '@/lib/api';
import { clearAdminSession } from '@/lib/admin-session';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetMockState();
  setTokenGetter(async () => null);
  localStorage.clear();
  clearAdminSession();
  sessionStorage.clear();
  document.documentElement.classList.remove('dark');
  vi.unstubAllGlobals();
});
afterAll(() => server.close());
