import type { Action } from '../contracts/actions.js';
import type { ActionResult } from '../contracts/results.js';
import type { CacheEntry, Invalidation, QueryRefresher } from '../contracts/queries.js';
import { resolvePath } from '@buildadiv/shared/path.js';
import { emit } from '../events.js';
import { resultFor } from '../actions/results.js';
import { cache, notify } from './entries.js';
import { persist, removePersisted } from './persistence.js';
import { defaultItems } from './policies.js';
import { sameKey } from './keys.js';

/** Read tag items from raw responses rather than template-specific context. */
function itemsFor(entry: CacheEntry): unknown[] {
  return (entry.fn.options.items || defaultItems)(entry.result?.response);
}
/** Drop affected cache state and refetch matching mounted queries after mutations. */
export async function invalidate(
  fn: Action,
  response: unknown,
  args: unknown,
  specification: Invalidation,
  refetch: QueryRefresher,
): Promise<void> {
  for (const spec of Array.isArray(specification) ? specification : [specification]) {
    const tag = typeof spec === 'string' ? spec : spec.tag;
    const id =
      typeof spec === 'string'
        ? undefined
        : spec.id
          ? spec.id(args)
          : resolvePath(response, spec.key);
    emit(fn, `invalidate:${tag}`, { args, tags: tag, id });
    const refreshes: Promise<ActionResult | void>[] = [];
    for (const entry of cache.values()) {
      if (entry.fn.options.provides?.tag !== tag) continue;
      const items = itemsFor(entry);
      if (
        id != null &&
        Array.isArray(items) &&
        !items.some((item) => sameKey(resolvePath(item, entry.fn.options.provides!.key), id))
      )
        continue;
      entry.invalidated = true;
      await removePersisted(entry);
      if (entry.listeners.size) refreshes.push(refetch(entry));
      else {
        clearTimeout(entry.unusedTimer);
        cache.delete(entry.key);
      }
    }
    await Promise.all(refreshes);
  }
}
/** Upsert a successful mutation without fetching; invalid shapes invalidate the tag. */
export async function reconcile(
  fn: Action,
  response: unknown,
  args: unknown,
  refetch: QueryRefresher,
): Promise<void> {
  const spec = fn.options.reconciles!;
  const path = spec.key.split('.');
  const id = resolvePath(response, spec.key);
  const item = resolvePath(response, path.slice(0, -1).join('.'));
  if (id == null || !item || typeof item !== 'object' || Array.isArray(item)) {
    return invalidate(fn, response, args, spec.tag, refetch);
  }
  for (const entry of cache.values()) {
    if (entry.fn.options.provides?.tag !== spec.tag) continue;
    if (!entry.listeners.size) {
      clearTimeout(entry.unusedTimer);
      cache.delete(entry.key);
      await removePersisted(entry);
      continue;
    }
    if (entry.inflight && entry.fn !== fn) await entry.inflight;
    const items = itemsFor(entry);
    if (!Array.isArray(items)) {
      await invalidate(fn, response, args, spec.tag, refetch);
      return;
    }
    const key = entry.fn.options.provides.key;
    const index = items.findIndex((existing) => sameKey(resolvePath(existing, key), id));
    if (index < 0) items.push(item);
    else items[index] = item;
    if (entry.fn.options.sort) items.sort(entry.fn.options.sort);
    // Keep page payloads consistent with the merged response for later refreshes.
    if (entry.fn.options.paginated?.mode === 'infinite') {
      let found = false;
      for (const page of entry.pages) {
        const pageItems = (entry.fn.options.items || defaultItems)(page.response);
        const position = pageItems.findIndex((existing) => sameKey(resolvePath(existing, key), id));
        if (position >= 0) {
          pageItems[position] = item;
          found = true;
        }
      }
      if (!found) {
        const tailItems = (entry.fn.options.items || defaultItems)(entry.pages.at(-1)!.response);
        if (tailItems !== items) tailItems.push(item);
      }
    }
    entry.result = resultFor(
      entry.fn,
      'success',
      entry.result!.response,
      entry.result!.context.statusCode,
      entry.args,
      entry.result!.context.nextPage,
    );
    notify(entry, entry.result);
    await persist(entry);
  }
}
