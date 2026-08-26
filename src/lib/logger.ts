/**
 * Minimal structured JSON logger with a request_id woven through.
 *
 * Conventions §4 requires a request_id propagated frontend -> API -> LLM call,
 * and that raw API keys never appear in logs. We only ever log metadata we
 * construct ourselves, so there is nothing to redact here by accident.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

export interface LogFields {
  [key: string]: unknown;
}

export function newRequestId(): string {
  // Not security-sensitive; a short random id is enough to correlate logs.
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  ).toLowerCase();
}

function emit(level: Level, requestId: string, msg: string, fields?: LogFields) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    request_id: requestId,
    msg,
    ...fields,
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export interface Logger {
  requestId: string;
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
}

export function createLogger(requestId = newRequestId()): Logger {
  return {
    requestId,
    debug: (m, f) => emit('debug', requestId, m, f),
    info: (m, f) => emit('info', requestId, m, f),
    warn: (m, f) => emit('warn', requestId, m, f),
    error: (m, f) => emit('error', requestId, m, f),
  };
}
