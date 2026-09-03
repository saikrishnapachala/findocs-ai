'use client';

import type { Citation, DocumentStatus, Usage } from '@/lib/types';

export interface DocumentDto {
  id: string;
  filename: string;
  status: DocumentStatus;
  page_count: number;
  chunk_count: number;
  chunks_total?: number;
  is_sample: boolean;
  error?: string | null;
}

export interface StatusDto {
  status: DocumentStatus;
  progress: { pages: number; chunks_done: number; chunks_total: number };
  error: string | null;
}

export interface MessageDto {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  usage: Usage | null;
  created_at: number;
}

async function req<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { ...init, credentials: 'same-origin' });
  if (!res.ok) {
    let message = `Request failed (${res.status}).`;
    try {
      const body = await res.json();
      message = body?.error?.message ?? message;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  ensureSession: () => req<{ session_id: string }>('/api/v1/sessions', { method: 'POST' }),
  listDocuments: () => req<DocumentDto[]>('/api/v1/documents'),
  loadSamples: () =>
    req<{ documents: DocumentDto[] }>('/api/v1/documents/sample', { method: 'POST' }),
  uploadDocument: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return req<DocumentDto>('/api/v1/documents', { method: 'POST', body: form });
  },
  getStatus: (id: string) => req<StatusDto>(`/api/v1/documents/${id}/status`),
  deleteDocument: (id: string) =>
    req<void>(`/api/v1/documents/${id}`, { method: 'DELETE' }),
  getMessages: () => req<{ messages: MessageDto[] }>('/api/v1/messages'),
  clearMessages: () => req<void>('/api/v1/messages', { method: 'DELETE' }),
};

export type ChatStreamHandlers = {
  onToken: (text: string) => void;
  onCitations: (citations: Citation[], coverage: number) => void;
  onUsage?: (usage: Usage, provider: string, retrievalMs: number) => void;
  onError: (message: string) => void;
  onDone: () => void;
};

/**
 * POST the question and parse the SSE response body. Uses fetch (not
 * EventSource, which cannot POST) and a manual frame parser so the caller can
 * abort mid-stream via the provided signal (the "Stop generating" button).
 */
export async function streamChat(
  question: string,
  documentIds: string[] | undefined,
  signal: AbortSignal,
  handlers: ChatStreamHandlers,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch('/api/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ question, document_ids: documentIds }),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
    handlers.onError('Could not reach the server.');
    return;
  }

  if (!res.ok || !res.body) {
    handlers.onError(`The server returned an error (${res.status}).`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const line = frame.split('\n').find((l) => l.startsWith('data:'));
        if (!line) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        dispatch(payload, handlers);
      }
    }
    handlers.onDone();
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
    handlers.onError('The stream was interrupted.');
  }
}

function dispatch(payload: string, handlers: ChatStreamHandlers) {
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(payload);
  } catch {
    return;
  }
  switch (event.type) {
    case 'token':
      handlers.onToken(String(event.text ?? ''));
      break;
    case 'citations':
      handlers.onCitations(
        (event.citations as Citation[]) ?? [],
        Number(event.coverage ?? 0),
      );
      break;
    case 'usage':
      handlers.onUsage?.(
        event.usage as Usage,
        String(event.provider ?? ''),
        Number(event.retrievalMs ?? 0),
      );
      break;
    case 'error':
      handlers.onError(String(event.message ?? 'Something went wrong.'));
      break;
    default:
      break;
  }
}
