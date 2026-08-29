import type { StoredChunk } from '@/lib/types';
import { keywords } from '@/lib/text';

/** Cosine similarity of two equal-length vectors, in [-1, 1]. */
export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * BM25 keyword scores for a query over a corpus of chunks.
 *
 * Standard Okapi BM25 (k1=1.5, b=0.75). This is the lexical half of hybrid
 * retrieval — it rewards exact term matches (ticker symbols, dollar figures)
 * that dense embeddings can miss. Returns a score per input chunk, aligned by
 * index; 0 means no query term appeared.
 */
export function bm25Scores(
  query: string,
  chunks: StoredChunk[],
  opts: { k1?: number; b?: number } = {},
): number[] {
  const k1 = opts.k1 ?? 1.5;
  const b = opts.b ?? 0.75;
  const qTerms = Array.from(new Set(keywords(query)));
  if (qTerms.length === 0 || chunks.length === 0) {
    return new Array(chunks.length).fill(0);
  }

  const docTokens = chunks.map((c) => keywords(c.content));
  const docLengths = docTokens.map((t) => t.length);
  const avgdl =
    docLengths.reduce((s, l) => s + l, 0) / (docLengths.length || 1) || 1;

  // Document frequency per query term.
  const df = new Map<string, number>();
  for (const term of qTerms) {
    let count = 0;
    for (const tokens of docTokens) if (tokens.includes(term)) count++;
    df.set(term, count);
  }

  const N = chunks.length;
  return docTokens.map((tokens, i) => {
    if (tokens.length === 0) return 0;
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    let score = 0;
    for (const term of qTerms) {
      const f = tf.get(term) ?? 0;
      if (f === 0) continue;
      const n = df.get(term) ?? 0;
      // BM25 idf with +1 smoothing (always non-negative).
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      const denom = f + k1 * (1 - b + (b * docLengths[i]!) / avgdl);
      score += idf * ((f * (k1 + 1)) / denom);
    }
    return score;
  });
}
