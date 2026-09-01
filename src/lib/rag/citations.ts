import type { Citation, RetrievedChunk } from '@/lib/types';
import { splitSentences } from '@/lib/text';

export interface PostProcessResult {
  /** Distinct, valid citations referenced by the answer, in ascending order. */
  citations: Citation[];
  /** Fraction of sentences that carry at least one valid citation, 0..1. */
  coverage: number;
  /** Citation numbers used in the answer that do NOT map to a passage. */
  dangling: number[];
}

const CITATION_RE = /\[(\d+)\]/g;

/**
 * Verify the citations in a generated answer against the retrieved context.
 *
 * A citation [n] is valid iff 1 <= n <= context.length. We build the mapping
 * for every distinct valid n actually used, report dangling numbers (so the UI
 * can render them as plain text rather than broken links), and compute citation
 * coverage — our headline "how grounded is this answer" metric (F3.4).
 */
export function postProcessAnswer(
  answer: string,
  context: RetrievedChunk[],
): PostProcessResult {
  const usedValid = new Set<number>();
  const dangling = new Set<number>();

  for (const match of answer.matchAll(CITATION_RE)) {
    const n = Number(match[1]);
    if (n >= 1 && n <= context.length) usedValid.add(n);
    else dangling.add(n);
  }

  const citations: Citation[] = Array.from(usedValid)
    .sort((a, b) => a - b)
    .map((n) => {
      const chunk = context[n - 1]!;
      return {
        n,
        chunkId: chunk.id,
        documentId: chunk.documentId,
        documentName: chunk.documentName,
        pageStart: chunk.pageStart,
        pageEnd: chunk.pageEnd,
      };
    });

  return {
    citations,
    coverage: citationCoverage(answer, context.length),
    dangling: Array.from(dangling).sort((a, b) => a - b),
  };
}

/** Fraction of sentences containing at least one valid [n]. */
export function citationCoverage(answer: string, contextLength: number): number {
  const sentences = splitSentences(answer);
  if (sentences.length === 0) return 0;
  let cited = 0;
  for (const sentence of sentences) {
    let hasValid = false;
    for (const match of sentence.matchAll(CITATION_RE)) {
      const n = Number(match[1]);
      if (n >= 1 && n <= contextLength) {
        hasValid = true;
        break;
      }
    }
    if (hasValid) cited++;
  }
  return cited / sentences.length;
}

/** Remove dangling [n] markers (n outside 1..contextLength) from the text. */
export function stripDangling(answer: string, contextLength: number): string {
  return answer
    .replace(CITATION_RE, (full, num) => {
      const n = Number(num);
      return n >= 1 && n <= contextLength ? full : '';
    })
    .replace(/ {2,}/g, ' ')
    .replace(/ +([.,;:])/g, '$1');
}
