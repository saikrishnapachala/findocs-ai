import { getConfig } from '@/lib/config';
import type { VectorStore } from './vector';
import { MemoryVectorStore } from './memoryVector';
import { PgVectorStore } from './pgVector';

export type { VectorStore, VectorHit, KeywordHit } from './vector';

// Persist across dev hot-reloads (and across requests in one serverless
// instance) by stashing the singleton on globalThis.
const globalForStore = globalThis as unknown as {
  __findocsVectorStore?: VectorStore;
};

export function getVectorStore(): VectorStore {
  if (globalForStore.__findocsVectorStore) {
    return globalForStore.__findocsVectorStore;
  }
  const cfg = getConfig();
  const store: VectorStore =
    cfg.vectorStore === 'pgvector' && cfg.databaseUrl
      ? new PgVectorStore(cfg.databaseUrl, cfg.embeddingDim)
      : new MemoryVectorStore();
  globalForStore.__findocsVectorStore = store;
  return store;
}
