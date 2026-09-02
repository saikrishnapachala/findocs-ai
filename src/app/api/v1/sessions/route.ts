import type { NextRequest } from 'next/server';
import { ensureSessionId } from '@/lib/session';
import { jsonOk } from '@/lib/api/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Create (or reuse) an anonymous session; sets the session cookie. */
export async function POST(req: NextRequest) {
  const sessionId = ensureSessionId(req);
  return jsonOk({ session_id: sessionId }, { sessionId });
}
