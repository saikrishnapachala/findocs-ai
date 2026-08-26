/**
 * In-memory daily spend tracker for the demo's hard cost cap.
 *
 * Limitation: per serverless instance, resets on cold start. That is acceptable
 * for a demo guardrail (worst case a few instances each spend up to the cap).
 * A production version would use Redis/Upstash with an atomic counter — noted in
 * DECISIONS and the README "what I'd do next".
 */

let day = utcDay();
let spentUsd = 0;

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function rollover(): void {
  const today = utcDay();
  if (today !== day) {
    day = today;
    spentUsd = 0;
  }
}

export function addSpend(usd: number): void {
  rollover();
  if (usd > 0) spentUsd += usd;
}

export function getSpendTodayUsd(): number {
  rollover();
  return spentUsd;
}

export function isOverDailyCap(maxDailyUsd: number): boolean {
  rollover();
  return spentUsd >= maxDailyUsd;
}

/** Test-only reset. */
export function __resetSpend(): void {
  day = utcDay();
  spentUsd = 0;
}
