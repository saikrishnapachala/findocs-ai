/**
 * Reciprocal Rank Fusion.
 *
 * Combines several ranked id lists into one score per id: for each list, an id
 * at 1-based rank r contributes 1/(k + r). Rank-based (not score-based) fusion
 * means we can blend dense cosine scores with lexical BM25 ranks without having
 * to calibrate their very different scales. k=60 is the value from the original
 * Cormack et al. paper and is a good default.
 */
export function reciprocalRankFusion(
  lists: string[][],
  k = 60,
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((id, index) => {
      const rank = index + 1;
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank));
    });
  }
  return scores;
}
