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
