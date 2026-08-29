import { getConfig } from '@/lib/config';
import { getProvider } from '@/lib/providers';
import { getVectorStore } from '@/lib/store';
import { getRegistry } from '@/lib/store/registry';
import { addSpend } from '@/lib/spend';
import { AppError } from '@/lib/errors';
import { createLogger, type Logger } from '@/lib/logger';
import type { StoredChunk } from '@/lib/types';
import { extractPdf } from './pdf';
import { chunkPages } from './chunker';

const EMBED_BATCH = 100;

/**
 * Full ingestion pipeline for one document: parse -> chunk -> embed -> store,
 * updating the document's status/progress at each stage so the UI can show it.
 * Intended to be launched as a background task after the upload handler returns
 * 202. Errors are captured onto the document record, never thrown to the caller.
 */
export async function ingestDocument(input: {
  sessionId: string;
  documentId: string;
  filename: string;
  bytes: Uint8Array;
  log?: Logger;
}): Promise<void> {
  const cfg = getConfig();
  const registry = getRegistry();
  const store = getVectorStore();
  const provider = getProvider();
  const log = input.log ?? createLogger();
  const { sessionId, documentId, filename } = input;

  const update = (patch: Parameters<typeof registry.updateDocument>[2]) =>
    registry.updateDocument(sessionId, documentId, patch);

  try {
    update({ status: 'parsing' });
    const { pageCount, pages, looksScanned } = await extractPdf(input.bytes, {
      maxPages: cfg.maxPdfPages,
    });
    update({ pageCount });
    if (looksScanned) {
      throw new AppError(
        'scanned_pdf',
        'This PDF looks scanned (little extractable text). OCR is not supported yet.',
        422,
      );
    }

    update({ status: 'chunking' });
    const chunks = chunkPages(documentId, pages, {
      targetTokens: cfg.chunkTokens,
      overlapRatio: cfg.chunkOverlap,
    });
    update({ chunksTotal: chunks.length, chunksDone: 0 });
    if (chunks.length === 0) {
      throw new AppError('empty_document', 'No text could be extracted.', 422);
    }

    update({ status: 'embedding' });
    const stored: StoredChunk[] = [];
    for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
      const batch = chunks.slice(i, i + EMBED_BATCH);
      const { vectors, usage } = await withRetry(
        () => provider.embed(batch.map((c) => c.content)),
        log,
      );
      addSpend(usage.costUsd);
      batch.forEach((chunk, j) => {
        stored.push({
          ...chunk,
          sessionId,
          documentName: filename,
          embedding: vectors[j] ?? [],
        });
      });
      update({ chunksDone: stored.length });
    }

    await store.addChunks(stored);
    update({ status: 'ready', chunksDone: stored.length });
    log.info('ingest.ready', {
      documentId,
      pageCount,
      chunks: stored.length,
      provider: provider.name,
    });
  } catch (e) {
    const message =
      e instanceof AppError ? e.message : 'Ingestion failed unexpectedly.';
    update({ status: 'failed', error: message });
    log.error('ingest.failed', { documentId, error: message });
  }
}

/** Retry with exponential backoff on transient errors (429/5xx). */
async function withRetry<T>(
  fn: () => Promise<T>,
  log: Logger,
  attempts = 4,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const status = (e as { status?: number }).status;
      const retryable = status === 429 || (status !== undefined && status >= 500);
      if (!retryable || attempt === attempts - 1) throw e;
      const delayMs = 500 * 2 ** attempt + Math.random() * 250;
      log.warn('ingest.embed_retry', { attempt, status, delayMs });
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}
