import { NextResponse, type NextRequest } from 'next/server';
import { ensureSessionId, setSessionCookie } from '@/lib/session';
import { jsonOk } from '@/lib/api/response';
import { getRegistry } from '@/lib/store/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/messages — conversation history for the session. */
export async function GET(req: NextRequest) {
  const sessionId = ensureSessionId(req);
  const messages = getRegistry()
    .listMessages(sessionId)
    .map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      citations: m.citations ?? [],
      usage: m.usage ?? null,
      created_at: m.createdAt,
    }));
  return jsonOk({ messages }, { sessionId });
}

/** DELETE /api/v1/messages — clear the session's chat history. */
export async function DELETE(req: NextRequest) {
  const sessionId = ensureSessionId(req);
  getRegistry().clearMessages(sessionId);
  const res = new NextResponse(null, { status: 204 });
  setSessionCookie(res, sessionId);
  return res;
}
