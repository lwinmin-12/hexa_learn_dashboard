import { describe, expect, it } from 'vitest';
import { parseFlashcardCsv } from './csv';

describe('flashcard CSV preview', () => {
  it.each(['"a"oops,b', 'a"oops,b', '"a" "b",c'])('rejects malformed quoting without altering card text (%s)', (row) => {
    const result = parseFlashcardCsv(`front_text,back_text\n${row}\n`);
    expect(result.rows).toEqual([]);
    expect(result.entries).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('keeps row details for invalid text and URLs and enforces the row limit', () => {
    const result = parseFlashcardCsv(`front_text,back_text,audio_url\n${'a'.repeat(201)},Too long,\nねこ,cat,javascript:bad\nいぬ,dog,\n`);
    expect(result.entries).toHaveLength(3);
    expect(result.rows).toEqual([{ frontText: 'いぬ', backText: 'dog', audioUrl: null }]);
    expect(result.errors).toHaveLength(2);
    const tooMany = parseFlashcardCsv(`front_text,back_text\n${'ねこ,cat\n'.repeat(1001)}`);
    expect(tooMany.rows).toEqual([]);
    expect(tooMany.errors).toContain('CSV can contain at most 1,000 flashcards.');
  });
  it('parses quoted commas and escaped quotes, and reports malformed rows', () => {
    const result = parseFlashcardCsv('front_text,back_text,audio_url\n"こんにちは, は",Hello,\n"彼は""学生""です",He is a student,\n,Missing front,');

    expect(result.rows).toEqual([
      { frontText: 'こんにちは, は', backText: 'Hello', audioUrl: null },
      { frontText: '彼は"学生"です', backText: 'He is a student', audioUrl: null },
    ]);
    expect(result.errors).toEqual(['Line 4: front_text and back_text are required.']);
  });
});
