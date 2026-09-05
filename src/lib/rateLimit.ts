import type { NextRequest } from 'next/server';

/**
 * Fixed-window, in-memory rate limiter. Protects the public demo from abuse
 * and runaway cost. Per serverless instance (documented limitation; a
 * production build would use Upstash/Redis with an atomic INCR + TTL).
 */
interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

export interface RateResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  existing.count += 1;
  const allowed = existing.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSec: allowed ? 0 : Math.ceil((existing.resetAt - now) / 1000),
  };
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

/** Test-only reset. */
export function __resetRateLimit(): void {
  windows.clear();
}
