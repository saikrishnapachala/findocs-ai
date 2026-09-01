import OpenAI from 'openai';
import type { Provider, EmbedResult, GenerateParams } from './types';
import type { Usage } from '@/lib/types';
import { chatCostUsd, embedCostUsd } from '@/lib/cost';
import { buildMessages } from '@/lib/rag/prompt';

/**
 * Real provider backed by the OpenAI API. Embeddings via
 * `text-embedding-3-small`; grounded, streamed answers via a chat model at
 * temperature 0. The grounded prompt is built by `src/lib/rag/prompt.ts`.
 */
export class OpenAiProvider implements Provider {
  readonly name = 'openai' as const;
  readonly embeddingDim: number;
  private client: OpenAI;
  private chatModel: string;
  private embeddingModel: string;

  constructor(opts: {
    apiKey: string;
    chatModel: string;
    embeddingModel: string;
    embeddingDim: number;
  }) {
    this.client = new OpenAI({ apiKey: opts.apiKey });
    this.chatModel = opts.chatModel;
    this.embeddingModel = opts.embeddingModel;
    this.embeddingDim = opts.embeddingDim;
  }

  async embed(texts: string[]): Promise<EmbedResult> {
    const started = Date.now();
    const res = await this.client.embeddings.create({
      model: this.embeddingModel,
      input: texts,
    });
    const vectors = res.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding as number[]);
    const tokens = res.usage?.total_tokens ?? 0;
    return {
      vectors,
      usage: {
        promptTokens: tokens,
        completionTokens: 0,
        costUsd: embedCostUsd(this.embeddingModel, tokens),
        latencyMs: Date.now() - started,
      },
    };
  }

  async *generate(params: GenerateParams): AsyncGenerator<string, Usage, void> {
    const started = Date.now();
    const messages = buildMessages({
      question: params.question,
      history: params.history,
      context: params.context,
    });

    const stream = await this.client.chat.completions.create(
      {
        model: this.chatModel,
        messages,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        stream: true,
        stream_options: { include_usage: true },
      },
      { signal: params.signal },
    );

    let promptTokens = 0;
    let completionTokens = 0;
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
      if (chunk.usage) {
        promptTokens = chunk.usage.prompt_tokens ?? promptTokens;
        completionTokens = chunk.usage.completion_tokens ?? completionTokens;
      }
    }

    return {
      promptTokens,
      completionTokens,
      costUsd: chatCostUsd(this.chatModel, promptTokens, completionTokens),
      latencyMs: Date.now() - started,
    };
  }
}

