import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { COURSE_IDS, seedCourses } from '@/mocks/data';
import { API_URL } from '@/lib/constants';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { CourseEditorPage } from './CourseEditorPage';


describe('course learning-material tabs', () => {
  it('separates flashcards and audio from Content and fetches only the selected tool', async () => {
    const user = userEvent.setup();
    const flashcardRequests: string[] = [];
    const audioRequests: string[] = [];
    const chapters = seedCourses[0].chapters ?? [];
    server.use(
      http.get(`${API_URL}/admin/chapters/:id/flashcards`, ({ params }) => {
        flashcardRequests.push(String(params.id));
        return HttpResponse.json({ data: [{ id: 'card', frontText: 'こんにちは', backText: 'Hello', audioUrl: null }], meta: { page: 1, limit: 20, total: 1 } });
      }),
      http.get(`${API_URL}/admin/chapters/:id/audio`, ({ params }) => {
        audioRequests.push(String(params.id));
        return HttpResponse.json({ data: [], meta: { page: 1, limit: 20, total: 0 } });
      }),
    );
    renderWithProviders(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[`/courses/${COURSE_IDS.beginner}`]}><Routes><Route path="/courses/:id" element={<CourseEditorPage />} /></Routes></MemoryRouter>);
    await screen.findByRole('tab', { name: 'Content' });
    await user.click(screen.getByRole('tab', { name: 'Content' }));
    expect(screen.getByRole('heading', { name: 'Course content' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Front of flashcard')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upload audio' })).not.toBeInTheDocument();
    expect(flashcardRequests).toEqual([]);
    expect(audioRequests).toEqual([]);

    await user.click(screen.getByRole('tab', { name: 'Flashcards' }));
    expect(await screen.findByText('こんにちは')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import CSV' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upload audio' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Choose a chapter' }));
    await user.click(screen.getByRole('menuitemradio', { name: `2. ${chapters[1].title}` }));
    await waitFor(() => expect(flashcardRequests).toEqual(chapters.map((chapter) => chapter.id)));
    expect(audioRequests).toEqual([]);

    await user.click(screen.getByRole('tab', { name: 'Audio tracks' }));
    expect(await screen.findByText('No audio tracks yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Upload audio' })).toHaveLength(2);
    expect(screen.queryByLabelText('Front of flashcard')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import CSV' })).not.toBeInTheDocument();
    expect(audioRequests).toEqual([chapters[1].id]);
  });
});
