/** Small, dependency-free text utilities shared across RAG modules. */

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'with',
  'is', 'are', 'was', 'were', 'be', 'been', 'as', 'at', 'by', 'it', 'its',
  'this', 'that', 'these', 'those', 'from', 'we', 'our', 'us', 'you', 'your',
  'i', 'he', 'she', 'they', 'them', 'his', 'her', 'their', 'what', 'which',
  'who', 'whom', 'how', 'when', 'where', 'why', 'do', 'does', 'did', 'has',
  'have', 'had', 'not', 'no', 'if', 'than', 'then', 'so', 'such', 'can',
  'will', 'would', 'should', 'could', 'may', 'might', 'about',
]);

/** Lowercased alphanumeric word tokens (keeps digits, useful for figures). */
export function tokenizeWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9._-]*/g) ?? []).filter(
    (w) => w.length > 1,
  );
}

/** Content words for keyword overlap: tokens minus stopwords. */
export function keywords(text: string): string[] {
  return tokenizeWords(text).filter((w) => !STOPWORDS.has(w));
}

/**
 * Split text into sentences.
 *
 * Splits at whitespace that follows a sentence terminator (.!?) and precedes a
 * new-sentence starter (capital letter, digit, or opening quote/paren). Using
 * `split` — not `match` — guarantees no characters are ever dropped, and the
 * boundary conditions avoid breaking on decimals ("$1,250.4"), abbreviations
 * ("U.S. dollar"), and mid-number periods. This is a heuristic, not a full NLP
 * segmenter (documented limitation), but it is loss-free.
 */
export function splitSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const parts = normalized.split(/(?<=[.!?])\s+(?=["'(\[]?[A-Z0-9])/);
  return parts.map((s) => s.trim()).filter(Boolean);
}
