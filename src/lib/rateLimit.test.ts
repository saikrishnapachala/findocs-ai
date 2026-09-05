import { describe, it, expect, beforeEach } from 'vitest';
import { rateLimit, __resetRateLimit } from './rateLimit';

describe('rateLimit (fixed window)', () => {
  beforeEach(() => __resetRateLimit());

  it('allows up to the limit then blocks', () => {
    const key = 'chat:1.2.3.4';
    expect(rateLimit(key, 3, 60_000).allowed).toBe(true);
    expect(rateLimit(key, 3, 60_000).allowed).toBe(true);
    expect(rateLimit(key, 3, 60_000).allowed).toBe(true);
    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('tracks separate keys independently', () => {
    expect(rateLimit('a', 1, 60_000).allowed).toBe(true);
    expect(rateLimit('a', 1, 60_000).allowed).toBe(false);
    expect(rateLimit('b', 1, 60_000).allowed).toBe(true);
  });

  it('resets after the window elapses', () => {
    const key = 'k';
    expect(rateLimit(key, 1, 1).allowed).toBe(true); // 1ms window
    // next tick the window has passed
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(rateLimit(key, 1, 1).allowed).toBe(true);
        resolve();
      }, 5);
    });
  });
});
