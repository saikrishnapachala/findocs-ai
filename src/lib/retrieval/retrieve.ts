import { getConfig } from '@/lib/config';
import { getProvider, type Provider } from '@/lib/providers';
import { getVectorStore, type VectorStore } from '@/lib/store';
import type { RetrievedChunk, StoredChunk } from '@/lib/types';
import { reciprocalRankFusion } from './rrf';
import { maximalMarginalRelevance } from './mmr';

export interface RetrieveParams {
  sessionId: string;
  query: string;
  documentIds?: string[];
  /** Final number of passages to return (default from config, k=8). */
  k?: number;
  /** Override hybrid/MMR flags (default from config); handy for A/B + evals. */
  hybrid?: boolean;
  mmr?: boolean;
}

interface Candidate {
  chunk: StoredChunk;
  vectorScore: number | null;
  ftsRank: number | null;
}

/**
 * The retrieval pipeline: embed the query, pull vector + lexical candidates,
 * fuse them with RRF, optionally diversify with MMR, and return the top-k as
 * RetrievedChunk (carrying the scores that surfaced each one, for eval + UI).
 */
export async function retrieve(
  params: RetrieveParams,
  deps: { provider?: Provider; store?: VectorStore } = {},
): Promise<RetrievedChunk[]> {
  const cfg = getConfig();
  const provider = deps.provider ?? getProvider();
  const store = deps.store ?? getVectorStore();

  const k = params.k ?? cfg.retrievalK;
  const hybrid = params.hybrid ?? cfg.hybridRetrieval;
  const useMmr = params.mmr ?? cfg.mmrEnabled;
  // Pull a wider candidate pool than k so fusion/MMR have material to work with.
  const pool = Math.min(50, Math.max(k * 3, 16));

  const { vectors } = await provider.embed([params.query]);
  const queryEmbedding = vectors[0] ?? [];

  const [vectorHits, keywordHits] = await Promise.all([
    store.vectorSearch({
      sessionId: params.sessionId,
      documentIds: params.documentIds,
      queryEmbedding,
      k: pool,
    }),
    hybrid
      ? store.keywordSearch({
          sessionId: params.sessionId,
          documentIds: params.documentIds,
          queryText: params.query,
          k: pool,
        })
      : Promise.resolve([]),
  ]);

  // Assemble a candidate map keyed by chunk id, remembering per-source scores.
  const candidates = new Map<string, Candidate>();
  for (const hit of vectorHits) {
    candidates.set(hit.chunk.id, {
      chunk: hit.chunk,
      vectorScore: hit.score,
      ftsRank: null,
    });
  }
  for (const hit of keywordHits) {
    const existing = candidates.get(hit.chunk.id);
    if (existing) existing.ftsRank = hit.rank;
    else
      candidates.set(hit.chunk.id, {
        chunk: hit.chunk,
        vectorScore: null,
        ftsRank: hit.rank,
      });
  }

  const fused = reciprocalRankFusion([
    vectorHits.map((h) => h.chunk.id),
    keywordHits.map((h) => h.chunk.id),
  ]);

  // Rank candidates by fused score.
  const ranked = Array.from(candidates.values()).sort(
    (a, b) => (fused.get(b.chunk.id) ?? 0) - (fused.get(a.chunk.id) ?? 0),
  );

  let selectedIds: string[];
  if (useMmr && ranked.length > k) {
    selectedIds = maximalMarginalRelevance({
      candidates: ranked.map((c) => ({
        id: c.chunk.id,
        embedding: c.chunk.embedding,
        relevance: fused.get(c.chunk.id) ?? 0,
      })),
      k,
    });
  } else {
    selectedIds = ranked.slice(0, k).map((c) => c.chunk.id);
  }

  return selectedIds
    .map((id) => candidates.get(id))
    .filter((c): c is Candidate => Boolean(c))
    .map((c) => ({
      id: c.chunk.id,
      documentId: c.chunk.documentId,
      documentName: c.chunk.documentName,
      pageStart: c.chunk.pageStart,
      pageEnd: c.chunk.pageEnd,
      content: c.chunk.content,
      vectorScore: c.vectorScore,
      ftsRank: c.ftsRank,
      fused: fused.get(c.chunk.id) ?? 0,
    }));
}
