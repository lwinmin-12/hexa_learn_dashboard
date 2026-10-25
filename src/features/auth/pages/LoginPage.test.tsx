import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '@/app/auth';
import { API_URL } from '@/lib/constants';
import { readAdminSession } from '@/lib/admin-session';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { LoginPage } from './LoginPage';

function renderLogin() {
  return renderWithProviders(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/login']}><AuthProvider><Routes><Route path="/login" element={<LoginPage />} /><Route path="/" element={<p>Admin workspace</p>} /></Routes></AuthProvider></MemoryRouter>);
}

const admin = { id: 'admin', email: 'admin@example.com', displayName: null, avatarUrl: null, role: 'super_admin', status: 'active' };

describe('admin email and password login', () => {
  it('signs in through the API, handles nullable profile fields, and offers no Google sign-in', async () => {
    const user = userEvent.setup();
    server.use(http.post(`${API_URL}/admin/auth/login`, async ({ request }) => {
      expect(await request.json()).toEqual({ email: 'admin@example.com', password: 'secure-password' });
      return HttpResponse.json({ idToken: 'access', refreshToken: 'refresh', expiresIn: 3600, user: admin });
    }));
    renderLogin();
    expect(screen.queryByText(/continue with google/i)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Email address'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'secure-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Admin workspace')).toBeInTheDocument();
    expect(readAdminSession()?.idToken).toBe('access');
  });

  it('shows a failed login response without saving a session', async () => {
    const user = userEvent.setup();
    server.use(http.post(`${API_URL}/admin/auth/login`, () => HttpResponse.json({ message: 'Invalid admin credentials' }, { status: 401 })));
    renderLogin();
    await user.type(screen.getByLabelText('Email address'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid admin credentials');
    expect(readAdminSession()).toBeNull();
  });
});
