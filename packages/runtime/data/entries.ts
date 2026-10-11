import type { Action } from '../contracts/actions.js';
import type { ActionResult } from '../contracts/results.js';
import type { CacheEntry, Subscriber } from '../contracts/queries.js';
import { serializeArgs } from './policies.js';
import { reportFailure } from '../events.js';

// The registry belongs to the data layer, not the public freshness-policy module.
export const cache = new Map<string, CacheEntry>();

/**
 * Deliver a result to one subscriber. A failing subscriber (for example, a
 * template with duplicate keys) is reported without stopping other subscribers
 * or changing the request's outcome.
 */
export function deliver(listener: Subscriber, result: ActionResult, entry: CacheEntry): void {
  try {
    listener(result, entry);
  } catch (error) {
    reportFailure(error);
  }
}
/** Broadcast one cached result so mounted regions share a consistent response. */
export function notify(entry: CacheEntry, result: ActionResult): void {
  for (const listener of entry.listeners) deliver(listener, result, entry);
}
/** Share a query by registered action and stable args; paginated queries share a sequence. */
export function getEntry<Args, Data>(fn: Action<Args, Data>, args?: Args): CacheEntry {
  return getErasedEntry(fn as unknown as Action, args);
}

function getErasedEntry(fn: Action, args?: unknown): CacheEntry {
  const key = `${fn.actionName || fn.options.event || fn.name}:${fn.options.paginated ? 'pages' : serializeArgs(args)}`;
  let entry = cache.get(key);
  if (entry && entry.fn !== fn) throw new Error(`Actions need unique registered names: ${key}`);
  if (!entry) {
    entry = {
      key,
      fn,
      args,
      listeners: new Set(),
      result: null,
      pages: [],
      currentPage: 0,
      updatedAt: 0,
      freshFor: Infinity,
      unusedFor: Infinity,
      restored: false,
      invalidated: false,
    };
    cache.set(key, entry);
  }
  return entry;
}
