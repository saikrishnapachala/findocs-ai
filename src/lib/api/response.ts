import { NextResponse } from 'next/server';
import { isAppError } from '@/lib/errors';
import { setSessionCookie } from '@/lib/session';

/** JSON success response, optionally (re)setting the session cookie. */
export function jsonOk<T>(
  data: T,
  opts: { status?: number; sessionId?: string } = {},
): NextResponse {
  const res = NextResponse.json(data, { status: opts.status ?? 200 });
  if (opts.sessionId) setSessionCookie(res, opts.sessionId);
  return res;
}

/** Uniform error envelope: { error: { code, message, request_id } }. */
export function jsonError(
  error: unknown,
  requestId: string,
  sessionId?: string,
): NextResponse {
  const code = isAppError(error) ? error.code : 'internal_error';
  const status = isAppError(error) ? error.status : 500;
  const message = isAppError(error)
    ? error.message
    : 'Something went wrong. Please try again.';
  const res = NextResponse.json(
    { error: { code, message, request_id: requestId } },
    { status },
  );
  if (sessionId) setSessionCookie(res, sessionId);
  return res;
}
