import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppLayout } from './layout';
import { AuthContext, type AuthContextValue } from './auth-context';
import { RequireRole } from './guards';

const pageAdmin: AuthContextValue = {
  user: { id: 'page-admin', email: 'page@example.test', displayName: 'Page Admin', avatarUrl: null, role: 'page_admin', status: 'active' },
  role: 'page_admin', isSuper: false, isPageAdmin: true, loading: false, authError: null,
  signInWithPassword: vi.fn(async () => undefined), signInDemo: vi.fn(async () => undefined), logout: vi.fn(async () => undefined),
};

describe('admin role access', () => {
  it('hides super-admin navigation and blocks direct access for page admins', () => {
    render(<AuthContext.Provider value={pageAdmin}><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/users']}><Routes>
      <Route element={<AppLayout />}><Route element={<RequireRole allow={['super_admin']} />}><Route path="/users" element={<p>Users content</p>} /></Route></Route>
      <Route path="/403" element={<p>Forbidden</p>} />
    </Routes></MemoryRouter></AuthContext.Provider>);

    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Payment methods' })).not.toBeInTheDocument();
    expect(screen.getByText('Forbidden')).toBeInTheDocument();
  });
});
