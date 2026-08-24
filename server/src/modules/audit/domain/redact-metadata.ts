const SENSITIVE_KEY =
  /(?:password|passwd|secret|token|authorization|cookie|credential|private.?key)/i;
const MAX_DEPTH = 6;
const MAX_ARRAY_ITEMS = 50;
const REDACTED = '[REDACTED]';

function redact(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (depth > MAX_DEPTH) return '[MAX_DEPTH]';
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => redact(item, depth + 1, seen));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? REDACTED : redact(item, depth + 1, seen),
    ]),
  );
}

export function redactAuditMetadata(
  metadata: Record<string, unknown> = {},
): Record<string, unknown> {
  return redact(metadata, 0, new WeakSet()) as Record<string, unknown>;
}
