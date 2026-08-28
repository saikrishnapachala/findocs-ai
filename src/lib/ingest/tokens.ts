import { encode } from 'gpt-tokenizer';

/**
 * Token count via gpt-tokenizer (cl100k). Used for chunk sizing and the
 * observability token estimates. Exact model encodings differ slightly, but
 * for sizing decisions this is close enough and dependency-light.
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  return encode(text).length;
}
