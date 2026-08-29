import { describe, it, expect } from 'vitest';
import { reciprocalRankFusion } from './rrf';

describe('reciprocalRankFusion', () => {
  it('ranks an item appearing in both lists above single-list items', () => {
    const fused = reciprocalRankFusion([
      ['a', 'b', 'c'],
      ['b', 'd'],
    ]);
    // b appears in both lists, so it should outrank a (only in list 1 at rank 1).
    expect(fused.get('b')!).toBeGreaterThan(fused.get('a')!);
  });

  it('rewards higher ranks within a list', () => {
    const fused = reciprocalRankFusion([['a', 'b', 'c']]);
    expect(fused.get('a')!).toBeGreaterThan(fused.get('b')!);
    expect(fused.get('b')!).toBeGreaterThan(fused.get('c')!);
  });

  it('uses the 1/(k+rank) formula with the given k', () => {
    const fused = reciprocalRankFusion([['a']], 60);
    expect(fused.get('a')!).toBeCloseTo(1 / 61, 8);
  });
});
