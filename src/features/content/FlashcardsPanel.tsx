import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Pause, Pencil, Play, Plus, Search, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Modal } from '@/components/common/Modal';
import { useToast } from '@/app/toast-context';
import { queryKeys } from '@/lib/query-keys';
import { messageFromError } from '@/lib/utils';
import { createFlashcard, deleteFlashcard, importFlashcards, updateFlashcard, type Flashcard } from './api';
import { parseFlashcardCsv, type FlashcardCsvPreview } from './csv';
import { FileDropzone, LearningToolsEmpty, LearningToolsError, LearningToolsLoading, primaryActionClass } from './LearningToolsShared';
import { getAllChapterItems } from './learningTools';

export function FlashcardsPanel({ chapterId, chapterPicker }: { chapterId: string; chapterPicker: ReactNode }) {
  const client = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<'new' | Flashcard | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Flashcard | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const cards = useQuery({ queryKey: queryKeys.flashcards(chapterId), queryFn: () => getAllChapterItems<Flashcard & { position?: number }>(chapterId, 'flashcards') });
  const refresh = () => client.invalidateQueries({ queryKey: queryKeys.flashcards(chapterId) });
  const remove = useMutation({ mutationFn: deleteFlashcard, onSuccess: async () => { await refresh(); setDeleteTarget(null); toast('Flashcard deleted.'); restoreFocus(); }, onError: (error) => toast(messageFromError(error), 'error') });
  const sorted = [...(cards.data ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const visible = sorted.filter((card) => `${card.frontText} ${card.backText}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  function rememberFocus() { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }
  function restoreFocus() { window.setTimeout(() => { if (returnFocus.current?.isConnected) returnFocus.current.focus(); else document.getElementById('add-flashcard')?.focus(); }, 0); }
  function openCreate() { rememberFocus(); setDialog('new'); }
  const addAction = <Button id="add-flashcard" variant="primary" className={primaryActionClass} onClick={openCreate}><Plus className="size-4" />Add flashcard</Button>;

  return <div className="p-5 md:p-6">
    <header className="sticky top-[68px] z-20 flex flex-col items-stretch justify-between gap-4 xl:flex-row xl:items-start bg-white/95 py-3 backdrop-blur dark:bg-slate-900/95">
      <div className="min-w-0 flex-1"><h2 className="text-base font-semibold">Flashcards</h2><p className="mt-1 text-sm text-muted">Help learners remember words with clear, simple cards.</p><div className="mt-4 flex flex-wrap items-end gap-3">{chapterPicker}<div className="relative w-full sm:w-64"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 size-4 text-muted" /><input aria-label="Search flashcards" className="field pl-9" placeholder="Search front or back" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div></div>
      <div className="flex flex-wrap gap-2"><Button onClick={() => { rememberFocus(); setImportOpen(true); }}><Upload className="size-4" />Import CSV</Button>{addAction}</div>
    </header>
    <p className="my-5 text-sm text-muted">{sorted.length} {sorted.length === 1 ? 'card' : 'cards'}{search.trim() && ` · ${visible.length} matching`}</p>
    {cards.isPending ? <LearningToolsLoading /> : cards.isError ? <LearningToolsError message={messageFromError(cards.error)} onRetry={() => void cards.refetch()} /> : !sorted.length ? <LearningToolsEmpty title="No flashcards yet" description="Add a card or import a CSV to start this chapter."><Button variant="primary" className={primaryActionClass} onClick={openCreate}><Plus className="size-4" />Add flashcard</Button></LearningToolsEmpty> : !visible.length ? <LearningToolsEmpty title="No matching cards" description="Try another word or clear your search."><Button onClick={() => setSearch('')}>Clear search</Button></LearningToolsEmpty> : <div className="overflow-hidden rounded-xl border border-line dark:border-slate-700"><table className="block w-full text-left lg:table"><thead className="hidden bg-[#F7F8F8] text-xs font-normal text-muted dark:bg-slate-950 lg:table-header-group"><tr>{['Order', 'Front', 'Back', 'Audio', 'Actions'].map((label) => <th className="px-4 py-3 font-normal" key={label}>{label}</th>)}</tr></thead><tbody className="block divide-y divide-line dark:divide-slate-700 lg:table-row-group">{visible.map((card) => <tr key={card.id} className="grid min-h-14 grid-cols-[1fr_auto] items-start px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 lg:table-row lg:p-0"><td className="mb-1 text-xs text-muted lg:px-4 lg:py-4">{sorted.findIndex((item) => item.id === card.id) + 1}</td><td className="col-start-1 row-start-2 break-words text-lg text-ink dark:text-white lg:max-w-64 lg:px-4 lg:py-4" lang="ja">{card.frontText}</td><td className="col-start-1 row-start-3 break-words text-sm text-muted lg:max-w-64 lg:px-4 lg:py-4">{card.backText}</td><td className="col-start-1 row-start-4 mt-2 text-sm text-muted lg:mt-0 lg:px-4 lg:py-3">{card.audioUrl && validAudioUrl(card.audioUrl) ? <FlashcardAudio url={card.audioUrl} title={card.frontText} /> : <span aria-label="No audio">—</span>}</td><td className="col-start-2 row-span-4 row-start-1 lg:px-4 lg:py-3"><div className="flex gap-1"><Button size="sm" variant="ghost" aria-label={`Edit ${card.frontText}`} title="Edit flashcard" onClick={() => { rememberFocus(); setDialog(card); }}><Pencil className="size-4" /></Button><Button size="sm" variant="ghost" className="text-red-700 dark:text-red-400" aria-label={`Delete ${card.frontText}`} title="Delete flashcard" onClick={() => { rememberFocus(); setDeleteTarget(card); }}><Trash2 className="size-4" /></Button></div></td></tr>)}</tbody></table></div>}
    {dialog && <FlashcardDialog chapterId={chapterId} card={dialog === 'new' ? null : dialog} onClose={() => { setDialog(null); restoreFocus(); }} onSaved={refresh} />}
    {importOpen && <FlashcardImportDialog chapterId={chapterId} onClose={() => { setImportOpen(false); restoreFocus(); }} onImported={refresh} />}
    <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !remove.isPending) { setDeleteTarget(null); restoreFocus(); } }} title="Delete this flashcard?" description="Learners will no longer see this card." confirmLabel="Delete flashcard" destructive busy={remove.isPending} onConfirm={() => { if (deleteTarget) remove.mutate(deleteTarget.id); }} />
  </div>;
}

function FlashcardAudio({ url, title }: { url: string; title: string }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const toast = useToast();
  return <><audio ref={audio} src={url} preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => { setPlaying(false); toast('This audio could not be played.', 'error'); }} /><Button variant="ghost" size="sm" aria-label={`${playing ? 'Pause' : 'Play'} audio for ${title}`} title={`${playing ? 'Pause' : 'Play'} audio`} onClick={() => { if (playing) audio.current?.pause(); else void audio.current?.play().catch(() => toast('This audio could not be played.', 'error')); }}>{playing ? <Pause className="size-4" /> : <Play className="size-4" />}</Button></>;
}

function validAudioUrl(value: string) {
  if (!value.trim()) return true;
  try { return ['http:', 'https:'].includes(new URL(value.trim()).protocol); } catch { return false; }
}

function FlashcardDialog({ chapterId, card, onClose, onSaved }: { chapterId: string; card: Flashcard | null; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const toast = useToast();
  const frontInput = useRef<HTMLInputElement | null>(null);
  const [front, setFront] = useState(card?.frontText ?? '');
  const [back, setBack] = useState(card?.backText ?? '');
  const [audio, setAudio] = useState(card?.audioUrl ?? '');
  const [error, setError] = useState<string | null>(null);
  const valid = front.trim().length > 0 && front.length <= 200 && back.trim().length > 0 && back.length <= 500 && validAudioUrl(audio);
  const save = useMutation({ mutationFn: (another: boolean) => { const input = { frontText: front.trim(), backText: back.trim(), audioUrl: audio.trim() || null }; return (card ? updateFlashcard(card.id, input) : createFlashcard(chapterId, input)).then(() => another); }, onSuccess: (another) => { void onSaved(); toast(card ? 'Flashcard updated.' : 'Flashcard added.'); if (another) { setFront(''); setBack(''); setAudio(''); requestAnimationFrame(() => frontInput.current?.focus()); } else onClose(); }, onError: (cause) => { const message = messageFromError(cause); setError(message); toast(message, 'error'); } });
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (valid && !save.isPending) { setError(null); save.mutate(false); } }
  return <Modal open onOpenChange={(open) => { if (!open && !save.isPending) onClose(); }} title={card ? 'Edit flashcard' : 'Add flashcard'} description="Write the prompt on the front and its meaning on the back."><form onSubmit={submit} className="space-y-4">
    <div><label htmlFor="flashcard-front" className="field-label">Front</label><input ref={frontInput} autoFocus disabled={save.isPending} id="flashcard-front" className="field text-lg" required maxLength={200} value={front} onChange={(event) => setFront(event.target.value)} /><p className="mt-1 text-xs text-muted">{front.length}/200 characters</p></div>
    <div><label htmlFor="flashcard-back" className="field-label">Back</label><input id="flashcard-back" disabled={save.isPending} className="field" required maxLength={500} value={back} onChange={(event) => setBack(event.target.value)} /><p className="mt-1 text-xs text-muted">{back.length}/500 characters</p></div>
    <div><label htmlFor="flashcard-audio" className="field-label">Audio URL <span className="font-normal text-muted">(optional)</span></label><input id="flashcard-audio" disabled={save.isPending} className="field" type="url" placeholder="https://…" value={audio} aria-invalid={!validAudioUrl(audio)} onChange={(event) => setAudio(event.target.value)} />{!validAudioUrl(audio) && <p role="alert" className="mt-1 text-sm text-red-700 dark:text-red-300">Use an HTTP or HTTPS audio URL.</p>}</div>
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    <div className="flex flex-wrap justify-end gap-2"><Button type="button" disabled={save.isPending} onClick={onClose}>Cancel</Button>{!card && <Button type="button" disabled={!valid || save.isPending} onClick={() => { setError(null); save.mutate(true); }}>Save and add another</Button>}<Button type="submit" variant="primary" className={primaryActionClass} disabled={!valid || save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button></div>
  </form></Modal>;
}

function FlashcardImportDialog({ chapterId, onClose, onImported }: { chapterId: string; onClose: () => void; onImported: () => Promise<unknown> }) {
  const toast = useToast();
  const [preview, setPreview] = useState<FlashcardCsvPreview | null>(null);
  const [fileName, setFileName] = useState('');
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<number | null>(null);
  const readVersion = useRef(0);
  const skippedRows = preview?.entries.filter((entry) => entry.error) ?? [];
  const fatal = Boolean(preview?.errors.length && !preview.entries.length);
  const validRows = fatal ? [] : preview?.rows ?? [];
  const upload = useMutation({ mutationFn: () => { const escape = (value: string) => `"${value.replaceAll('"', '""')}"`; const csv = ['front_text,back_text,audio_url', ...validRows.map((row) => [row.frontText, row.backText, row.audioUrl ?? ''].map(escape).join(','))].join('\r\n'); return importFlashcards(chapterId, new File([csv], fileName || 'flashcards.csv', { type: 'text/csv' })); }, onSuccess: (result) => { void onImported(); setImported(result.count); toast(`${result.count} ${result.count === 1 ? 'flashcard' : 'flashcards'} imported.`); }, onError: (cause) => { const message = messageFromError(cause); setError(message); toast(message, 'error'); } });
  async function chooseFile(file: File) {
    const version = ++readVersion.current;
    setPreview(null); setError(null); setImported(null); setFileName(file.name); setReading(false);
    if (!file.name.toLowerCase().endsWith('.csv')) { setError('Choose a CSV file.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('CSV must be 5 MB or smaller.'); return; }
    setReading(true);
    try { const parsed = parseFlashcardCsv(await file.text()); if (version === readVersion.current) setPreview(parsed); }
    catch { if (version === readVersion.current) setError('This CSV could not be read. Please choose it again.'); }
    finally { if (version === readVersion.current) setReading(false); }
  }
  return <Modal open onOpenChange={(open) => { if (!open && !upload.isPending) onClose(); }} title="Import flashcards" description="Upload up to 1,000 cards in a CSV file, 5 MB maximum." className="max-w-2xl">
    {imported !== null ? <div className="space-y-4"><p role="status" className="text-sm font-medium">{imported} imported, {Math.max(0, (preview?.entries.length ?? 0) - imported)} skipped</p>{skippedRows.length > 0 && <div><h3 className="text-sm font-medium">Skipped rows</h3><ul className="mt-2 space-y-1 text-sm text-red-700 dark:text-red-300">{skippedRows.map((row) => <li key={row.line}>{row.error}</li>)}</ul></div>}<div className="flex justify-end"><Button variant="primary" className={primaryActionClass} onClick={onClose}>Done</Button></div></div> : <div className="space-y-4">
      <p className="text-sm text-muted">Expected columns <code>front_text</code>, <code>back_text</code>, and optional <code>audio_url</code>.</p><a className="inline-flex items-center gap-2 rounded text-sm font-medium text-teal-800 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:text-teal-300" href="data:text/csv;charset=utf-8,front_text%2Cback_text%2Caudio_url%0A%E3%81%AD%E3%81%93%2Ccat%2C%0A" download="flashcards-template.csv"><Download className="size-4" />Download template</a>
      <FileDropzone autoFocus label="Choose or drop a CSV file" accept=".csv,text/csv" onFile={(file) => void chooseFile(file)} disabled={upload.isPending} />{fileName && <p className="break-all text-sm text-muted">{fileName}</p>}
      {reading && <p role="status" className="text-sm text-muted">Reading CSV…</p>}
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      {fatal && <ul role="alert" className="space-y-1 text-sm text-red-700 dark:text-red-300">{preview?.errors.map((message) => <li key={message}>{message}</li>)}</ul>}
      {Boolean(preview?.entries.length) && <><div><h3 className="mb-2 text-sm font-medium">Preview · First 5 rows</h3><div className="overflow-x-auto rounded-lg border border-line"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-muted dark:bg-slate-950"><tr>{['Row', 'Front', 'Back', 'Validation'].map((title) => <th key={title} className="px-3 py-2 font-normal">{title}</th>)}</tr></thead><tbody className="divide-y divide-line">{preview?.entries.slice(0, 5).map((row) => <tr key={row.line}><td className="px-3 py-3">{row.line}</td><td className="max-w-36 break-words px-3 py-3" lang="ja">{row.frontText || '—'}</td><td className="max-w-36 break-words px-3 py-3">{row.backText || '—'}</td><td className={`px-3 py-3 ${row.error ? 'text-red-700 dark:text-red-300' : 'text-muted'}`}>{row.error || 'Ready'}</td></tr>)}</tbody></table></div></div><p className="text-sm text-muted">{validRows.length} ready to import · {skippedRows.length} skipped</p>{skippedRows.length > 0 && <div><h3 className="text-sm font-medium">Rows to skip</h3><ul className="mt-2 max-h-40 space-y-1 overflow-auto text-sm text-red-700 dark:text-red-300">{skippedRows.map((row) => <li key={row.line}>{row.error}</li>)}</ul></div>}</>}
      <div className="flex flex-wrap justify-end gap-2"><Button disabled={upload.isPending} onClick={onClose}>Cancel</Button><Button variant="primary" className={primaryActionClass} disabled={reading || !validRows.length || upload.isPending} onClick={() => { setError(null); upload.mutate(); }}>{upload.isPending ? 'Importing…' : `Import ${validRows.length} ${validRows.length === 1 ? 'card' : 'cards'}`}</Button></div>
    </div>}
  </Modal>;
}
