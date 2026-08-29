import type { StoredChunk } from '@/lib/types';

export interface VectorHit {
  chunk: StoredChunk;
  /** Cosine similarity in [0, 1] (clamped). */
  score: number;
}

export interface KeywordHit {
  chunk: StoredChunk;
  /** Lexical relevance (BM25 or ts_rank); higher is better. */
  rank: number;
}

export interface SearchParams {
  sessionId: string;
  documentIds?: string[];
  k: number;
}

/**
 * A vector store scoped by session. Two implementations:
 *  - MemoryVectorStore (default): per-instance, powers the free demo + tests.
 *  - PgVectorStore: Postgres + pgvector, the documented production upgrade.
 *
 * Both return *ranked* lists; fusion (RRF) and diversification (MMR) happen one
 * layer up in `retrieval/` so that logic is store-agnostic and unit-tested.
 */
export interface VectorStore {
  addChunks(chunks: StoredChunk[]): Promise<void>;
  vectorSearch(
    params: SearchParams & { queryEmbedding: number[] },
  ): Promise<VectorHit[]>;
  keywordSearch(
    params: SearchParams & { queryText: string },
  ): Promise<KeywordHit[]>;
  deleteDocument(sessionId: string, documentId: string): Promise<void>;
  clearSession(sessionId: string): Promise<void>;
}
