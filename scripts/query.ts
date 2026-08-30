/**
 * Retrieval CLI — seeds the sample documents into an in-process session and
 * prints the top passages for a query, with their fused / vector / lexical
 * scores. Demonstrates the M2 pipeline without the web layer.
 *
 *   npm run query -- "What was total revenue in fiscal 2024?"
 *   HYBRID_RETRIEVAL=false npm run query -- "..."   # vector-only A/B
 */
import { seedSampleDocuments } from '@/lib/seed/seed';
import { retrieve } from '@/lib/retrieval/retrieve';
import { getConfig } from '@/lib/config';

async function main() {
  const query = process.argv.slice(2).join(' ').trim() || process.env.Q || '';
  if (!query) {
    console.error('Usage: npm run query -- "your question"');
    process.exit(1);
  }

  const cfg = getConfig();
  const sessionId = 'cli-session';
  await seedSampleDocuments(sessionId);

  const results = await retrieve({ sessionId, query, k: 5 });

  console.log(`\nQuery: ${query}`);
  console.log(
    `provider=${cfg.provider} hybrid=${cfg.hybridRetrieval} mmr=${cfg.mmrEnabled}\n`,
  );
  if (results.length === 0) {
    console.log('No results.');
    return;
  }
  results.forEach((r, i) => {
    const page =
      r.pageStart === r.pageEnd ? `p.${r.pageStart}` : `pp.${r.pageStart}-${r.pageEnd}`;
    const vec = r.vectorScore === null ? '  —  ' : r.vectorScore.toFixed(3);
    const fts = r.ftsRank === null ? '  —  ' : r.ftsRank.toFixed(3);
    console.log(
      `[${i + 1}] fused=${r.fused.toFixed(4)} vec=${vec} bm25=${fts}  (${r.documentName}, ${page})`,
    );
    console.log(`    ${r.content.slice(0, 160).replace(/\s+/g, ' ')}…\n`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
