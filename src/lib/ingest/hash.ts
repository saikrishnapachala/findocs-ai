import { createHash } from 'node:crypto';

/** SHA-256 hex digest of the raw bytes — used for idempotent ingestion. */
export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
