import { createHash } from 'node:crypto';
import { getRegistry } from '@/lib/store/registry';
import { ingestPages } from '@/lib/ingest/service';
import { createLogger, type Logger } from '@/lib/logger';
import { SAMPLE_DOCS } from './samples';

/**
 * Load the built-in sample documents into a session so the demo works with zero
 * uploads. Idempotent: a sample already present (by content hash) is skipped.
 * Returns the ids of the documents now available in the session.
 */
export async function seedSampleDocuments(
  sessionId: string,
  log: Logger = createLogger(),
): Promise<string[]> {
  const registry = getRegistry();
  const ids: string[] = [];

  for (const sample of SAMPLE_DOCS) {
    const text = sample.pages.map((p) => p.text).join('\n');
    const sha256 = createHash('sha256').update(text).digest('hex');

    const existing = registry.findByHash(sessionId, sha256);
    if (existing) {
      ids.push(existing.id);
      continue;
    }

    const doc = registry.createDocument({
      sessionId,
      filename: sample.filename,
      sha256,
      isSample: true,
    });
    registry.updateDocument(sessionId, doc.id, {
      pageCount: sample.pages.length,
    });

    try {
      await ingestPages({
        sessionId,
        documentId: doc.id,
        filename: sample.filename,
        pages: sample.pages,
        log,
      });
      ids.push(doc.id);
    } catch (e) {
      registry.updateDocument(sessionId, doc.id, {
        status: 'failed',
        error: e instanceof Error ? e.message : 'seed failed',
      });
    }
  }

  return ids;
}
