import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ensureSessionId, setSessionCookie } from '@/lib/session';
import { jsonError } from '@/lib/api/response';
import { NextResponse } from 'next/server';
import { streamAnswer } from '@/lib/chat/stream';
import { encodeSSE } from '@/lib/chat/events';
import { AppError } from '@/lib/errors';
import { createLogger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  question: z.string().trim().min(1, 'Question is required.').max(2000),
  document_ids: z.array(z.string()).optional(),
});

/**
 * POST /api/v1/chat — Server-Sent Events stream of the grounded answer.
 * The upstream generation is cancelled if the client disconnects (AbortSignal).
 */
export async function POST(req: NextRequest) {
  const sessionId = ensureSessionId(req);
  const log = createLogger();

  let question: string;
  let documentIds: string[] | undefined;
  try {
    const parsed = bodySchema.parse(await req.json());
    question = parsed.question;
    documentIds = parsed.document_ids;
  } catch (e) {
    const err =
      e instanceof z.ZodError
        ? new AppError('invalid_request', e.issues[0]?.message ?? 'Invalid request.')
        : e;
    return jsonError(err, log.requestId, sessionId);
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of streamAnswer({
          sessionId,
          question,
          documentIds,
          signal: req.signal,
          log,
        })) {
          controller.enqueue(encodeSSE(event));
        }
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Stream failed unexpectedly.';
        controller.enqueue(
          encodeSSE({ type: 'error', code: 'stream_failed', message }),
        );
      } finally {
        controller.close();
      }
    },
  });

  const res = new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
  setSessionCookie(res, sessionId);
  return res;
}
