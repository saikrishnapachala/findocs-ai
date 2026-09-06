# Evaluation — FinDocs AI

Run with `make eval` (or `npm run eval`). The harness seeds the two sample
documents, then measures retrieval quality, an A/B of hybrid vs vector-only
retrieval, and answer quality. Raw output is written to
`evals/results/<date>.json` (gitignored); the headline numbers are pasted here.

## Method

- **Question set:** `evals/questions.jsonl` — 37 questions over the sample
  corpus: 32 with a specific expected answer (mostly numeric), and 5
  deliberately unanswerable ("What is the CEO's salary?", etc.).
- **Retrieval:** for each answerable question, retrieve top-5 and find the rank
  of the first passage whose page range covers the expected page in the expected
  document. Report **hit@1 / hit@3 / hit@5** and **MRR**.
- **A/B:** the same retrieval metrics with hybrid retrieval (vector + BM25 +
  Reciprocal Rank Fusion) versus **vector-only**.
- **Answers:** **numeric exact-match** (expected figure appears in the answer),
  **refusal accuracy** (does the model decline the 5 unanswerable questions?),
  and **average citation coverage** (fraction of sentences carrying a citation).

## Latest results — keyless local mode (`local-extractive`), 2026-09-06

| Retrieval    | hit@1 | hit@3 | hit@5 |  MRR  |
| ------------ | :---: | :---: | :---: | :---: |
| **hybrid**   | 0.970 | 1.000 | 1.000 | 0.985 |
| vector-only  | 0.848 | 1.000 | 1.000 | 0.909 |

| Answer metric               | value |
| --------------------------- | :---: |
| Numeric exact-match (n=32)  | 1.000 |
| Refusal accuracy (n=5)      | 0.400 |
| Avg citation coverage       | 0.783 |

### Reading the A/B

Hybrid retrieval lifts **hit@1 from 0.848 → 0.970** and **MRR from 0.909 →
0.985**. The win comes from exact-term matches (dollar figures, defined terms
like "deductible") that dense embeddings alone rank lower — precisely what BM25 +
RRF is there to fix. hit@3/hit@5 are 1.0 for both because the sample corpus has
only four chunks; **hit@1 and MRR are the discriminating metrics at this scale.**

### Honest caveats

- **Refusal accuracy is 0.40 in keyless mode.** The local provider is
  *extractive* — it stitches the best-matching sentences together and only
  refuses when too few query terms match. Questions whose terms happen to appear
  in the docs for other reasons ("how many **board** of **directors** members?"
  — the phrase "Board of Directors" appears re: dividends) get a confident but
  unhelpful extract. The **OpenAI path refuses correctly** via the grounded
  prompt; that is the intended production behaviour.
- **Faithfulness / answer-relevance (LLM-as-judge)** are defined in the harness
  but only run when `OPENAI_API_KEY` is set (they need a separate model call).
  The keyless numbers above are extractive-mode baselines.
- The corpus is intentionally tiny (two synthetic documents) so the eval is
  self-contained and free. The methodology — not the absolute hit@5 — is the
  point; it scales to a larger corpus unchanged.

## What I'd measure next

- Turn on the LLM-as-judge (faithfulness + relevance) and report those with
  `gpt-4o-mini`.
- Add a reranker (e.g., a cross-encoder) and A/B it against RRF.
- Grow the corpus to real (public-domain) filings and report hit@5 where it is
  no longer saturated.
