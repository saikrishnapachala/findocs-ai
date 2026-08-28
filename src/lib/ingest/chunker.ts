import type { Chunk, PageText } from '@/lib/types';
import { splitSentences } from '@/lib/text';
import { countTokens } from './tokens';

export interface ChunkOptions {
  /** Target chunk size in tokens (default 800, per PRD F1.3). */
  targetTokens?: number;
  /** Overlap as a fraction of target (default 0.15). */
  overlapRatio?: number;
}

/** A sentence-sized unit tagged with its page and char span in the joined doc. */
interface Unit {
  text: string;
  page: number;
  start: number;
  end: number;
  tokens: number;
}

/**
 * Recursive-ish, sentence-aware chunker.
 *
 * Strategy: flatten pages into sentence units (never splitting mid-sentence
 * unless a single sentence exceeds the target, in which case it is token-window
 * split). Greedily pack units up to `targetTokens`, then start the next chunk
 * seeded with trailing units worth ~`overlapRatio * targetTokens` tokens so
 * context carries across boundaries. Each chunk records the page range and the
 * character span it covers.
 */
export function chunkPages(
  documentId: string,
  pages: PageText[],
  options: ChunkOptions = {},
): Chunk[] {
  const targetTokens = options.targetTokens ?? 800;
  const overlapRatio = options.overlapRatio ?? 0.15;
  const overlapTokens = Math.max(0, Math.round(targetTokens * overlapRatio));

  const units = buildUnits(pages, targetTokens);
  if (units.length === 0) return [];

  const chunks: Chunk[] = [];
  let current: Unit[] = [];
  let currentTokens = 0;
  let chunkIndex = 0;

  const flush = () => {
    if (current.length === 0) return;
    chunks.push(makeChunk(documentId, chunkIndex, current));
    chunkIndex++;
  };

  for (const unit of units) {
    if (currentTokens + unit.tokens > targetTokens && current.length > 0) {
      flush();
      // Seed the next chunk with overlap units from the tail of the last one.
      const seed = takeOverlap(current, overlapTokens);
      current = [...seed];
      currentTokens = seed.reduce((s, u) => s + u.tokens, 0);
    }
    current.push(unit);
    currentTokens += unit.tokens;
  }
  flush();

  return chunks;
}

function buildUnits(pages: PageText[], targetTokens: number): Unit[] {
  const units: Unit[] = [];
  let offset = 0;
  for (const page of pages) {
    const sentences = splitSentences(page.text);
    for (const sentence of sentences) {
      const tokens = countTokens(sentence);
      if (tokens <= targetTokens) {
        units.push({
          text: sentence,
          page: page.page,
          start: offset,
          end: offset + sentence.length,
          tokens,
        });
        offset += sentence.length + 1; // +1 for the joining space
      } else {
        // Rare: a single "sentence" longer than a whole chunk. Hard-split it
        // into word windows so we never emit an over-budget chunk.
        for (const piece of splitLongText(sentence, targetTokens)) {
          units.push({
            text: piece,
            page: page.page,
            start: offset,
            end: offset + piece.length,
            tokens: countTokens(piece),
          });
          offset += piece.length + 1;
        }
      }
    }
  }
  return units;
}

/** Split an over-long string into word windows each ≤ targetTokens. */
function splitLongText(text: string, targetTokens: number): string[] {
  const words = text.split(' ');
  const pieces: string[] = [];
  let buf: string[] = [];
  for (const word of words) {
    buf.push(word);
    if (countTokens(buf.join(' ')) >= targetTokens) {
      pieces.push(buf.join(' '));
      buf = [];
    }
  }
  if (buf.length > 0) pieces.push(buf.join(' '));
  return pieces;
}

/** Take trailing units summing to ≤ overlapTokens, preserving order. */
function takeOverlap(units: Unit[], overlapTokens: number): Unit[] {
  if (overlapTokens <= 0) return [];
  const seed: Unit[] = [];
  let total = 0;
  for (let i = units.length - 1; i >= 0; i--) {
    const u = units[i]!;
    if (total + u.tokens > overlapTokens && seed.length > 0) break;
    seed.unshift(u);
    total += u.tokens;
  }
  return seed;
}

function makeChunk(documentId: string, chunkIndex: number, units: Unit[]): Chunk {
  const content = units.map((u) => u.text).join(' ');
  const first = units[0]!;
  const last = units[units.length - 1]!;
  return {
    id: `${documentId}:${chunkIndex}`,
    documentId,
    chunkIndex,
    pageStart: first.page,
    pageEnd: last.page,
    content,
    tokenCount: countTokens(content),
    charStart: first.start,
    charEnd: last.end,
  };
}
