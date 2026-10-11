import type { Action } from '../contracts/actions.js';
import type { ActionResult } from '../contracts/results.js';
import type { CacheEntry, Subscriber } from '../contracts/queries.js';
import { executeRequest } from '../actions/request.js';
import { isProviderMethod } from '../actions/methods.js';
import { deliver, getEntry, notify } from './entries.js';
import { restore } from './persistence.js';
import { scheduleFresh, scheduleUnused } from './lifetime.js';
import { serializeArgs } from './policies.js';

/** Mount a listener and load its query; the returned cleanup releases its reference. */
export function subscribe<Args, Data>(
  fn: Action<Args, Data>,
  listener: Subscriber,
  args?: Args,
): () => void {
  const entry = getEntry(fn as Action, args);
  clearTimeout(entry.unusedTimer);
  entry.listeners.add(listener);
  if (entry.result) deliver(listener, entry.result, entry);
  load(entry, args, { initial: true });
  return () => {
    entry.listeners.delete(listener);
    if (!entry.listeners.size) {
      clearTimeout(entry.freshTimer);
      scheduleUnused(entry);
    }
  };
}
/**
 * Deduplicate concurrent callers, restore storage first, and resolve page parameters.
 * A call without arguments joins any in-flight request. Explicit arguments join
 * only a request for the same arguments; otherwise they wait and then run, so
 * selecting another page while one loads is never silently dropped.
 */
export async function load(
  entry: CacheEntry,
  args?: unknown,
  {
    initial = false,
    force = false,
    background = false,
  }: { initial?: boolean; force?: boolean; background?: boolean } = {},
): Promise<ActionResult> {
  while (entry.inflight) {
    if (args === undefined || serializeArgs(args) === serializeArgs(entry.inflightArgs))
      return entry.inflight;
    await entry.inflight.catch(() => undefined);
  }
  entry.inflightArgs = args;
  // Install the promise before awaiting storage: concurrent mounts deduplicate restores and fetches.
  const request = (entry.inflight = (async () => {
    await restore(entry);
    const fresh =
      entry.result &&
      !entry.result.context.error &&
      !entry.invalidated &&
      Date.now() - entry.updatedAt < entry.freshFor * 1000;
    if (!force && (initial || !entry.fn.options.paginated) && fresh) {
      notify(entry, entry.result!);
      scheduleFresh(entry, refresh);
      return entry.result!;
    }
    const pagination = entry.fn.options.paginated;
    if (pagination) {
      if (args === undefined) {
        if (initial) args = entry.pages.at(-1)?.args ?? pagination.firstPage;
        else if (entry.result) {
          args = entry.result.context.nextPage;
          if (!args) return entry.result;
        } else args = pagination.firstPage;
      }
    }
    entry.args = args;
    return executeRequest(
      entry.fn,
      args,
      isProviderMethod(entry.fn.options.method) && entry.fn.options.method !== 'QUERY'
        ? undefined
        : args,
      { entry, background, refetch: refresh },
    );
  })());
  try {
    return await request;
  } finally {
    // A waiting caller may already have started the next request.
    if (entry.inflight === request) {
      entry.inflight = null;
      entry.inflightArgs = undefined;
    }
    if (!entry.listeners.size) scheduleUnused(entry);
  }
}
/**
 * An explicit user request (a `data-action` trigger) wants current data, so it
 * bypasses freshness for ordinary queries. Paginated queries instead advance to
 * their next page, which is never served from the freshness check.
 */
export function reload(fn: Action): Promise<ActionResult> {
  const entry = getEntry(fn);
  return load(entry, undefined, { force: !entry.fn.options.paginated });
}
/** Refetch only mounted queries and the permitted window of infinite pages. */
export async function refresh(entry: CacheEntry): Promise<ActionResult | void> {
  if (entry.inflight) await entry.inflight;
  if (!entry.listeners.size) return;
  if (!entry.fn.options.paginated || entry.fn.options.paginated.mode === 'pages') {
    return load(entry, entry.args, { force: true, background: true });
  }
  const current = Math.min(entry.currentPage, entry.pages.length - 1);
  const first = Math.max(0, current - (entry.fn.options.paginated.refreshBehind ?? 1));
  for (let index = 0; index < first; index++) entry.pages[index].invalidated = true;
  for (let index = first; index <= current; index++)
    await load(entry, entry.pages[index].args, { force: true, background: true });
}
/** Viewport changes lazily refresh invalidated older pages before they appear. */
export async function refreshPage(entry: CacheEntry, index: number): Promise<void> {
  entry.currentPage = index;
  const first = Math.max(0, index - (entry.fn.options.paginated?.refreshBehind ?? 1));
  for (let page = first; page <= index; page++) {
    if (entry.pages[page]?.invalidated)
      await load(entry, entry.pages[page].args, { force: true, background: true });
  }
}
