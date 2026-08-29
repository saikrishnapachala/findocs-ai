import type { StoredChunk } from '@/lib/types';
import type {
  VectorStore,
  VectorHit,
  KeywordHit,
  SearchParams,
} from './vector';
import { cosineSimilarity, bm25Scores } from './scoring';

/**
 * In-memory vector store: a Map of sessionId -> chunks. Similarity and BM25 are
 * computed in-process. Fine for a demo (a session holds a handful of docs);
 * documented limitation is that it does not persist across serverless instances
 * or restarts — that is what the pgvector store is for.
 */
export class MemoryVectorStore implements VectorStore {
  private bySession = new Map<string, StoredChunk[]>();

  async addChunks(chunks: StoredChunk[]): Promise<void> {
    for (const chunk of chunks) {
      const list = this.bySession.get(chunk.sessionId) ?? [];
      list.push(chunk);
      this.bySession.set(chunk.sessionId, list);
    }
  }

  private scoped(params: SearchParams): StoredChunk[] {
    const all = this.bySession.get(params.sessionId) ?? [];
    if (!params.documentIds || params.documentIds.length === 0) return all;
    const set = new Set(params.documentIds);
    return all.filter((c) => set.has(c.documentId));
  }

  async vectorSearch(
    params: SearchParams & { queryEmbedding: number[] },
  ): Promise<VectorHit[]> {
    const chunks = this.scoped(params);
    const hits = chunks.map((chunk) => ({
      chunk,
      score: clamp01(cosineSimilarity(params.queryEmbedding, chunk.embedding)),
    }));
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, params.k);
  }

  async keywordSearch(
    params: SearchParams & { queryText: string },
  ): Promise<KeywordHit[]> {
    const chunks = this.scoped(params);
    const scores = bm25Scores(params.queryText, chunks);
    const hits: KeywordHit[] = chunks
      .map((chunk, i) => ({ chunk, rank: scores[i] ?? 0 }))
      .filter((h) => h.rank > 0);
    hits.sort((a, b) => b.rank - a.rank);
    return hits.slice(0, params.k);
  }

  async deleteDocument(sessionId: string, documentId: string): Promise<void> {
    const list = this.bySession.get(sessionId);
    if (!list) return;
    this.bySession.set(
      sessionId,
      list.filter((c) => c.documentId !== documentId),
    );
  }

  async clearSession(sessionId: string): Promise<void> {
    this.bySession.delete(sessionId);
  }
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
