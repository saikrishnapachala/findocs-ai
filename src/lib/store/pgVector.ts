import { Pool } from 'pg';
import type { StoredChunk } from '@/lib/types';
import type {
  VectorStore,
  VectorHit,
  KeywordHit,
  SearchParams,
} from './vector';

/**
 * Postgres + pgvector store. Enabled with VECTOR_STORE=pgvector and a
 * DATABASE_URL pointing at a database with the `vector` extension (Neon,
 * Supabase, or local pgvector). Similarity search runs in SQL via the HNSW
 * cosine index; the lexical half uses a generated tsvector + GIN index.
 *
 * Scope note (v1): this store persists chunk vectors and runs retrieval. The
 * document/session/message registry stays in-process (see registry.ts). A full
 * production build would move all of §5's tables here — noted in the README.
 */
export class PgVectorStore implements VectorStore {
  private pool: Pool;
  private dim: number;
  private ready: Promise<void> | null = null;

  constructor(connectionString: string, dim: number) {
    this.pool = new Pool({
      connectionString,
      max: 3,
      ssl: connectionString.includes('sslmode=disable')
        ? undefined
        : { rejectUnauthorized: false },
    });
    this.dim = dim;
  }

  private ensureSchema(): Promise<void> {
    if (!this.ready) {
      this.ready = this.pool
        .query(
          `
          create extension if not exists vector;
          create table if not exists chunks (
            id text primary key,
            session_id text not null,
            document_id text not null,
            document_name text not null,
            chunk_index int not null,
            page_start int not null,
            page_end int not null,
            content text not null,
            token_count int not null,
            char_start int not null,
            char_end int not null,
            embedding vector(${this.dim}) not null,
            tsv tsvector generated always as (to_tsvector('english', content)) stored
          );
          create index if not exists chunks_embedding_idx
            on chunks using hnsw (embedding vector_cosine_ops);
          create index if not exists chunks_tsv_idx on chunks using gin (tsv);
          create index if not exists chunks_session_idx on chunks (session_id);
        `,
        )
        .then(() => undefined);
    }
    return this.ready;
  }

  async addChunks(chunks: StoredChunk[]): Promise<void> {
    if (chunks.length === 0) return;
    await this.ensureSchema();
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      for (const c of chunks) {
        await client.query(
          `insert into chunks
             (id, session_id, document_id, document_name, chunk_index,
              page_start, page_end, content, token_count, char_start, char_end, embedding)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::vector)
           on conflict (id) do nothing`,
          [
            c.id,
            c.sessionId,
            c.documentId,
            c.documentName,
            c.chunkIndex,
            c.pageStart,
            c.pageEnd,
            c.content,
            c.tokenCount,
            c.charStart,
            c.charEnd,
            toVectorLiteral(c.embedding),
          ],
        );
      }
      await client.query('commit');
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }
  }

  async vectorSearch(
    params: SearchParams & { queryEmbedding: number[] },
  ): Promise<VectorHit[]> {
    await this.ensureSchema();
    const { where, values } = this.scopeClause(params, 2);
    const res = await this.pool.query(
      `select *, 1 - (embedding <=> $1::vector) as score
         from chunks
         where ${where}
         order by embedding <=> $1::vector asc
         limit ${clampLimit(params.k)}`,
      [toVectorLiteral(params.queryEmbedding), ...values],
    );
    return res.rows.map((row) => ({
      chunk: rowToChunk(row),
      score: Math.max(0, Math.min(1, Number(row.score))),
    }));
  }

  async keywordSearch(
    params: SearchParams & { queryText: string },
  ): Promise<KeywordHit[]> {
    await this.ensureSchema();
    const { where, values } = this.scopeClause(params, 2);
    const res = await this.pool.query(
      `select *, ts_rank(tsv, plainto_tsquery('english', $1)) as rank
         from chunks
         where ${where} and tsv @@ plainto_tsquery('english', $1)
         order by rank desc
         limit ${clampLimit(params.k)}`,
      [params.queryText, ...values],
    );
    return res.rows.map((row) => ({
      chunk: rowToChunk(row),
      rank: Number(row.rank),
    }));
  }

  async deleteDocument(sessionId: string, documentId: string): Promise<void> {
    await this.ensureSchema();
    await this.pool.query(
      'delete from chunks where session_id = $1 and document_id = $2',
      [sessionId, documentId],
    );
  }

  async clearSession(sessionId: string): Promise<void> {
    await this.ensureSchema();
    await this.pool.query('delete from chunks where session_id = $1', [
      sessionId,
    ]);
  }

  /** Build a WHERE clause scoping to session (+ optional document ids). */
  private scopeClause(
    params: SearchParams,
    startIndex: number,
  ): { where: string; values: unknown[] } {
    const values: unknown[] = [params.sessionId];
    let where = `session_id = $${startIndex}`;
    if (params.documentIds && params.documentIds.length > 0) {
      values.push(params.documentIds);
      where += ` and document_id = any($${startIndex + 1}::text[])`;
    }
    return { where, values };
  }
}

function toVectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}

function parseVectorLiteral(s: string): number[] {
  return s
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map(Number);
}

function clampLimit(k: number): number {
  return Math.max(1, Math.min(100, Math.floor(k)));
}

function rowToChunk(row: Record<string, unknown>): StoredChunk {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    documentId: String(row.document_id),
    documentName: String(row.document_name),
    chunkIndex: Number(row.chunk_index),
    pageStart: Number(row.page_start),
    pageEnd: Number(row.page_end),
    content: String(row.content),
    tokenCount: Number(row.token_count),
    charStart: Number(row.char_start),
    charEnd: Number(row.char_end),
    embedding:
      typeof row.embedding === 'string'
        ? parseVectorLiteral(row.embedding)
        : (row.embedding as number[]),
  };
}
