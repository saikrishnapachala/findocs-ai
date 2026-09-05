import { describe, it, expect } from 'vitest';
import { splitSentences, keywords, tokenizeWords } from './text';

describe('splitSentences', () => {
  it('splits on sentence boundaries', () => {
    expect(splitSentences('Revenue rose. Costs fell. Margin grew.')).toEqual([
      'Revenue rose.',
      'Costs fell.',
      'Margin grew.',
    ]);
  });

  it('does not drop text around decimals or currency (regression)', () => {
    const text =
      'Total revenue was $1,250.4 million. R&D was $138.5 million, or 11.1% of revenue.';
    const sentences = splitSentences(text);
    const joined = sentences.join(' ');
    expect(joined).toContain('$1,250.4 million');
    expect(joined).toContain('$138.5 million');
    expect(joined).toContain('11.1%');
    // No characters lost: every non-space char survives.
    expect(joined.replace(/\s/g, '')).toBe(text.replace(/\s/g, ''));
  });

  it('does not split mid-abbreviation like "U.S. dollar"', () => {
    const sentences = splitSentences('A strong U.S. dollar reduces revenue.');
    expect(sentences).toHaveLength(1);
  });
});

describe('keywords', () => {
  it('drops stopwords and short tokens', () => {
    expect(keywords('What was the total revenue?')).toEqual(['total', 'revenue']);
  });
  it('keeps numeric tokens', () => {
    expect(tokenizeWords('2024 revenue')).toContain('2024');
  });
  it('strips trailing punctuation so end-of-sentence terms match (regression)', () => {
    // "copay." must tokenize to "copay", or keyword/BM25 matching misses it.
    expect(tokenizeWords('have a $15 copay.')).toContain('copay');
    expect(tokenizeWords('the U.S. market')).toContain('u.s');
  });
});
