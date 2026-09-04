'use client';

import { Fragment, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Citation } from '@/lib/types';
import type { ChatMessage } from './types';

/**
 * Replace inline [n] markers inside markdown text nodes with clickable citation
 * chips. Numbers with no matching citation are left as plain text (dangling
 * markers were verified server-side).
 */
function injectCitations(
  node: ReactNode,
  byNumber: Map<number, Citation>,
  onOpen: (c: Citation) => void,
): ReactNode {
  if (typeof node === 'string') {
    const parts = node.split(/(\[\d+\])/g);
    return parts.map((part, i) => {
      const m = part.match(/^\[(\d+)\]$/);
      if (m) {
        const n = Number(m[1]);
        const citation = byNumber.get(n);
        if (citation) {
          return (
            <button
              key={i}
              onClick={() => onOpen(citation)}
              title={citation.content?.slice(0, 140)}
              className="mx-0.5 inline-flex -translate-y-0.5 items-center rounded bg-accent/15 px-1 align-super text-[0.65rem] font-semibold text-accent hover:bg-accent/30"
              aria-label={`Open source ${n}: ${citation.documentName}`}
            >
              {n}
            </button>
          );
        }
      }
      return <Fragment key={i}>{part}</Fragment>;
    });
  }
  if (Array.isArray(node)) {
    return node.map((child, i) => (
      <Fragment key={i}>{injectCitations(child, byNumber, onOpen)}</Fragment>
    ));
  }
  return node;
}

export function MessageView({
  message,
  onOpenSource,
}: {
  message: ChatMessage;
  onOpenSource: (c: Citation) => void;
}) {
  const isUser = message.role === 'user';
  const byNumber = new Map(message.citations.map((c) => [c.n, c]));
  const wrap = (children: ReactNode) =>
    injectCitations(children, byNumber, onOpenSource);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser
            ? 'bg-accent text-accent-fg'
            : message.error
              ? 'border border-red-300 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200'
              : 'border border-border bg-surface text-fg'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose-chat">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p>{wrap(children)}</p>,
                li: ({ children }) => <li>{wrap(children)}</li>,
                td: ({ children }) => <td>{wrap(children)}</td>,
                th: ({ children }) => <th>{wrap(children)}</th>,
                strong: ({ children }) => <strong>{wrap(children)}</strong>,
                em: ({ children }) => <em>{wrap(children)}</em>,
              }}
            >
              {message.content || (message.streaming ? '…' : '')}
            </ReactMarkdown>
            {!message.streaming && message.citations.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border pt-2 text-xs text-muted">
                <span>Sources:</span>
                {message.citations.map((c) => (
                  <button
                    key={c.n}
                    onClick={() => onOpenSource(c)}
                    className="rounded bg-border/60 px-1.5 py-0.5 font-medium text-fg hover:bg-border"
                  >
                    [{c.n}] {c.documentName.replace(/\.pdf$/i, '').slice(0, 22)}
                  </button>
                ))}
                {typeof message.coverage === 'number' && (
                  <span
                    className="ml-auto"
                    title="Fraction of sentences backed by a citation"
                  >
                    {Math.round(message.coverage * 100)}% cited
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
