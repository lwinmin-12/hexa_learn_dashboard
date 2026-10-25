import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { expect, it } from 'vitest';
import { API_URL } from '@/lib/constants';
import { server } from '@/test/server';
import { renderWithProviders } from '@/test/render';
import { ChannelPanel } from '@/features/courses/pages/CourseEditorPage';

it('renders the real channel shape without a memberCount or learner display name', async () => {
  const meta = { page: 1, limit: 20, total: 1 };
  server.use(
    http.get(`${API_URL}/admin/courses/course/channel`, () => HttpResponse.json({ id: 'channel', courseId: 'course', name: 'Course community' })),
    http.get(`${API_URL}/admin/channels/channel/messages`, () => HttpResponse.json({ data: [], meta: { ...meta, total: 0 } })),
    http.get(`${API_URL}/admin/channels/channel/members`, () => HttpResponse.json({ data: [{ id: 'member', user: { id: 'learner', displayName: null, avatarUrl: null }, joinedAt: new Date().toISOString() }], meta })),
  );
  renderWithProviders(<ChannelPanel courseId="course" />);
  expect(await screen.findByText('1 learners in this channel')).toBeInTheDocument();
  expect(await screen.findByText('Learner')).toBeInTheDocument();
});
