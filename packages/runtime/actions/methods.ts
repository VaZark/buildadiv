import { HttpMethod } from '../contracts/http.js';
import type { ReadMethod, MutationMethod } from '../contracts/http.js';
import type { NormalizedActionOptions } from '../contracts/actions.js';

/** Narrow an untyped method at the JavaScript boundary; typed queries already enforce this union. */
export function isReadMethod(method: string): method is ReadMethod {
  return method === HttpMethod.GET || method === HttpMethod.QUERY;
}

/** Validate standard write methods for JavaScript callers; custom methods use action(). */
export function isMutationMethod(method: string): method is MutationMethod {
  return Object.hasOwn(HttpMethod, method) && !isReadMethod(method);
}

/** Helper-built queries and baseline GET/QUERY actions read through the query cache. */
export function readsQueries(options: NormalizedActionOptions | undefined): boolean {
  if (!options) return false;
  return options.kind === 'query' || (options.kind === 'action' && isReadMethod(options.method));
}
