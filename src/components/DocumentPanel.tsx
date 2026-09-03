'use client';

import { useRef, useState } from 'react';
import type { DocumentDto } from '@/lib/client/api';
import type { DocumentStatus } from '@/lib/types';
import { UploadIcon, FileIcon, TrashIcon, SparkleIcon } from './icons';

const STATUS_LABEL: Record<DocumentStatus, string> = {
  queued: 'Queued',
  parsing: 'Parsing',
  chunking: 'Chunking',
  embedding: 'Embedding',
  ready: 'Ready',
  failed: 'Failed',
};

function StatusBadge({ doc }: { doc: DocumentDto }) {
  const busy = ['queued', 'parsing', 'chunking', 'embedding'].includes(doc.status);
  const color =
    doc.status === 'ready'
      ? 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/40'
      : doc.status === 'failed'
        ? 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/40'
        : 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium ${color}`}
    >
      {busy && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
      {STATUS_LABEL[doc.status]}
      {busy && doc.chunks_total ? ` ${doc.chunk_count}/${doc.chunks_total}` : ''}
    </span>
  );
}

export function DocumentPanel({
  documents,
  onUpload,
  onLoadSamples,
  onDelete,
  loadingSamples,
  uploadError,
}: {
  documents: DocumentDto[];
  onUpload: (file: File) => void;
  onLoadSamples: () => void;
  onDelete: (id: string) => void;
  loadingSamples: boolean;
  uploadError: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = (files: FileList | null) => {
    if (files && files[0]) onUpload(files[0]);
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div>
        <h2 className="text-sm font-semibold">Documents</h2>
        <p className="mt-1 text-xs text-muted">
          Upload financial PDFs, or try the samples.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files);
        }}
        className={`rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
          dragging ? 'border-accent bg-accent/5' : 'border-border'
        }`}
      >
        <UploadIcon className="text-muted" />
        <p className="mt-1 text-xs text-muted">
          Drag a PDF here, or{' '}
          <button
            onClick={() => inputRef.current?.click()}
            className="font-medium text-accent underline-offset-2 hover:underline"
          >
            browse
          </button>
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => pick(e.target.files)}
        />
      </div>

      <button
        onClick={onLoadSamples}
        disabled={loadingSamples}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <SparkleIcon />
        {loadingSamples ? 'Loading samples…' : 'Try with sample documents'}
      </button>

      {uploadError && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {uploadError}
        </p>
      )}

      <div className="flex-1 overflow-y-auto">
        {documents.length === 0 ? (
          <p className="mt-4 text-center text-xs text-muted">
            No documents yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="group rounded-lg border border-border bg-surface p-2.5"
              >
                <div className="flex items-start gap-2">
                  <FileIcon className="mt-0.5 shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium" title={doc.filename}>
                      {doc.filename}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <StatusBadge doc={doc} />
                      {doc.status === 'ready' && (
                        <span className="text-[0.7rem] text-muted">
                          {doc.page_count}p · {doc.chunk_count} chunks
                        </span>
                      )}
                    </div>
                    {doc.error && (
                      <p className="mt-1 text-[0.7rem] text-red-600 dark:text-red-400">
                        {doc.error}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => onDelete(doc.id)}
                    className="rounded p-1 text-muted opacity-0 transition-opacity hover:bg-border/60 hover:text-fg group-hover:opacity-100"
                    aria-label={`Delete ${doc.filename}`}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
