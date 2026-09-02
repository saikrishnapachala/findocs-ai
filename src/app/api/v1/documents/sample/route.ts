import type { NextRequest } from 'next/server';
import { ensureSessionId } from '@/lib/session';
import { jsonOk, jsonError } from '@/lib/api/response';
import { seedSampleDocuments } from '@/lib/seed/seed';
import { getRegistry } from '@/lib/store/registry';
import { createLogger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/documents/sample — load the built-in sample documents into this
 * session so the demo works with zero uploads. Awaited (the corpus is small) so
 * the caller can chat immediately.
 */
export async function POST(req: NextRequest) {
  const sessionId = ensureSessionId(req);
  const log = createLogger();
  try {
    const ids = await seedSampleDocuments(sessionId, log);
    const docs = getRegistry()
      .listDocuments(sessionId)
      .filter((d) => ids.includes(d.id))
      .map((d) => ({
        id: d.id,
        filename: d.filename,
        status: d.status,
        page_count: d.pageCount,
        chunk_count: d.chunksDone,
        is_sample: d.isSample,
      }));
    return jsonOk({ documents: docs }, { sessionId });
  } catch (e) {
    return jsonError(e, log.requestId, sessionId);
  }
}
