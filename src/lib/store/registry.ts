import { randomUUID } from 'node:crypto';
import type {
  Citation,
  DocumentStatus,
  RetrievedChunk,
  Usage,
} from '@/lib/types';

export interface DocumentRecord {
  id: string;
  sessionId: string;
  filename: string;
  sha256: string;
  pageCount: number;
  status: DocumentStatus;
  error?: string;
  isSample: boolean;
  chunksDone: number;
  chunksTotal: number;
  createdAt: number;
}

export interface MessageRecord {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  retrieval?: Pick<RetrievedChunk, 'id' | 'vectorScore' | 'ftsRank' | 'fused'>[];
  usage?: Usage;
  createdAt: number;
}

/**
 * In-memory document + message registry, scoped by session id (the anonymous
 * cookie). Ephemeral by design: sessions and their documents naturally expire
 * when the instance recycles, and a sweep purges anything older than 24h.
 */
class Registry {
  documents = new Map<string, Map<string, DocumentRecord>>();
  messages = new Map<string, MessageRecord[]>();

  private docs(sessionId: string): Map<string, DocumentRecord> {
    let m = this.documents.get(sessionId);
    if (!m) {
      m = new Map();
      this.documents.set(sessionId, m);
    }
    return m;
  }

  createDocument(input: {
    sessionId: string;
    filename: string;
    sha256: string;
    isSample?: boolean;
  }): DocumentRecord {
    const record: DocumentRecord = {
      id: randomUUID(),
      sessionId: input.sessionId,
      filename: input.filename,
      sha256: input.sha256,
      pageCount: 0,
      status: 'queued',
      isSample: input.isSample ?? false,
      chunksDone: 0,
      chunksTotal: 0,
      createdAt: Date.now(),
    };
    this.docs(input.sessionId).set(record.id, record);
    return record;
  }

  /** Find an existing doc with the same content hash (idempotent ingestion). */
  findByHash(sessionId: string, sha256: string): DocumentRecord | undefined {
    for (const doc of this.docs(sessionId).values()) {
      if (doc.sha256 === sha256) return doc;
    }
    return undefined;
  }

  getDocument(sessionId: string, id: string): DocumentRecord | undefined {
    return this.docs(sessionId).get(id);
  }

  listDocuments(sessionId: string): DocumentRecord[] {
    return Array.from(this.docs(sessionId).values()).sort(
      (a, b) => a.createdAt - b.createdAt,
    );
  }

  updateDocument(
    sessionId: string,
    id: string,
    patch: Partial<DocumentRecord>,
  ): void {
    const doc = this.docs(sessionId).get(id);
    if (doc) Object.assign(doc, patch);
  }

  deleteDocument(sessionId: string, id: string): void {
    this.docs(sessionId).delete(id);
  }

  addMessage(record: Omit<MessageRecord, 'id' | 'createdAt'>): MessageRecord {
    const full: MessageRecord = {
      ...record,
      id: randomUUID(),
      createdAt: Date.now(),
    };
    const list = this.messages.get(record.sessionId) ?? [];
    list.push(full);
    this.messages.set(record.sessionId, list);
    return full;
  }

  listMessages(sessionId: string): MessageRecord[] {
    return this.messages.get(sessionId) ?? [];
  }

  clearMessages(sessionId: string): void {
    this.messages.delete(sessionId);
  }

  /** Purge sessions whose newest activity is older than maxAgeMs. */
  sweep(maxAgeMs: number): string[] {
    const cutoff = Date.now() - maxAgeMs;
    const purged: string[] = [];
    for (const [sessionId, docs] of this.documents) {
      const newest = Math.max(
        0,
        ...Array.from(docs.values()).map((d) => d.createdAt),
        ...(this.messages.get(sessionId) ?? []).map((m) => m.createdAt),
      );
      if (newest < cutoff) {
        this.documents.delete(sessionId);
        this.messages.delete(sessionId);
        purged.push(sessionId);
      }
    }
    return purged;
  }
}

const globalForRegistry = globalThis as unknown as {
  __findocsRegistry?: Registry;
};

export function getRegistry(): Registry {
  if (!globalForRegistry.__findocsRegistry) {
    globalForRegistry.__findocsRegistry = new Registry();
  }
  return globalForRegistry.__findocsRegistry;
}
