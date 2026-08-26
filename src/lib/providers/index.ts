import { getConfig } from '@/lib/config';
import { isOverDailyCap } from '@/lib/spend';
import type { Provider } from './types';
import { OpenAiProvider } from './openai';
import { LocalProvider } from './local';

export type { Provider, GenerateParams, EmbedResult } from './types';

/**
 * Select the active provider for this request.
 *
 * OpenAI is used only when a key is configured AND the daily spend cap has not
 * been hit; otherwise we fall back to the keyless local provider so the demo
 * degrades gracefully instead of erroring or running up a bill.
 */
export function getProvider(): Provider {
  const cfg = getConfig();
  if (cfg.provider === 'openai' && cfg.hasOpenAiKey && !isOverDailyCap(cfg.maxDailyUsd)) {
    return new OpenAiProvider({
      apiKey: process.env.OPENAI_API_KEY!,
      chatModel: cfg.chatModel,
      embeddingModel: cfg.embeddingModel,
      embeddingDim: cfg.embeddingDim,
    });
  }
  return new LocalProvider(cfg.embeddingDim);
}

/** True when answers will come from the real model (not the local fallback). */
export function usingRealModel(): boolean {
  const cfg = getConfig();
  return (
    cfg.provider === 'openai' &&
    cfg.hasOpenAiKey &&
    !isOverDailyCap(cfg.maxDailyUsd)
  );
}
