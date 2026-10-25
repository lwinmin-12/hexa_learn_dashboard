import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/common/Button';
import type { Chapter, Course } from '@/lib/domain';
import { ChapterPicker } from './ChapterPicker';
import { FlashcardsPanel } from './FlashcardsPanel';
import { AudioTracksPanel } from './AudioTracksPanel';
import { LearningToolsEmpty, primaryActionClass } from './LearningToolsShared';

export function ChapterTools({ course, chapters, mode, onGoToContent }: { course: Course; chapters: Chapter[]; mode: 'flashcards' | 'audio'; onGoToContent: () => void }) {
  const [params, setParams] = useSearchParams();
  const requestedId = params.get('chapter');
  const selectedId = chapters.find((chapter) => chapter.id === requestedId)?.id ?? chapters[0]?.id ?? '';
  useEffect(() => {
    if (!selectedId || requestedId === selectedId) return;
    setParams((previous) => { const next = new URLSearchParams(previous); next.set('chapter', selectedId); return next; }, { replace: true });
  }, [requestedId, selectedId, setParams]);
  const picker = <ChapterPicker chapters={chapters} selectedId={selectedId} onChange={(id) => setParams((previous) => { const next = new URLSearchParams(previous); next.set('chapter', id); return next; })} />;
  return <section aria-label={`${mode === 'flashcards' ? 'Flashcards' : 'Audio tracks'} for ${course.title}`} className="surface-card rounded-xl">
    {!selectedId ? <LearningToolsEmpty title="Add a chapter first" description="Create a chapter to organize its flashcards and audio tracks."><Button variant="primary" className={primaryActionClass} onClick={onGoToContent}>Go to Content</Button></LearningToolsEmpty> : mode === 'flashcards' ? <FlashcardsPanel key={selectedId} chapterId={selectedId} chapterPicker={picker} /> : <AudioTracksPanel key={selectedId} chapterId={selectedId} chapterPicker={picker} />}
  </section>;
}
