import type { Action } from '../contracts/actions.js';
import type { ActionResult } from '../contracts/results.js';
import type { CacheEntry, QueryRefresher } from '../contracts/queries.js';
import { emit } from '../events.js';
import { json, multipart } from '../formats.js';
import { resultFor } from './results.js';
import { notify } from '../data/entries.js';
import { lifetime, respectCacheOr } from '../data/policies.js';
import { mergePage } from '../data/pagination.js';
import { persist, removePersisted } from '../data/persistence.js';
import { scheduleFresh } from '../data/lifetime.js';
import { reconcile, invalidate } from '../data/tags.js';

interface RequestExecution {
  entry?: CacheEntry;
  background?: boolean;
  refetch: QueryRefresher;
}

/** Own fetch, decoding, state events and cache updates outside component code. */
export async function executeRequest(
  fn: Action,
  args: unknown,
  body: unknown,
  { entry, background = false, refetch }: RequestExecution,
): Promise<ActionResult> {
  const options = fn.options;
  let timer: ReturnType<typeof setTimeout> | undefined,
    timedOut = false,
    statusCode: number | undefined;
  const controller = new AbortController();
  const detail = { args, tags: options.provides || options.invalidates || options.reconciles };
  emit(fn, 'before:request', detail);
  try {
    const pending = resultFor(fn, 'pending', null, undefined, args);
    emit(fn, 'pending', { ...detail, result: pending });
    if (entry && (!background || options.onInvalidate === 'pending')) notify(entry, pending);
    if (options.timeout != null)
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
        emit(fn, 'timeout', detail);
      }, options.timeout * 1000);
    const encoded =
      body === undefined || options.method === 'GET' || options.method === 'HEAD'
        ? {}
        : (options.send || multipart)(body);
    const response = await fetch(
      typeof options.url === 'function' ? options.url(args) : options.url,
      { method: options.method, ...encoded, signal: controller.signal },
    );
    statusCode = response.status;
    if (!response.ok) throw new Error(`HTTP ${statusCode}`);
    const empty =
      statusCode === 204 ||
      statusCode === 205 ||
      options.method === 'HEAD' ||
      (await response.clone().arrayBuffer()).byteLength === 0;
    const decoded = empty ? null : await (options.accepts || json)(response);
    const { data, nextPage } =
      entry && options.paginated && !empty
        ? mergePage(entry, args, decoded)
        : { data: decoded, nextPage: null };
    const result = resultFor(
      fn,
      empty ? 'no-content' : 'success',
      data,
      statusCode,
      args,
      nextPage,
    );
    emit(fn, 'after:request', { ...detail, result });
    if (entry) {
      entry.result = result;
      entry.updatedAt = Date.now();
      entry.invalidated = false;
      entry.noStore = /\bno-store\b/i.test(response.headers.get('cache-control') || '');
      entry.freshFor = lifetime(options.refetchAfter ?? respectCacheOr(Infinity), response.headers);
      entry.unusedFor = lifetime(
        options.keepUnusedFor ?? respectCacheOr(Infinity),
        response.headers,
      );
      if (entry.noStore) {
        entry.freshFor = 0;
        entry.unusedFor = 0;
        await removePersisted(entry);
      }
      notify(entry, result);
      await persist(entry);
      scheduleFresh(entry, refetch);
    }
    emit(fn, empty ? 'no-content' : 'success', { ...detail, result });
    if (options.reconciles) await reconcile(fn, decoded, args, refetch);
    if (options.invalidates) await invalidate(fn, decoded, args, options.invalidates, refetch);
    return result;
  } catch (error) {
    const result = resultFor(fn, 'error', null, statusCode, args);
    emit(fn, 'error', { ...detail, error, result, timedOut });
    if (entry) {
      if (!background || !entry.result || options.onRefetchFailure === 'throw') {
        entry.result = result;
        notify(entry, result);
      } else notify(entry, entry.result);
      // Retry stale data at the configured interval, without a zero-delay loop.
      entry.updatedAt = Date.now();
      scheduleFresh(entry, refetch);
    }
    return result;
  } finally {
    clearTimeout(timer);
    emit(fn, 'finally:request', detail);
  }
}
