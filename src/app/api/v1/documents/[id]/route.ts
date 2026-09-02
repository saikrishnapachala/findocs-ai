import type { NextRequest } from 'next/server';
import { ensureSessionId } from '@/lib/session';
import { jsonError } from '@/lib/api/response';
import { setSessionCookie } from '@/lib/session';
import { NextResponse } from 'next/server';
import { getRegistry } from '@/lib/store/registry';
import { getVectorStore } from '@/lib/store';
import { AppError } from '@/lib/errors';
import { createLogger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** DELETE /api/v1/documents/:id — remove a document and its chunks. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionId = ensureSessionId(req);
  const log = createLogger();
  try {
    const { id } = await params;
    const registry = getRegistry();
    const doc = registry.getDocument(sessionId, id);
    if (!doc) throw new AppError('not_found', 'Document not found.', 404);

    await getVectorStore().deleteDocument(sessionId, id);
    registry.deleteDocument(sessionId, id);

    const res = new NextResponse(null, { status: 204 });
    setSessionCookie(res, sessionId);
    return res;
  } catch (e) {
    return jsonError(e, log.requestId, sessionId);
  }
}
