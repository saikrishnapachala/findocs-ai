/**
 * Central, typed configuration derived from environment variables.
 *
 * Design goal: the app runs with an entirely empty environment (that is the
 * public "local mode" demo). Every value here has a safe default, and secrets
 * are read lazily so importing this module never throws.
 */

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  return raw === 'true' || raw === '1';
}

export type ProviderName = 'openai' | 'local';
export type VectorStoreKind = 'memory' | 'pgvector';

export interface AppConfig {
  provider: ProviderName;
  hasOpenAiKey: boolean;
  chatModel: string;
  embeddingModel: string;
  embeddingDim: number;
  vectorStore: VectorStoreKind;
  databaseUrl: string | undefined;
  chunkTokens: number;
  chunkOverlap: number;
  retrievalK: number;
  hybridRetrieval: boolean;
  mmrEnabled: boolean;
  rateLimitChatPerMin: number;
  rateLimitUploadPerHour: number;
  maxDailyUsd: number;
  maxUploadBytes: number;
  maxPdfPages: number;
}

/** Resolve the effective provider from LLM_PROVIDER + key presence. */
function resolveProvider(hasKey: boolean): ProviderName {
  const requested = (process.env.LLM_PROVIDER ?? 'auto').toLowerCase();
  if (requested === 'openai') return hasKey ? 'openai' : 'local';
  if (requested === 'local') return 'local';
  // "auto"
  return hasKey ? 'openai' : 'local';
}

export function getConfig(): AppConfig {
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY?.trim());
  const vectorStore = (process.env.VECTOR_STORE ?? 'memory') as VectorStoreKind;
  return {
    provider: resolveProvider(hasOpenAiKey),
    hasOpenAiKey,
    chatModel: process.env.CHAT_MODEL ?? 'gpt-4o-mini',
    embeddingModel: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',
    embeddingDim: num('EMBEDDING_DIM', 1536),
    vectorStore: vectorStore === 'pgvector' ? 'pgvector' : 'memory',
    databaseUrl: process.env.DATABASE_URL?.trim() || undefined,
    chunkTokens: num('CHUNK_TOKENS', 800),
    chunkOverlap: num('CHUNK_OVERLAP', 0.15),
    retrievalK: num('RETRIEVAL_K', 8),
    hybridRetrieval: bool('HYBRID_RETRIEVAL', true),
    mmrEnabled: bool('MMR_ENABLED', true),
    rateLimitChatPerMin: num('RATE_LIMIT_CHAT_PER_MIN', 20),
    rateLimitUploadPerHour: num('RATE_LIMIT_UPLOAD_PER_HOUR', 5),
    maxDailyUsd: num('MAX_DAILY_USD', 2.0),
    maxUploadBytes: Math.round(num('MAX_UPLOAD_MB', 25) * 1024 * 1024),
    maxPdfPages: num('MAX_PDF_PAGES', 300),
  };
}
