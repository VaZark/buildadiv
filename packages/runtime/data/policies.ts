import type { CacheLifetime } from '../contracts/queries.js';

/** Follow HTTP freshness headers, using the supplied age only when headers are absent. */
export const respectCacheOr =
  (fallback = Infinity): ((headers: Headers) => number) =>
  (headers) => {
    const control = headers.get('cache-control') || '';
    if (/\bno-store\b|\bno-cache\b/i.test(control)) return 0;
    const maxAge = /(?:^|,)\s*max-age\s*=\s*"?(\d+)/i.exec(control);
    if (maxAge) return Math.max(0, Number(maxAge[1]) - Number(headers.get('age') || 0));
    const expires = Date.parse(headers.get('expires') || '');
    if (Number.isFinite(expires)) return Math.max(0, (expires - Date.now()) / 1000);
    return fallback;
  };
/** Plain-array APIs need no envelope-specific item selector. */
export const defaultItems = (response: unknown): unknown[] => response as unknown[];
/** Accumulate plain-array pages; envelope APIs supply their own merge function. */
export const mergeInfinite = (cached: unknown, page: unknown): unknown[] => [
  ...((cached || []) as unknown[]),
  ...(page as unknown[]),
];
/** Pages mode shows only the newly selected page. */
export const mergePages = (_cached: unknown, page: unknown): unknown => page;
/** Stable object-key ordering lets equivalent arguments share one cache entry. */
export function serializeArgs(args: unknown): string {
  if (args === undefined) return '';
  const seen = new Set<object>();
  function normalize(value: unknown): unknown {
    if (!value || typeof value !== 'object') return value;
    if ('toJSON' in value && typeof value.toJSON === 'function') return normalize(value.toJSON());
    if (typeof FormData !== 'undefined' && value instanceof FormData)
      return Array.from(value.entries()).map(([key, entry]) => [key, normalize(entry)]);
    if (seen.has(value)) throw new TypeError('Action arguments must not contain cycles');
    seen.add(value);
    const result = Array.isArray(value)
      ? value.map(normalize)
      : Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, normalize((value as Record<string, unknown>)[key])]),
        );
    seen.delete(value);
    return result;
  }
  return JSON.stringify(normalize(args)) ?? '';
}
/** Resolve either an explicit duration or a header-based freshness function. */
export function lifetime(option: CacheLifetime, headers: Headers): number {
  return typeof option === 'function' ? option(headers) : option;
}
