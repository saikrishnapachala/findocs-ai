import { describe, it, expect, beforeEach } from 'vitest';
import { addSpend, getSpendTodayUsd, isOverDailyCap, __resetSpend } from './spend';

describe('daily spend cap', () => {
  beforeEach(() => __resetSpend());

  it('accumulates spend', () => {
    addSpend(0.01);
    addSpend(0.02);
    expect(getSpendTodayUsd()).toBeCloseTo(0.03, 6);
  });

  it('reports over-cap once the threshold is reached', () => {
    expect(isOverDailyCap(1)).toBe(false);
    addSpend(0.99);
    expect(isOverDailyCap(1)).toBe(false);
    addSpend(0.02);
    expect(isOverDailyCap(1)).toBe(true);
  });

  it('ignores non-positive amounts', () => {
    addSpend(-5);
    addSpend(0);
    expect(getSpendTodayUsd()).toBe(0);
  });
});
