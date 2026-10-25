import { api } from '@/lib/api';
import type { Page } from '@/lib/domain';

export async function getAllChapterItems<T>(chapterId: string, kind: 'flashcards' | 'audio'): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page += 1) {
    const { data } = await api.get<Page<T>>(`/admin/chapters/${chapterId}/${kind}`, { params: { page, limit: 100 } });
    items.push(...data.data);
    if (items.length >= data.meta.total || data.data.length === 0) return items;
  }
}

