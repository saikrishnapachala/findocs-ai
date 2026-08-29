import { describe, it, expect } from 'vitest';
import { cosineSimilarity, bm25Scores } from './scoring';
import type { StoredChunk } from '@/lib/types';

function chunk(id: string, content: string): StoredChunk {
  return {
    id,
    sessionId: 's',
    documentId: 'd',
    documentName: 'doc.pdf',
    chunkIndex: 0,
    pageStart: 1,
    pageEnd: 1,
    content,
    tokenCount: 0,
    charStart: 0,
    charEnd: content.length,
    embedding: [],
  };
}

describe('cosineSimilarity', () => {
  it('is 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6);
  });
  it('is 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });
  it('is -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 1], [-1, -1])).toBeCloseTo(-1, 6);
  });
  it('returns 0 when a vector is all zeros', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});

describe('bm25Scores', () => {
  const corpus = [
    chunk('a', 'Total revenue was 1200 million dollars in fiscal 2024.'),
    chunk('b', 'The board approved a new dividend policy this quarter.'),
    chunk('c', 'Revenue growth accelerated as revenue from cloud services rose.'),
  ];

  it('scores chunks containing query terms above those that do not', () => {
    const scores = bm25Scores('revenue', corpus);
    expect(scores[0]!).toBeGreaterThan(0);
    expect(scores[2]!).toBeGreaterThan(0);
    expect(scores[1]!).toBe(0); // no "revenue" term
  });

  it('ranks the more term-dense chunk higher', () => {
    const scores = bm25Scores('revenue', corpus);
    // chunk c mentions "revenue" twice; should outscore chunk a.
    expect(scores[2]!).toBeGreaterThan(scores[0]!);
  });

  it('returns all-zero scores for an empty/stopword-only query', () => {
    expect(bm25Scores('the of and', corpus)).toEqual([0, 0, 0]);
  });
});
