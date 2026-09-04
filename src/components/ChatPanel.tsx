'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import type { Citation } from '@/lib/types';
import type { ChatMessage } from './types';
import { MessageView } from './MessageView';
import { SendIcon, StopIcon } from './icons';

export function ChatPanel({
  messages,
  isStreaming,
  docsReady,
  providerLabel,
  sampleQuestions,
  onSend,
  onStop,
  onOpenSource,
}: {
  messages: ChatMessage[];
  isStreaming: boolean;
  docsReady: boolean;
  providerLabel: string;
  sampleQuestions: string[];
  onSend: (q: string) => void;
  onStop: () => void;
  onOpenSource: (c: Citation) => void;
}) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  // Auto-scroll on new content, but pause if the user has scrolled up.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const q = input.trim();
    if (!q || isStreaming) return;
    stickRef.current = true;
    onSend(q);
    setInput('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const empty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div>
          <h1 className="text-sm font-semibold">FinDocs AI</h1>
          <p className="text-[0.7rem] text-muted">
            Grounded answers with inline citations
          </p>
        </div>
        <span
          className="rounded-full border border-border px-2 py-0.5 text-[0.7rem] text-muted"
          title="Active model / provider"
        >
          {providerLabel}
        </span>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 space-y-3 overflow-y-auto p-4"
        aria-live="polite"
        aria-busy={isStreaming}
      >
        {empty ? (
          <EmptyState docsReady={docsReady} />
        ) : (
          messages.map((m) => (
            <MessageView key={m.id} message={m} onOpenSource={onOpenSource} />
          ))
        )}
      </div>

      {empty && docsReady && sampleQuestions.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {sampleQuestions.map((q) => (
            <button
              key={q}
              onClick={() => onSend(q)}
              className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-fg hover:border-accent hover:text-accent"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-surface p-2 focus-within:border-accent">
          <label htmlFor="composer" className="sr-only">
            Ask a question about your documents
          </label>
          <textarea
            id="composer"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={
              docsReady
                ? 'Ask a question about your documents…'
                : 'Load a document to start asking…'
            }
            className="max-h-32 flex-1 resize-none bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted"
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              className="inline-flex items-center gap-1.5 rounded-lg bg-border px-3 py-1.5 text-sm font-medium text-fg hover:opacity-90"
            >
              <StopIcon /> Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:opacity-90 disabled:opacity-50"
              aria-label="Send"
            >
              <SendIcon />
            </button>
          )}
        </div>
        <p className="mt-1.5 px-1 text-[0.7rem] text-muted">
          Answers come only from your documents. If it isn&apos;t in the text,
          the model says so.
        </p>
      </form>
    </div>
  );
}

function EmptyState({ docsReady }: { docsReady: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="max-w-sm">
        <h2 className="text-base font-semibold">Chat with financial documents</h2>
        <p className="mt-2 text-sm text-muted">
          {docsReady
            ? 'Ask a question below. Every answer cites the exact passage it came from.'
            : 'Load the sample documents (or upload a PDF) from the left to get started.'}
        </p>
      </div>
    </div>
  );
}
