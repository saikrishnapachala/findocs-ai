import { cosineSimilarity } from '@/lib/store/scoring';

export interface MmrCandidate {
  id: string;
  embedding: number[];
  /** Relevance to the query (any scale; normalized internally). */
  relevance: number;
}

/**
 * Maximal Marginal Relevance selection.
 *
 * Greedily picks items that are relevant to the query but not redundant with
 * already-picked items: score = λ·relevance − (1−λ)·maxSimToSelected. This
 * stops all k passages coming from the same page/paragraph. Relevance is
 * min-max normalized so it shares the [0,1] scale of cosine similarity.
 *
 * Returns selected ids in selection order.
 */
export function maximalMarginalRelevance(params: {
  candidates: MmrCandidate[];
  k: number;
  lambda?: number;
}): string[] {
  const { candidates, k } = params;
  const lambda = params.lambda ?? 0.6;
  if (candidates.length <= k) {
    return [...candidates]
      .sort((a, b) => b.relevance - a.relevance)
      .map((c) => c.id);
  }

  const rels = candidates.map((c) => c.relevance);
  const min = Math.min(...rels);
  const max = Math.max(...rels);
  const norm = (r: number) => (max === min ? 1 : (r - min) / (max - min));

  const selected: MmrCandidate[] = [];
  const remaining = [...candidates];

  while (selected.length < k && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i]!;
      let maxSim = 0;
      for (const s of selected) {
        const sim = cosineSimilarity(cand.embedding, s.embedding);
        if (sim > maxSim) maxSim = sim;
      }
      const score = lambda * norm(cand.relevance) - (1 - lambda) * maxSim;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    selected.push(remaining.splice(bestIdx, 1)[0]!);
  }

  return selected.map((c) => c.id);
}
