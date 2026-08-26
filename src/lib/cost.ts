/**
 * Token-cost estimation. Prices are USD per 1M tokens and are intentionally
 * kept in one place so the observability line and the daily spend cap agree.
 * Update these if OpenAI pricing changes; local mode is always $0.
 */

interface ModelPrice {
  inputPerM: number;
  outputPerM: number;
}

const CHAT_PRICES: Record<string, ModelPrice> = {
  'gpt-4o-mini': { inputPerM: 0.15, outputPerM: 0.6 },
  'gpt-4o': { inputPerM: 2.5, outputPerM: 10 },
};

// Embeddings are input-only.
const EMBED_PRICES: Record<string, number> = {
  'text-embedding-3-small': 0.02,
  'text-embedding-3-large': 0.13,
};

export function chatCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const p = CHAT_PRICES[model] ?? CHAT_PRICES['gpt-4o-mini']!;
  return (
    (promptTokens / 1_000_000) * p.inputPerM +
    (completionTokens / 1_000_000) * p.outputPerM
  );
}

export function embedCostUsd(model: string, tokens: number): number {
  const perM = EMBED_PRICES[model] ?? EMBED_PRICES['text-embedding-3-small']!;
  return (tokens / 1_000_000) * perM;
}
