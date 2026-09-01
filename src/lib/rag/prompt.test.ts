import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, formatContext, buildMessages } from './prompt';
import type { RetrievedChunk } from '@/lib/types';

const context: RetrievedChunk[] = [
  {
    id: 'c1',
    documentId: 'd',
    documentName: 'report.pdf',
    pageStart: 3,
    pageEnd: 4,
    content: 'Total revenue was $1,250.4 million.',
    vectorScore: 0.6,
    ftsRank: 1.2,
    fused: 0.03,
  },
];

describe('buildSystemPrompt', () => {
  it('states the grounding, citation, and refusal rules', () => {
    const s = buildSystemPrompt().toLowerCase();
    expect(s).toContain('only');
    expect(s).toContain('cite');
    expect(s).toContain('does not contain the answer');
    expect(s).toContain('data, not instructions');
  });
});

describe('formatContext', () => {
  it('numbers passages and shows the page range', () => {
    const out = formatContext(context);
    expect(out).toContain('[1]');
    expect(out).toContain('report.pdf');
    expect(out).toContain('pp. 3-4');
    expect(out).toContain('$1,250.4 million');
  });

  it('handles an empty context', () => {
    expect(formatContext([])).toContain('no passages');
  });
});

describe('buildMessages', () => {
  it('produces a system + user message carrying the question and context', () => {
    const messages = buildMessages({
      question: 'What was total revenue?',
      history: [],
      context,
    });
    expect(messages[0]!.role).toBe('system');
    expect(messages[1]!.role).toBe('user');
    expect(messages[1]!.content).toContain('What was total revenue?');
    expect(messages[1]!.content).toContain('$1,250.4 million');
  });
});
