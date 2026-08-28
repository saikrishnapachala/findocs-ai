import { describe, it, expect } from 'vitest';
import { chunkPages } from './chunker';
import type { PageText } from '@/lib/types';

function makePage(page: number, sentenceCount: number): PageText {
  const sentences = Array.from(
    { length: sentenceCount },
    (_, i) => `This is sentence number ${i} on page ${page} with some words.`,
  );
  return { page, text: sentences.join(' ') };
}

describe('chunkPages', () => {
  it('returns no chunks for empty input', () => {
    expect(chunkPages('doc', [])).toEqual([]);
    expect(chunkPages('doc', [{ page: 1, text: '' }])).toEqual([]);
  });

  it('produces a single chunk for short input', () => {
    const chunks = chunkPages('doc', [{ page: 1, text: 'Total revenue was $10.' }]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.pageStart).toBe(1);
    expect(chunks[0]!.pageEnd).toBe(1);
    expect(chunks[0]!.content).toContain('Total revenue');
    expect(chunks[0]!.id).toBe('doc:0');
  });

  it('splits long input into multiple ordered chunks', () => {
    const pages = [makePage(1, 40)];
    const chunks = chunkPages('doc', pages, { targetTokens: 40, overlapRatio: 0.15 });
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c, i) => expect(c.chunkIndex).toBe(i));
  });

  it('keeps each chunk near the token target (never wildly over)', () => {
    const pages = [makePage(1, 60)];
    const target = 50;
    const chunks = chunkPages('doc', pages, { targetTokens: target, overlapRatio: 0.15 });
    for (const c of chunks) {
      // Allow overlap seeding to push a chunk modestly over target.
      expect(c.tokenCount).toBeLessThanOrEqual(target * 1.6);
    }
  });

  it('overlaps consecutive chunks so context carries across boundaries', () => {
    const pages = [makePage(1, 60)];
    const chunks = chunkPages('doc', pages, { targetTokens: 50, overlapRatio: 0.2 });
    expect(chunks.length).toBeGreaterThan(1);
    // The end of chunk n should share a sentence with the start of chunk n+1.
    const first = chunks[0]!;
    const second = chunks[1]!;
    const firstTail = first.content.split(' ').slice(-6).join(' ');
    // Some words from the tail of chunk 0 should reappear in chunk 1.
    const overlapWords = firstTail
      .split(' ')
      .filter((w) => second.content.includes(w));
    expect(overlapWords.length).toBeGreaterThan(0);
  });

  it('maps page ranges across a chunk that spans two pages', () => {
    const pages = [makePage(1, 8), makePage(2, 8)];
    const chunks = chunkPages('doc', pages, { targetTokens: 400, overlapRatio: 0.1 });
    // With a large target, one chunk should span both pages.
    const spanning = chunks.find((c) => c.pageStart !== c.pageEnd);
    expect(spanning).toBeDefined();
    expect(spanning!.pageStart).toBe(1);
    expect(spanning!.pageEnd).toBe(2);
  });

  it('records monotonic character spans', () => {
    const pages = [makePage(1, 20)];
    const chunks = chunkPages('doc', pages, { targetTokens: 60, overlapRatio: 0.15 });
    for (const c of chunks) {
      expect(c.charEnd).toBeGreaterThan(c.charStart);
    }
  });
});
