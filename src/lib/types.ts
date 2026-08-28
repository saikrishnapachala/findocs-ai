/** Shared domain types used across ingestion, retrieval, and generation. */

export type DocumentStatus =
  | 'queued'
  | 'parsing'
  | 'chunking'
  | 'embedding'
  | 'ready'
  | 'failed';

export interface PageText {
  page: number; // 1-based
  text: string;
}

export interface Chunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  pageStart: number;
  pageEnd: number;
  content: string;
  tokenCount: number;
  charStart: number;
  charEnd: number;
}

/** A chunk plus its stored embedding, as held by a vector store. */
export interface StoredChunk extends Chunk {
  embedding: number[];
  documentName: string;
}

/** A retrieval hit: a chunk with the scores that surfaced it. */
export interface RetrievedChunk {
  id: string;
  documentId: string;
  documentName: string;
  pageStart: number;
  pageEnd: number;
  content: string;
  vectorScore: number | null;
  ftsRank: number | null;
  fused: number;
}

export interface Citation {
  n: number;
  chunkId: string;
  documentId: string;
  documentName: string;
  pageStart: number;
  pageEnd: number;
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  latencyMs: number;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}
