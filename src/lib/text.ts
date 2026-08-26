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
 * Split text into sentences. Deliberately simple: split on sentence-ending
 * punctuation followed by whitespace, keeping the terminator. Good enough for
 * chunk-boundary snapping and extractive answers; not a full NLP sentence
 * segmenter (documented limitation).
 */
export function splitSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const parts = normalized.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g);
  return (parts ?? [normalized]).map((s) => s.trim()).filter(Boolean);
}
