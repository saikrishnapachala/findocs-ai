import { getRegistry } from '@/lib/store/registry';
import { getVectorStore } from '@/lib/store';
import { createLogger } from '@/lib/logger';

const PURGE_AFTER_MS = 24 * 60 * 60 * 1000; // 24h (PRD §7)
const SWEEP_INTERVAL_MS = 10 * 60 * 1000; // throttle: at most every 10 min

let lastSweep = 0;

/**
 * On-request purge sweep: drop sessions (and their vectors) idle for >24h.
 * Throttled so it runs at most once every 10 minutes regardless of traffic.
 * Called opportunistically from request handlers — no cron required for the
 * demo (documented upgrade path: a scheduled job).
 */
export async function maybeSweep(): Promise<void> {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;

  const purged = getRegistry().sweep(PURGE_AFTER_MS);
  if (purged.length === 0) return;

  const store = getVectorStore();
  await Promise.all(purged.map((sid) => store.clearSession(sid)));
  createLogger().info('maintenance.sweep', { purgedSessions: purged.length });
}
