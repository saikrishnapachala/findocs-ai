import type { Citation, Usage } from '@/lib/types';

/**
 * Server-sent events for the chat stream (PRD F3.3). Each is serialized as a
 * single SSE `data:` line carrying a JSON object with a `type` discriminator.
 */
export type ChatEvent =
  | { type: 'token'; text: string }
  | { type: 'citations'; citations: Citation[]; coverage: number }
  | { type: 'usage'; usage: Usage; provider: string; retrievalMs: number }
  | { type: 'done' }
  | { type: 'error'; code: string; message: string };

const encoder = new TextEncoder();

/** Encode an event as an SSE frame. */
export function encodeSSE(event: ChatEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}
