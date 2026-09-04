'use client';

import type { Citation } from '@/lib/types';
import { CloseIcon } from './icons';

/** Slide-in panel showing the full passage behind a clicked citation. */
export function SourcePanel({
  citation,
  onClose,
}: {
  citation: Citation | null;
  onClose: () => void;
}) {
  const open = citation !== null;
  const page =
    citation && citation.pageStart === citation.pageEnd
      ? `page ${citation.pageStart}`
      : citation
        ? `pages ${citation.pageStart}-${citation.pageEnd}`
        : '';

  return (
    <aside
      className={`fixed inset-y-0 right-0 z-30 w-full max-w-md transform border-l border-border bg-surface shadow-xl transition-transform duration-200 ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
      aria-hidden={!open}
      aria-label="Source passage"
    >
      {citation && (
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-border p-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted">
                Source [{citation.n}]
              </div>
              <div className="mt-1 text-sm font-semibold">
                {citation.documentName}
              </div>
              <div className="text-xs text-muted">{page}</div>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-muted hover:bg-border/50 hover:text-fg"
              aria-label="Close source panel"
            >
              <CloseIcon />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">
              {citation.content ?? 'Passage text is not available for this message.'}
            </p>
          </div>
          <div className="border-t border-border p-3 text-xs text-muted">
            Answers cite the exact passage they draw from, so every claim is
            verifiable against the source text.
          </div>
        </div>
      )}
    </aside>
  );
}
