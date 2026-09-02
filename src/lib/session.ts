import { randomUUID } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';

export const SESSION_COOKIE = 'findocs_sid';
const MAX_AGE_SECONDS = 60 * 60 * 24; // 24h, matches the purge window

export function getSessionId(req: NextRequest): string | null {
  return req.cookies.get(SESSION_COOKIE)?.value ?? null;
}

/** Existing session id from the cookie, or a fresh one. */
export function ensureSessionId(req: NextRequest): string {
  return getSessionId(req) ?? randomUUID();
}

export function setSessionCookie(res: NextResponse, sessionId: string): void {
  res.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === 'production',
  });
}
