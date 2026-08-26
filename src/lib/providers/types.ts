import type { ChatTurn, RetrievedChunk, Usage } from '@/lib/types';

/** Result of embedding a batch of texts. */
export interface EmbedResult {
  vectors: number[][];
  usage: Usage;
}

/** Structured input for grounded answer generation. */
export interface GenerateParams {
  question: string;
  history: ChatTurn[];
  /** Retrieved chunks, already ranked; index i is citation [i+1]. */
  context: RetrievedChunk[];
  temperature: number;
  maxTokens: number;
  signal?: AbortSignal;
}

/**
 * A provider is the only place that talks to an embedding/LLM backend.
 *
 * `generate` is an async generator: it yields answer text deltas and *returns*
 * the final Usage, so callers can stream tokens and still record cost/latency:
 *
 *   const gen = provider.generate(params);
 *   for (let r = await gen.next(); !r.done; r = await gen.next()) emit(r.value);
 *   const usage = (await gen.next()).value; // when done, value is Usage
 */
export interface Provider {
  readonly name: 'openai' | 'local';
  readonly embeddingDim: number;
  embed(texts: string[]): Promise<EmbedResult>;
  generate(params: GenerateParams): AsyncGenerator<string, Usage, void>;
}
