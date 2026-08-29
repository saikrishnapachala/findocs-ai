import { describe, it, expect } from 'vitest';
import { maximalMarginalRelevance } from './mmr';

describe('maximalMarginalRelevance', () => {
  it('returns all candidates (relevance-sorted) when there are <= k', () => {
    const ids = maximalMarginalRelevance({
      candidates: [
        { id: 'x', embedding: [1, 0], relevance: 0.2 },
        { id: 'y', embedding: [0, 1], relevance: 0.9 },
      ],
      k: 5,
    });
    expect(ids).toEqual(['y', 'x']);
  });

  it('avoids redundancy: prefers a diverse item over a near-duplicate', () => {
    // A and B are near-duplicates; C is orthogonal but less relevant.
    const ids = maximalMarginalRelevance({
      candidates: [
        { id: 'A', embedding: [1, 0], relevance: 1.0 },
        { id: 'B', embedding: [1, 0.01], relevance: 0.9 },
        { id: 'C', embedding: [0, 1], relevance: 0.5 },
      ],
      k: 2,
      lambda: 0.5,
    });
    expect(ids[0]).toBe('A'); // most relevant, picked first
    expect(ids).toContain('C'); // diversification beats the near-duplicate B
    expect(ids).not.toContain('B');
  });
});
