import { describe, it, expect, beforeEach } from 'vitest';
import { retrieve } from './retrieve';
import { MemoryVectorStore } from '@/lib/store/memoryVector';
import { LocalProvider } from '@/lib/providers/local';
import type { StoredChunk } from '@/lib/types';

const provider = new LocalProvider(1536);

async function seed(store: MemoryVectorStore, sessionId: string) {
  const texts = [
    'Total revenue for fiscal year 2024 was 1,250 million dollars, up 12 percent.',
    'The board of directors approved a quarterly dividend of 30 cents per share.',
    'Principal risk factors include foreign exchange exposure and supply chain disruption.',
    'Operating expenses rose due to increased headcount and cloud infrastructure spend.',
  ];
  const embeds = await provider.embed(texts);
  const chunks: StoredChunk[] = texts.map((content, i) => ({
    id: `d:${i}`,
    sessionId,
    documentId: 'd',
    documentName: 'annual-report.pdf',
    chunkIndex: i,
    pageStart: i + 1,
    pageEnd: i + 1,
    content,
    tokenCount: 20,
    charStart: 0,
    charEnd: content.length,
    embedding: embeds.vectors[i]!,
  }));
  await store.addChunks(chunks);
}

describe('retrieve (integration, keyless local provider)', () => {
  let store: MemoryVectorStore;
  const sessionId = 's1';

  beforeEach(async () => {
    store = new MemoryVectorStore();
    await seed(store, sessionId);
  });

  it('surfaces the most relevant passage first', async () => {
    const results = await retrieve(
      { sessionId, query: 'What was total revenue in fiscal 2024?', k: 2 },
      { provider, store },
    );
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.content).toContain('revenue');
    expect(results[0]!.fused).toBeGreaterThan(0);
  });

  it('carries per-source scores through for eval/UI', async () => {
    const results = await retrieve(
      { sessionId, query: 'dividend per share', k: 3, mmr: false },
      { provider, store },
    );
    const dividend = results.find((r) => r.content.includes('dividend'));
    expect(dividend).toBeDefined();
    // hybrid on by default: the exact term should also produce a lexical rank.
    expect(dividend!.ftsRank).not.toBeNull();
  });

  it('scopes retrieval to the given session', async () => {
    const results = await retrieve(
      { sessionId: 'other-session', query: 'revenue', k: 3 },
      { provider, store },
    );
    expect(results).toHaveLength(0);
  });
});
