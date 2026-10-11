import type { CacheEntry, QueryRefresher } from '../contracts/queries.js';
import { cache } from './entries.js';
import { removePersisted } from './persistence.js';

/** Refetch mounted data at its freshness deadline without zero-delay loops. */
export function scheduleFresh(entry: CacheEntry, refetch: QueryRefresher): void {
  clearTimeout(entry.freshTimer);
  if (
    !entry.listeners.size ||
    !entry.result ||
    entry.freshFor <= 0 ||
    !Number.isFinite(entry.freshFor)
  )
    return;
  const delay = Math.max(1, entry.updatedAt + entry.freshFor * 1000 - Date.now());
  entry.freshTimer = setTimeout(
    () => {
      if (Date.now() < entry.updatedAt + entry.freshFor * 1000) scheduleFresh(entry, refetch);
      else refetch(entry);
    },
    Math.min(delay, 2147483647),
  );
  entry.freshTimer.unref?.();
}
/** Release cache entries only after the last subscriber and retention deadline. */
export function scheduleUnused(entry: CacheEntry): void {
  clearTimeout(entry.unusedTimer);
  if (entry.listeners.size || !Number.isFinite(entry.unusedFor)) return;
  const deadline = Date.now() + Math.max(0, entry.unusedFor * 1000);
  const check = () => {
    if (entry.listeners.size) return;
    if (Date.now() < deadline) {
      entry.unusedTimer = setTimeout(check, Math.min(deadline - Date.now(), 2147483647));
      entry.unusedTimer.unref?.();
    } else if (cache.get(entry.key) === entry) {
      cache.delete(entry.key);
      removePersisted(entry);
    }
  };
  entry.unusedTimer = setTimeout(check, Math.min(Math.max(0, deadline - Date.now()), 2147483647));
  entry.unusedTimer.unref?.();
}
