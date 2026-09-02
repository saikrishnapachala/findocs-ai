import type { NextRequest } from 'next/server';
import { ensureSessionId } from '@/lib/session';
import { jsonOk, jsonError } from '@/lib/api/response';
import { getRegistry } from '@/lib/store/registry';
import { AppError } from '@/lib/errors';
import { createLogger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/documents/:id/status — ingestion progress for polling. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionId = ensureSessionId(req);
  const log = createLogger();
  try {
    const { id } = await params;
    const doc = getRegistry().getDocument(sessionId, id);
    if (!doc) throw new AppError('not_found', 'Document not found.', 404);
    return jsonOk(
      {
        status: doc.status,
        progress: {
          pages: doc.pageCount,
          chunks_done: doc.chunksDone,
          chunks_total: doc.chunksTotal,
        },
        error: doc.error ?? null,
      },
      { sessionId },
    );
  } catch (e) {
    return jsonError(e, log.requestId, sessionId);
  }
}
