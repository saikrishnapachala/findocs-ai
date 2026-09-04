'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Citation } from '@/lib/types';
import { api, streamChat, type DocumentDto } from '@/lib/client/api';
import type { ChatMessage } from '@/components/types';
import { DocumentPanel } from '@/components/DocumentPanel';
import { ChatPanel } from '@/components/ChatPanel';
import { SourcePanel } from '@/components/SourcePanel';

const SAMPLE_QUESTIONS = [
  'What was total revenue in fiscal 2024?',
  'What are the principal risk factors?',
  'What is the out-of-network deductible for an individual?',
  'What is the specialist copay?',
];

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export default function Home() {
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [loadingSamples, setLoadingSamples] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [providerLabel, setProviderLabel] = useState('local mode');
  const [mobileView, setMobileView] = useState<'docs' | 'chat'>('docs');
  const abortRef = useRef<AbortController | null>(null);

  const docsReady = documents.some((d) => d.status === 'ready');

  // Bootstrap: ensure a session, then restore documents + history.
  useEffect(() => {
    (async () => {
      try {
        await api.ensureSession();
        const [docs, history, health] = await Promise.all([
          api.listDocuments(),
          api.getMessages(),
          fetch('/api/v1/healthz').then((r) => r.json()),
        ]);
        setDocuments(docs);
        setMessages(
          history.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            citations: m.citations,
            usage: m.usage ?? undefined,
          })),
        );
        setProviderLabel(
          health.provider === 'openai' ? health.model : 'local mode (no key)',
        );
      } catch {
        /* first load with an empty session is fine */
      }
    })();
  }, []);

  // Poll document list while any document is still ingesting.
  useEffect(() => {
    const busy = documents.some((d) =>
      ['queued', 'parsing', 'chunking', 'embedding'].includes(d.status),
    );
    if (!busy) return;
    const t = setInterval(async () => {
      try {
        setDocuments(await api.listDocuments());
      } catch {
        /* transient */
      }
    }, 1200);
    return () => clearInterval(t);
  }, [documents]);

  const loadSamples = useCallback(async () => {
    setLoadingSamples(true);
    setUploadError(null);
    try {
      await api.loadSamples();
      setDocuments(await api.listDocuments());
      setMobileView('chat');
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setLoadingSamples(false);
    }
  }, []);

  const upload = useCallback(async (file: File) => {
    setUploadError(null);
    try {
      const doc = await api.uploadDocument(file);
      setDocuments((prev) => {
        const without = prev.filter((d) => d.id !== doc.id);
        return [...without, doc];
      });
    } catch (e) {
      setUploadError((e as Error).message);
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    try {
      await api.deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch {
      /* ignore */
    }
  }, []);

  const send = useCallback(
    (question: string) => {
      if (isStreaming) return;
      const userMsg: ChatMessage = {
        id: uid(),
        role: 'user',
        content: question,
        citations: [],
      };
      const assistantId = uid();
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: assistantId, role: 'assistant', content: '', citations: [], streaming: true },
      ]);
      setIsStreaming(true);
      setMobileView('chat');

      const controller = new AbortController();
      abortRef.current = controller;

      const patch = (fn: (m: ChatMessage) => ChatMessage) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? fn(m) : m)),
        );

      void streamChat(question, undefined, controller.signal, {
        onToken: (text) =>
          patch((m) => ({ ...m, content: m.content + text })),
        onCitations: (citations, coverage) =>
          patch((m) => ({ ...m, citations, coverage })),
        onUsage: (usage, provider) => patch((m) => ({ ...m, usage, provider })),
        onError: (message) =>
          patch((m) => ({
            ...m,
            content: m.content || message,
            error: true,
            streaming: false,
          })),
        onDone: () => {
          patch((m) => ({ ...m, streaming: false }));
          setIsStreaming(false);
          abortRef.current = null;
        },
      });
    },
    [isStreaming],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)),
    );
  }, []);

  return (
    <main className="flex h-screen flex-col bg-bg">
      {/* Mobile tab switcher */}
      <div className="flex border-b border-border md:hidden">
        {(['docs', 'chat'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setMobileView(v)}
            className={`flex-1 py-2 text-sm font-medium ${
              mobileView === v
                ? 'border-b-2 border-accent text-accent'
                : 'text-muted'
            }`}
          >
            {v === 'docs' ? 'Documents' : 'Chat'}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 md:grid-cols-[320px_1fr]">
        <aside
          className={`min-h-0 border-r border-border bg-bg ${
            mobileView === 'docs' ? 'block' : 'hidden'
          } md:block`}
        >
          <DocumentPanel
            documents={documents}
            onUpload={upload}
            onLoadSamples={loadSamples}
            onDelete={remove}
            loadingSamples={loadingSamples}
            uploadError={uploadError}
          />
        </aside>

        <section
          className={`min-h-0 ${mobileView === 'chat' ? 'block' : 'hidden'} md:block`}
        >
          <ChatPanel
            messages={messages}
            isStreaming={isStreaming}
            docsReady={docsReady}
            providerLabel={providerLabel}
            sampleQuestions={SAMPLE_QUESTIONS}
            onSend={send}
            onStop={stop}
            onOpenSource={setActiveCitation}
          />
        </section>
      </div>

      <SourcePanel
        citation={activeCitation}
        onClose={() => setActiveCitation(null)}
      />
    </main>
  );
}
