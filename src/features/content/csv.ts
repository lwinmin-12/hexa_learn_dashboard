export type FlashcardCsvRow = { frontText: string; backText: string; audioUrl: string | null };
export type FlashcardCsvEntry = FlashcardCsvRow & { line: number; error: string | null };
export type FlashcardCsvPreview = { rows: FlashcardCsvRow[]; errors: string[]; entries: FlashcardCsvEntry[] };

export function parseFlashcardCsv(source: string): FlashcardCsvPreview {
  const matrix: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoting: 'plain' | 'quoted' | 'closed' = 'plain';
  const text = source.replace(/^\uFEFF/, '');

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoting === 'quoted') {
      if (character === '"' && text[index + 1] === '"') { value += '"'; index += 1; }
      else if (character === '"') quoting = 'closed';
      else value += character;
    } else if (character === '"') {
      if (quoting === 'closed' || value.length > 0) return { rows: [], entries: [], errors: ['CSV has an invalid quoted field.'] };
      quoting = 'quoted';
    }
    else if (character === ',') { row.push(value); value = ''; quoting = 'plain'; }
    else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value); value = '';
      if (row.some((cell) => cell.trim())) matrix.push(row);
      row = []; quoting = 'plain';
    } else if (quoting === 'closed') return { rows: [], entries: [], errors: ['CSV has unexpected text after a quoted field.'] };
    else value += character;
  }
  if (quoting === 'quoted') return { rows: [], entries: [], errors: ['CSV has an unclosed quoted field.'] };
  row.push(value);
  if (row.some((cell) => cell.trim())) matrix.push(row);
  if (!matrix.length) return { rows: [], entries: [], errors: ['CSV is empty.'] };

  const headers = matrix[0].map((header) => header.trim().toLowerCase());
  const allowed = ['front_text', 'back_text', 'audio_url'];
  const errors: string[] = [];
  if (new Set(headers).size !== headers.length) errors.push('CSV headers must be unique.');
  if (!headers.includes('front_text') || !headers.includes('back_text')) errors.push('Include front_text and back_text columns.');
  if (headers.some((header) => !allowed.includes(header))) errors.push('Only front_text, back_text, and audio_url columns are supported.');
  if (errors.length) return { rows: [], entries: [], errors };

  const frontIndex = headers.indexOf('front_text');
  const backIndex = headers.indexOf('back_text');
  const audioIndex = headers.indexOf('audio_url');
  const rows: FlashcardCsvRow[] = [];
  const entries: FlashcardCsvEntry[] = [];
  if (matrix.length - 1 > 1000) return { rows, entries, errors: ['CSV can contain at most 1,000 flashcards.'] };
  matrix.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const frontText = cells[frontIndex]?.trim() ?? '';
    const backText = cells[backIndex]?.trim() ?? '';
    const audio = audioIndex < 0 ? '' : cells[audioIndex]?.trim() ?? '';
    let error: string | null = null;
    if (!frontText || !backText) error = `Line ${line}: front_text and back_text are required.`;
    else if (frontText.length > 200 || backText.length > 500) error = `Line ${line}: front_text must be 200 characters or fewer and back_text 500 or fewer.`;
    else if (audio && !isHttpUrl(audio)) error = `Line ${line}: audio_url must be an HTTP or HTTPS URL.`;
    else if (cells.length !== headers.length) error = `Line ${line}: expected ${headers.length} columns, found ${cells.length}.`;
    const entry = { line, frontText, backText, audioUrl: audio || null, error };
    entries.push(entry);
    if (error) errors.push(error);
    else rows.push({ frontText, backText, audioUrl: audio || null });
  });
  if (!rows.length && !errors.length) errors.push('CSV contains no flashcards.');
  return { rows, errors, entries };
}

function isHttpUrl(value: string) {
  try { const url = new URL(value); return url.protocol === 'http:' || url.protocol === 'https:'; }
  catch { return false; }
}
