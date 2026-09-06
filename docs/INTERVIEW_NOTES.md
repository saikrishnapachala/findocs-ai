# Interview notes — FinDocs AI

Ten questions I expect about this project, with answers grounded in the actual
code. File references are clickable in the repo.

### 1. Walk me through what happens when a user asks a question.

`ChatPanel` POSTs `{question}` to `/api/v1/chat`. The route rate-limits the IP,
validates the body (zod), and returns a `ReadableStream` fed by
`streamAnswer()` (`src/lib/chat/stream.ts`): load prior turns as history →
`retrieve()` grounded context → `provider.generate()` streaming tokens →
`postProcessAnswer()` to verify citations and compute coverage → persist the
turn. Events (`token`/`citations`/`usage`/`done`/`error`) are SSE-encoded; the
client parses them with a `fetch` body reader.

### 2. Why hybrid retrieval, and can you prove it helps?

Dense embeddings miss exact tokens (dollar figures, "deductible"); BM25 catches
them. I fuse the two ranked lists with Reciprocal Rank Fusion (rank-based, so I
don't have to calibrate cosine vs BM25 scales). The eval A/B (`make eval`) shows
hybrid lifts hit@1 from 0.85 → 0.97 and MRR from 0.91 → 0.99 on the sample set.

### 3. How do you reduce hallucination, and how do you measure it?

Three layers: (a) a grounded system prompt — answer only from numbered context,
cite every sourced sentence, quote figures exactly, refuse when unsupported
(`src/lib/rag/prompt.ts`); (b) `temperature 0`; (c) citation *verification* —
`postProcessAnswer()` checks every `[n]` maps to a retrieved passage, strips
dangling ones, and reports **citation coverage**. The eval measures numeric
exact-match, refusal accuracy, and coverage.

### 4. Why RRF specifically over weighted score blending?

Cosine similarity (~0–1) and BM25 (unbounded) live on different scales; blending
them needs a tuned weight that drifts as the corpus changes. RRF only uses
*ranks*, so it's robust and parameter-light (`k=60`). Trade-off: it ignores
score magnitude, which a reranker would exploit — that's the documented next step.

### 5. How does streaming work end to end, and how does "Stop" cancel it?

`streamAnswer()` yields events; the route wraps them in a `ReadableStream` with
`text/event-stream` headers. The client uses `fetch` + a body reader (not
`EventSource`, which can't POST). The request carries an `AbortController.signal`;
"Stop" calls `abort()`, which rejects the reader and is forwarded to the OpenAI
SDK call's `signal`, cancelling the upstream generation.

### 6. Why a keyless "local mode" at all?

So the public demo is always-on and free with zero abuse risk. `LocalProvider`
uses feature-hashing embeddings + extractive answers behind the same `Provider`
interface, so the whole retrieval/citation pipeline runs identically without a
key. Setting `OPENAI_API_KEY` upgrades embeddings + generation in place. It's
honestly lower quality (weaker refusal) — documented, with OpenAI as the real
experience.

### 7. How do you keep the demo from running up a bill?

Per-IP rate limits (20 chat/min, 5 uploads/hour), a hard `MAX_DAILY_USD` cap
that flips the provider to local mode when exceeded, `gpt-4o-mini` at
`max_tokens 800`, upload size/page caps validated by magic bytes, and a 24h
purge sweep. Every LLM call records tokens + estimated cost.

### 8. What's the chunking strategy and why 800/15%?

Sentence-aware packing to ~800 tokens with 15% overlap (`src/lib/ingest/
chunker.ts`), never splitting mid-sentence unless a single sentence exceeds the
budget. 800 balances retrieval precision against self-containedness; overlap
prevents answers being stranded across a boundary. Both are env-configurable and
meant to be tuned with the eval harness — I don't claim they're optimal.

### 9. Tell me about a bug you found and fixed.

Two, both caught by the eval. (a) The sentence splitter used `String.match`,
which *drops* text around decimals like `$120.0 million` — I rewrote it with
`split` so it's loss-free (regression test in `text.test.ts`). (b) The tokenizer
kept trailing punctuation, so `copay.` ≠ `copay`, silently breaking keyword and
BM25 matching; fixing the regex took numeric exact-match from 0.94 → 1.00.

### 10. What breaks at scale, and what would you change?

The in-memory registry and rate limiter are per serverless instance — I'd move
state to Postgres (all of the §5 schema) and Redis/Upstash for shared counters.
Ingestion runs in a `next/server` `after()` callback; at scale that becomes a
real queue (SQS/Cloud Tasks) with a worker. I'd add a cross-encoder reranker,
semantic chunking, auth + row-level security for multi-tenant use, and turn on
the LLM-as-judge faithfulness eval in CI.
