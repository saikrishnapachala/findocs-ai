# Decisions (ADR-lite) — FinDocs AI

Each entry: **Context / Decision / Alternatives / Consequences.** Newest first.

---

## ADR-001: Single Next.js app instead of a split Next + FastAPI stack

**Context.** The portfolio conventions default to a Python/FastAPI API next to the
Next.js frontend. The goal for this build is a genuinely real RAG system that
deploys to a single free host (Vercel) and keeps a public demo online with zero
recurring cost.

**Decision.** Implement the entire app — UI and the RAG pipeline — as one Next.js
15 project. Route handlers under `/api/v1/*` are the API; the retrieval/generation
logic lives in `src/lib/*` as pure modules.

**Alternatives.** (a) Split stack per the convention default — most faithful to the
"FastAPI + pgvector" resume line, but needs a second always-on host and a second
deploy, and free tiers sleep. (b) Edge functions only — rejected because PDF
parsing and pgvector want the Node runtime.

**Consequences.** One deploy, one language, one CI job; the demo stays free and
always-on. Cost: this project no longer demonstrates Python. That skill is covered
by Project 3 (FinAnalyst, LangGraph/Python). The RAG primitives themselves are
identical and fully interview-defensible in TypeScript.

---

## ADR-002: Keyless "local mode" as a first-class provider

**Context.** A public demo that always calls OpenAI would expose the owner to
cost/abuse, and a demo that requires a key is dead on arrival for a recruiter.

**Decision.** Put embeddings + generation behind a `Provider` interface with two
implementations: `openai` (real) and `local` (keyless — deterministic hashing
embeddings + extractive answer assembly). `LLM_PROVIDER=auto` uses OpenAI when a
key is present and a daily spend cap allows, otherwise local.

**Alternatives.** OpenAI-only (rejected: not free/always-on); mock-only (rejected:
not a real system).

**Consequences.** The same retrieval/citation code path runs in both modes, so the
demo is honest about structure even without a key. Local-mode answers are
extractive (stitched from the top chunks), clearly lower quality — documented in
the README as a limitation, with the OpenAI path as the "real" experience.

---

## ADR-003: Chunk at ~800 tokens with 15% overlap, sentence-aware

**Context.** Chunks must be small enough to retrieve precisely but large enough
to carry a self-contained answer, and must not split mid-sentence (which strands
figures from their context).

**Decision.** Recursive, sentence-aware chunking targeting ~800 tokens with 15%
overlap; both env-configurable (`CHUNK_TOKENS`, `CHUNK_OVERLAP`). Overlap seeds
each chunk with the tail sentences of the previous one. Pathologically long
sentences are token-window split as a fallback.

**Alternatives.** Fixed-size character splitting (splits words/numbers —
rejected); semantic/embedding-based chunking (better boundaries, more cost and
complexity — noted as future work).

**Consequences.** Page-level citations are precise; a chunk may span a page
boundary, so citations carry a page *range*. 800/15% is a documented starting
point, not a tuned optimum — the eval harness is the tool for tuning it.

---

## ADR-004: Hybrid retrieval (vector + BM25) fused with RRF

**Context.** Dense embeddings miss exact tokens (ticker symbols, dollar figures,
defined terms); lexical search misses paraphrases. Financial Q&A needs both.

**Decision.** Run vector cosine and BM25 in parallel and combine with Reciprocal
Rank Fusion, then optionally MMR-diversify. RRF is rank-based, so we avoid
calibrating cosine similarity against BM25 scores. A `HYBRID_RETRIEVAL` flag
disables the lexical half for A/B testing.

**Alternatives.** Vector-only (simpler; the eval shows it costs 0.12 hit@1 here);
weighted score blending (needs scale calibration — rejected in favour of RRF).

**Consequences.** One extra index (tsvector/GIN or in-memory BM25). The A/B is
reproducible via the eval harness and reported in `EVALS.md`.

---

## ADR-005: In-memory registry + serverless caveats

**Context.** Document/session/message state must live somewhere; the target is a
free single Vercel deploy.

**Decision.** Keep document metadata, chat history, and (by default) vectors in
an in-process registry keyed by an anonymous session cookie, with a throttled
24h purge sweep. Chunk vectors optionally persist to Postgres/pgvector.

**Alternatives.** Full Postgres persistence of all §5 tables (most robust; more
setup — the documented upgrade path). Redis for shared state (production choice).

**Consequences.** For a typical single-user, low-traffic demo Vercel keeps one
warm instance and everything works. Under multiple instances, only the pgvector
store shares chunks across instances; metadata/history are per-instance. Rate
limits and the spend cap are likewise per-instance. All flagged in the README's
"trade-offs" and "what I'd do next".
