/**
 * Eval harness. Seeds the sample corpus, then measures:
 *   - Retrieval: hit@1 / hit@3 / hit@5 and MRR (does the right passage rank high?)
 *   - Retrieval A/B: hybrid (vector+BM25+RRF) vs vector-only
 *   - Answers: numeric exact-match, refusal accuracy on unanswerable questions,
 *     and average citation coverage
 *
 * Runs fully keyless (local provider). With OPENAI_API_KEY set, the same harness
 * exercises real embeddings + generation. Writes evals/results/<date>.json.
 *
 *   npm run eval
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { seedSampleDocuments } from '@/lib/seed/seed';
import { retrieve } from '@/lib/retrieval/retrieve';
import { getProvider } from '@/lib/providers';
import { getConfig } from '@/lib/config';
import { postProcessAnswer } from '@/lib/rag/citations';
import type { RetrievedChunk } from '@/lib/types';

interface Question {
  id: string;
  doc: string;
  page?: number;
  question: string;
  expected_answer?: string;
  unanswerable?: boolean;
}

function loadQuestions(): Question[] {
  const raw = readFileSync(join(process.cwd(), 'evals', 'questions.jsonl'), 'utf8');
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Question);
}

function hitRank(q: Question, chunks: RetrievedChunk[]): number | null {
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i]!;
    const docMatch = c.documentName.toLowerCase().includes(q.doc);
    const pageMatch =
      q.page === undefined || (q.page >= c.pageStart && q.page <= c.pageEnd);
    if (docMatch && pageMatch) return i + 1;
  }
  return null;
}

async function generateAnswer(
  question: string,
  context: RetrievedChunk[],
): Promise<string> {
  const gen = getProvider().generate({
    question,
    history: [],
    context,
    temperature: 0,
    maxTokens: 400,
  });
  let out = '';
  let step = await gen.next();
  while (!step.done) {
    out += step.value;
    step = await gen.next();
  }
  return out;
}

const REFUSAL_MARKERS = [
  "couldn't find",
  'could not find',
  'not contain',
  'does not contain',
  'no information',
  'not found',
  'not mention',
  'does not mention',
  'not specified',
  'not provide',
];

function isRefusal(answer: string): boolean {
  const a = answer.toLowerCase();
  return REFUSAL_MARKERS.some((m) => a.includes(m));
}

async function retrievalMetrics(questions: Question[], hybrid: boolean) {
  let hit1 = 0;
  let hit3 = 0;
  let hit5 = 0;
  let mrr = 0;
  const answerable = questions.filter((q) => !q.unanswerable);
  for (const q of answerable) {
    const chunks = await retrieve({
      sessionId: 'eval',
      query: q.question,
      k: 5,
      hybrid,
      mmr: false,
    });
    const rank = hitRank(q, chunks);
    if (rank !== null) {
      if (rank <= 1) hit1++;
      if (rank <= 3) hit3++;
      if (rank <= 5) hit5++;
      mrr += 1 / rank;
    }
  }
  const n = answerable.length;
  return {
    n,
    hit_at_1: +(hit1 / n).toFixed(3),
    hit_at_3: +(hit3 / n).toFixed(3),
    hit_at_5: +(hit5 / n).toFixed(3),
    mrr: +(mrr / n).toFixed(3),
  };
}

async function main() {
  const cfg = getConfig();
  const questions = loadQuestions();
  await seedSampleDocuments('eval');

  const hybrid = await retrievalMetrics(questions, true);
  const vectorOnly = await retrievalMetrics(questions, false);

  // Answer metrics (hybrid retrieval).
  let numHit = 0;
  let numTotal = 0;
  let refuseHit = 0;
  let refuseTotal = 0;
  let coverageSum = 0;
  let coverageCount = 0;

  for (const q of questions) {
    const context = await retrieve({
      sessionId: 'eval',
      query: q.question,
      k: 5,
      mmr: true,
    });
    const answer = await generateAnswer(q.question, context);

    if (q.unanswerable) {
      refuseTotal++;
      if (isRefusal(answer)) refuseHit++;
    } else if (q.expected_answer) {
      numTotal++;
      if (answer.toLowerCase().includes(q.expected_answer.toLowerCase())) numHit++;
      const post = postProcessAnswer(answer, context);
      coverageSum += post.coverage;
      coverageCount++;
    }
  }

  const results = {
    date: new Date().toISOString(),
    provider: cfg.provider,
    model: cfg.provider === 'openai' ? cfg.chatModel : 'local-extractive',
    questions: questions.length,
    retrieval_hybrid: hybrid,
    retrieval_vector_only: vectorOnly,
    answers: {
      numeric_exact_match: +(numHit / Math.max(1, numTotal)).toFixed(3),
      numeric_n: numTotal,
      refusal_accuracy: +(refuseHit / Math.max(1, refuseTotal)).toFixed(3),
      refusal_n: refuseTotal,
      avg_citation_coverage: +(coverageSum / Math.max(1, coverageCount)).toFixed(3),
    },
  };

  // Console table.
  console.log(`\nFinDocs AI — eval (${results.provider}/${results.model})`);
  console.log('─'.repeat(52));
  console.log('Retrieval            hit@1  hit@3  hit@5   MRR');
  const row = (label: string, m: typeof hybrid) =>
    console.log(
      `${label.padEnd(18)} ${String(m.hit_at_1).padStart(6)} ${String(m.hit_at_3).padStart(6)} ${String(m.hit_at_5).padStart(6)} ${String(m.mrr).padStart(6)}`,
    );
  row('hybrid', hybrid);
  row('vector-only', vectorOnly);
  console.log('─'.repeat(52));
  console.log(`Numeric exact-match : ${results.answers.numeric_exact_match} (n=${numTotal})`);
  console.log(`Refusal accuracy    : ${results.answers.refusal_accuracy} (n=${refuseTotal})`);
  console.log(`Avg citation cover. : ${results.answers.avg_citation_coverage}`);
  console.log('─'.repeat(52));

  const dir = join(process.cwd(), 'evals', 'results');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${results.date.slice(0, 10)}.json`);
  writeFileSync(file, JSON.stringify(results, null, 2));
  console.log(`Wrote ${file}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
