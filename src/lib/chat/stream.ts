import { getProvider } from '@/lib/providers';
import { getRegistry } from '@/lib/store/registry';
import { retrieve } from '@/lib/retrieval/retrieve';
import { postProcessAnswer } from '@/lib/rag/citations';
import { addSpend } from '@/lib/spend';
import { createLogger, type Logger } from '@/lib/logger';
import { AppError } from '@/lib/errors';
import type { ChatTurn } from '@/lib/types';
import type { ChatEvent } from './events';

export interface StreamParams {
  sessionId: string;
  question: string;
  documentIds?: string[];
  signal?: AbortSignal;
  log?: Logger;
}

/**
 * The end-to-end chat pipeline as an event stream: persist the question,
 * retrieve grounded context, stream the generated answer, verify citations,
 * record usage, and persist the assistant turn. Errors become a single `error`
 * event rather than throwing, so the SSE stream always closes cleanly.
 */
export async function* streamAnswer(
  params: StreamParams,
): AsyncGenerator<ChatEvent> {
  const log = params.log ?? createLogger();
  const registry = getRegistry();
  const provider = getProvider();
  const { sessionId, question, documentIds } = params;

  try {
    // Prior turns become conversation history; then persist the new question.
    const history: ChatTurn[] = registry
      .listMessages(sessionId)
      .map((m) => ({ role: m.role, content: m.content }));
    registry.addMessage({ sessionId, role: 'user', content: question });

    const t0 = Date.now();
    const context = await retrieve({ sessionId, query: question, documentIds });
    const retrievalMs = Date.now() - t0;
    log.info('chat.retrieved', {
      sessionId,
      chunks: context.length,
      retrievalMs,
    });

    if (context.length === 0) {
      const message =
        'No documents are loaded for this session yet. Upload a PDF or load the sample documents, then ask again.';
      yield { type: 'token', text: message };
      registry.addMessage({ sessionId, role: 'assistant', content: message });
      yield { type: 'done' };
      return;
    }

    const gen = provider.generate({
      question,
      history,
      context,
      temperature: 0,
      maxTokens: 800,
      signal: params.signal,
    });

    let answer = '';
    let step = await gen.next();
    while (!step.done) {
      answer += step.value;
      yield { type: 'token', text: step.value };
      step = await gen.next();
    }
    const usage = step.value;
    addSpend(usage.costUsd);

    const post = postProcessAnswer(answer, context);
    yield {
      type: 'citations',
      citations: post.citations,
      coverage: post.coverage,
    };
    yield { type: 'usage', usage, provider: provider.name, retrievalMs };

    registry.addMessage({
      sessionId,
      role: 'assistant',
      content: answer,
      citations: post.citations,
      retrieval: context.map((c) => ({
        id: c.id,
        vectorScore: c.vectorScore,
        ftsRank: c.ftsRank,
        fused: c.fused,
      })),
      usage,
    });

    log.info('chat.done', {
      sessionId,
      completionTokens: usage.completionTokens,
      costUsd: usage.costUsd,
      coverage: post.coverage,
      dangling: post.dangling.length,
    });
    yield { type: 'done' };
  } catch (e) {
    const code = e instanceof AppError ? e.code : 'chat_failed';
    const message =
      e instanceof AppError
        ? e.message
        : 'The model failed to answer. Please try again.';
    log.error('chat.error', { sessionId, code, message });
    yield { type: 'error', code, message };
  }
}
