import type { CacheEntry } from '../contracts/queries.js';
import { settings } from '../configuration/settings.js';
import { resultFor, stateOf } from '../actions/results.js';

/** Resolve per-action overrides before falling back to global persistence. */
function storage(entry: CacheEntry) {
  return entry.fn.options.persist ?? settings.persist;
}
/** Save successful cache state; storage failures must not block the live page. */
export async function persist(entry: CacheEntry): Promise<void> {
  const store = storage(entry);
  if (!store || entry.noStore || !entry.result || entry.result.context.error) return;
  try {
    await store.set(entry.key, {
      response: entry.result.response,
      statusCode: entry.result.context.statusCode,
      state: stateOf(entry.result),
      savedAt: entry.updatedAt,
      buster: settings.buster,
      freshFor: Number.isFinite(entry.freshFor) ? entry.freshFor : null,
      unusedFor: Number.isFinite(entry.unusedFor) ? entry.unusedFor : null,
      pages: entry.pages,
      nextPage: entry.result.context.nextPage,
    });
  } catch {
    /* Storage may be unavailable or full; memory caching still works. */
  }
}
/** Best-effort deletion prevents invalidated data from returning on reload. */
export async function removePersisted(entry: CacheEntry): Promise<void> {
  try {
    const store = storage(entry);
    if (store) await store.remove(entry.key);
  } catch {
    /* Best effort. */
  }
}
/** Restore once per entry, rejecting data with an expired age or version buster. */
export async function restore(entry: CacheEntry): Promise<void> {
  if (entry.restored) return;
  entry.restored = true;
  const store = storage(entry);
  if (!store) return;
  try {
    const saved = await store.get(entry.key);
    if (!saved) return;
    if (saved.buster !== settings.buster || Date.now() - saved.savedAt > settings.maxAge * 1000) {
      await store.remove(entry.key);
      return;
    }
    entry.updatedAt = saved.savedAt;
    entry.freshFor = saved.freshFor ?? Infinity;
    entry.unusedFor = saved.unusedFor ?? Infinity;
    entry.pages = saved.pages || [];
    entry.result = resultFor(
      entry.fn,
      saved.state,
      saved.response,
      saved.statusCode,
      entry.args,
      saved.nextPage,
    );
  } catch {
    /* An unavailable store must not prevent a network request. */
  }
}
