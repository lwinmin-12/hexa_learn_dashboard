import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/server';
import { API_URL } from './constants';
import { api, setTokenGetter } from './api';
import { clearAdminSession, getAdminToken, readAdminSession, startAdminSession } from './admin-session';

const session = {
  idToken: 'old-access', refreshToken: 'old-refresh', expiresIn: 3600,
  user: { id: 'admin', email: 'admin@example.com', displayName: 'Admin', avatarUrl: null, role: 'super_admin', status: 'active' },
} satisfies Parameters<typeof startAdminSession>[0];

describe('API admin sessions', () => {
  it('shares concurrent refreshes and stores the rotated token', async () => {
    startAdminSession({ ...session, expiresIn: 1 });
    let calls = 0;
    server.use(http.post(`${API_URL}/admin/auth/refresh`, async ({ request }) => {
      calls++;
      expect(await request.json()).toEqual({ refreshToken: 'old-refresh' });
      expect(request.headers.get('Authorization')).toBeNull();
      return HttpResponse.json({ ...session, idToken: 'new-access', refreshToken: 'new-refresh' });
    }));
    setTokenGetter(getAdminToken);
    expect(await Promise.all([getAdminToken(), getAdminToken()])).toEqual(['new-access', 'new-access']);
    expect(calls).toBe(1);
    expect(readAdminSession()?.refreshToken).toBe('new-refresh');
  });

  it('refreshes once on 401 and retries the protected request with the new token', async () => {
    startAdminSession(session);
    setTokenGetter(getAdminToken);
    const headers: (string | null)[] = [];
    server.use(
      http.get(`${API_URL}/me`, ({ request }) => {
        headers.push(request.headers.get('Authorization'));
        return headers.length === 1 ? new HttpResponse(null, { status: 401 }) : HttpResponse.json(session.user);
      }),
      http.post(`${API_URL}/admin/auth/refresh`, () => HttpResponse.json({ ...session, idToken: 'new-access' })),
    );
    await api.get('/me');
    expect(headers).toEqual(['Bearer old-access', 'Bearer new-access']);
  });

  it('clears an expired session without recursively retrying a failed refresh', async () => {
    startAdminSession(session);
    setTokenGetter(getAdminToken);
    let refreshes = 0;
    server.use(http.post(`${API_URL}/admin/auth/refresh`, () => {
      refreshes++;
      return HttpResponse.json({ message: 'Session expired' }, { status: 401 });
    }));
    await expect(getAdminToken(true)).rejects.toThrow();
    expect(refreshes).toBe(1);
    expect(readAdminSession()).toBeNull();
  });

  it('does not restore a session if logout happens during refresh', async () => {
    startAdminSession(session);
    let finish: () => void = () => undefined;
    let started: () => void = () => undefined;
    const ready = new Promise<void>((resolve) => { started = resolve; });
    const response = new Promise<void>((resolve) => { finish = resolve; });
    server.use(http.post(`${API_URL}/admin/auth/refresh`, async () => {
      started();
      await response;
      return HttpResponse.json({ ...session, idToken: 'new-access' });
    }));
    const token = getAdminToken(true);
    await ready;
    clearAdminSession();
    finish();
    expect(await token).toBeNull();
    expect(readAdminSession()).toBeNull();
  });
});
