import { describe, it, expect } from 'vitest';
import { postProcessAnswer, citationCoverage, stripDangling } from './citations';
import type { RetrievedChunk } from '@/lib/types';

function ctx(n: number): RetrievedChunk[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i + 1}`,
    documentId: 'doc',
    documentName: 'report.pdf',
    pageStart: i + 1,
    pageEnd: i + 1,
    content: `passage ${i + 1}`,
    vectorScore: 0.5,
    ftsRank: null,
    fused: 0.1,
  }));
}

describe('postProcessAnswer', () => {
  it('maps valid citations to their chunks', () => {
    const res = postProcessAnswer('Revenue rose [1]. Margin grew [2].', ctx(2));
    expect(res.citations.map((c) => c.n)).toEqual([1, 2]);
    expect(res.citations[0]!.chunkId).toBe('c1');
    expect(res.citations[1]!.pageStart).toBe(2);
    expect(res.dangling).toEqual([]);
  });

  it('flags dangling citations that do not map to a passage', () => {
    const res = postProcessAnswer('A claim [1] and a bad one [9].', ctx(2));
    expect(res.citations.map((c) => c.n)).toEqual([1]);
    expect(res.dangling).toEqual([9]);
  });

  it('deduplicates repeated citations', () => {
    const res = postProcessAnswer('Point [1]. Restated [1][2].', ctx(2));
    expect(res.citations.map((c) => c.n)).toEqual([1, 2]);
  });
});

describe('citationCoverage', () => {
  it('is the fraction of sentences with a valid citation', () => {
    expect(citationCoverage('Cited [1]. Uncited sentence.', 2)).toBe(0.5);
    expect(citationCoverage('All cited [1]. Also cited [2].', 2)).toBe(1);
    expect(citationCoverage('Dangling only [9].', 2)).toBe(0);
  });
});

describe('stripDangling', () => {
  it('removes only out-of-range markers', () => {
    expect(stripDangling('Good [1] bad [9] end.', 2)).toBe('Good [1] bad end.');
  });
});
