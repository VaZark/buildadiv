/**
 * Item ids arrive from JSON (often numbers) and from the DOM's `data-key`
 * attributes (always strings). Treat a primitive id and its string form as the
 * same item so `dataset.key` can identify cached rows; other values must be identical.
 */
export function sameKey(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return false;
  const primitive = (value: unknown): boolean =>
    typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint';
  return primitive(a) && primitive(b) ? String(a) === String(b) : a === b;
}
