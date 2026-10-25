import { api } from '@/lib/api';
import type { Page } from '@/lib/domain';

export type Flashcard = { id: string; frontText: string; backText: string; audioUrl: string | null };
export type AudioTrack = { id: string; title: string; type: 'vocab' | 'speaking'; durationSec: number; audioUrl: string };
export async function getFlashcards(chapterId: string) {
  const { data } = await api.get<Page<Flashcard>>(`/admin/chapters/${chapterId}/flashcards`);
  return data;
}
export async function createFlashcard(chapterId: string, input: Omit<Flashcard, 'id'>) {
  const { data } = await api.post<Flashcard>(`/admin/chapters/${chapterId}/flashcards`, input);
  return data;
}
export async function updateFlashcard(id: string, input: Pick<Flashcard, 'frontText' | 'backText' | 'audioUrl'>) {
  const { data } = await api.patch<Flashcard>(`/admin/flashcards/${id}`, input);
  return data;
}
export async function deleteFlashcard(id: string) {
  const { data } = await api.delete(`/admin/flashcards/${id}`);
  return data;
}
export async function importFlashcards(chapterId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<{ count: number }>(`/admin/chapters/${chapterId}/flashcards/import`, form);
  return data;
}
export async function getAudioTracks(chapterId: string) {
  const { data } = await api.get<Page<AudioTrack>>(`/admin/chapters/${chapterId}/audio`);
  return data;
}
export async function createAudioTrack(chapterId: string, file: File, input: { title: string; type: AudioTrack['type'] }) {
  const form = new FormData();
  form.append('file', file);
  form.append('title', input.title);
  form.append('type', input.type);
  const { data } = await api.post<AudioTrack>(`/admin/chapters/${chapterId}/audio`, form);
  return data;
}
export async function deleteAudioTrack(id: string) {
  const { data } = await api.delete(`/admin/audio/${id}`);
  return data;
}
