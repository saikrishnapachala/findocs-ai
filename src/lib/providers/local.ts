import type { Provider, EmbedResult, GenerateParams } from './types';
import type { Usage } from '@/lib/types';
import { keywords, splitSentences, tokenizeWords } from '@/lib/text';

/**
 * Keyless "local" provider. No network, no key, deterministic — this is what
 * powers the always-on public demo.
 *
 * Embeddings: signed feature-hashing of word tokens into a fixed-dim vector,
 * then L2-normalized. Cosine similarity between two such vectors approximates
 * shared-vocabulary similarity — crude but real, and enough to demonstrate the
 * retrieval pipeline end to end without an API key.
 *
 * Generation: extractive. We rank sentences from the retrieved context by
 * keyword overlap with the question and stitch the best ones together with
 * inline citations. If nothing overlaps, we refuse — exactly like the grounded
 * OpenAI path — so the "not in the documents" behaviour is demonstrable offline.
 */
export class LocalProvider implements Provider {
  readonly name = 'local' as const;
  readonly embeddingDim: number;

  constructor(embeddingDim = 1536) {
    this.embeddingDim = embeddingDim;
  }

  async embed(texts: string[]): Promise<EmbedResult> {
    const started = Date.now();
    const vectors = texts.map((t) => this.hashEmbed(t));
    return {
      vectors,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        costUsd: 0,
        latencyMs: Date.now() - started,
      },
    };
  }

  private hashEmbed(text: string): number[] {
    const dim = this.embeddingDim;
    const vec = new Array<number>(dim).fill(0);
    for (const tok of tokenizeWords(text)) {
      const h = fnv1a(tok);
      const idx = h % dim;
      const sign = (h & 1) === 0 ? 1 : -1;
      vec[idx] = (vec[idx] ?? 0) + sign;
    }
    // L2 normalize
    let norm = 0;
    for (const v of vec) norm += v * v;
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < dim; i++) vec[i] = vec[i]! / norm;
    return vec;
  }

  async *generate(params: GenerateParams): AsyncGenerator<string, Usage, void> {
    const started = Date.now();
    const answer = buildExtractiveAnswer(params);
    // Emit word-by-word so the UI streaming path is exercised offline too.
    const words = answer.split(/(\s+)/);
    for (const w of words) {
      if (params.signal?.aborted) break;
      yield w;
    }
    return {
      promptTokens: 0,
      completionTokens: 0,
      costUsd: 0,
      latencyMs: Date.now() - started,
    };
  }
}

/** Rank context sentences by question-keyword overlap and stitch top ones. */
function buildExtractiveAnswer(params: GenerateParams): string {
  const qKeys = new Set(keywords(params.question));
  if (qKeys.size === 0) {
    return 'Please ask a question about the uploaded documents.';
  }

  type Scored = { sentence: string; score: number; citation: number; distinct: number };
  const scored: Scored[] = [];
  params.context.forEach((chunk, i) => {
    for (const sentence of splitSentences(chunk.content)) {
      const sKeys = keywords(sentence);
      if (sKeys.length === 0) continue;
      const matched = new Set<string>();
      for (const k of sKeys) if (qKeys.has(k)) matched.add(k);
      if (matched.size === 0) continue;
      const score = matched.size / Math.sqrt(sKeys.length);
      scored.push({ sentence, score, citation: i + 1, distinct: matched.size });
    }
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 4).filter((s) => s.score > 0);

  // Refusal gate: require enough *distinct* query terms to co-occur in a single
  // sentence. Otherwise a lone common word ("annual") produces a confidently
  // wrong extract. Questions with >=2 content words must match >=2; single-word
  // questions must match their one word. (OpenAI mode refuses via the prompt.)
  const requiredDistinct = Math.min(2, qKeys.size);
  const bestDistinct = scored.reduce((m, s) => Math.max(m, s.distinct), 0);
  if (top.length === 0 || bestDistinct < requiredDistinct) {
    return (
      "I couldn't find that in the provided documents. Try rephrasing with " +
      'terms that appear in the source text (for example exact figures, ' +
      'section titles, or defined terms).'
    );
  }

  // Preserve document order for readability, then append citations.
  top.sort((a, b) => a.citation - b.citation);
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const s of top) {
    const key = s.sentence.slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    const withCite = /[.!?]$/.test(s.sentence)
      ? `${s.sentence} [${s.citation}]`
      : `${s.sentence}. [${s.citation}]`;
    lines.push(withCite);
  }
  const preface =
    'Based on the retrieved passages (extractive local-mode answer — set ' +
    'OPENAI_API_KEY for a synthesised response):\n\n';
  return preface + lines.join(' ');
}

/** FNV-1a 32-bit hash → non-negative integer. */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}
