import { after, type NextRequest } from 'next/server';
import { ensureSessionId } from '@/lib/session';
import { jsonOk, jsonError } from '@/lib/api/response';
import { getConfig } from '@/lib/config';
import { getRegistry, type DocumentRecord } from '@/lib/store/registry';
import { sha256 } from '@/lib/ingest/hash';
import { validatePdfBytes } from '@/lib/ingest/pdf';
import { ingestDocument } from '@/lib/ingest/service';
import { AppError } from '@/lib/errors';
import { createLogger } from '@/lib/logger';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { maybeSweep } from '@/lib/maintenance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toDto(d: DocumentRecord) {
  return {
    id: d.id,
    filename: d.filename,
    status: d.status,
    page_count: d.pageCount,
    chunk_count: d.chunksDone,
    chunks_total: d.chunksTotal,
    is_sample: d.isSample,
    error: d.error ?? null,
  };
}

/** GET /api/v1/documents — list the session's documents. */
export async function GET(req: NextRequest) {
  const sessionId = ensureSessionId(req);
  const docs = getRegistry().listDocuments(sessionId).map(toDto);
  return jsonOk(docs, { sessionId });
}

/** POST /api/v1/documents — upload a PDF (multipart `file`). Returns 202. */
export async function POST(req: NextRequest) {
  const sessionId = ensureSessionId(req);
  const log = createLogger();
  try {
    const cfg = getConfig();
    const rl = rateLimit(
      `upload:${clientIp(req)}`,
      cfg.rateLimitUploadPerHour,
      60 * 60 * 1000,
    );
    if (!rl.allowed) {
      throw new AppError(
        'rate_limited',
        `Upload limit reached. Please wait ${rl.retryAfterSec}s.`,
        429,
      );
    }
    void maybeSweep();

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      throw new AppError('no_file', 'Expected a `file` field in the upload.');
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    validatePdfBytes(bytes, { maxBytes: cfg.maxUploadBytes });

    const registry = getRegistry();
    const digest = sha256(bytes);
    const existing = registry.findByHash(sessionId, digest);
    if (existing) {
      // Idempotent: re-uploading the same content is a no-op.
      return jsonOk(toDto(existing), { status: 200, sessionId });
    }

    const filename = file.name || 'document.pdf';
    const doc = registry.createDocument({ sessionId, filename, sha256: digest });

    // Ingest after the response is sent (same instance keeps the in-memory
    // registry warm for status polling). Documented serverless caveat applies.
    after(async () => {
      await ingestDocument({
        sessionId,
        documentId: doc.id,
        filename,
        bytes,
        log,
      });
    });

    return jsonOk(toDto(doc), { status: 202, sessionId });
  } catch (e) {
    return jsonError(e, log.requestId, sessionId);
  }
}
