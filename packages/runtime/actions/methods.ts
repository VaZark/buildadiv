import { HttpMethod } from '../contracts/http.js';
import type { ProviderMethod, MutationMethod } from '../contracts/http.js';
import type { NormalizedActionOptions } from '../contracts/actions.js';

/** Narrow an untyped method at the JavaScript boundary; typed providers already enforce this union. */
export function isProviderMethod(method: string): method is ProviderMethod {
  return method === HttpMethod.GET || method === HttpMethod.QUERY;
}

/** Validate standard write methods for JavaScript callers; custom methods use action(). */
export function isMutationMethod(method: string): method is MutationMethod {
  return Object.hasOwn(HttpMethod, method) && !isProviderMethod(method);
}

/** Helper-built providers and baseline GET/QUERY actions read through the query cache. */
export function readsQueries(options: NormalizedActionOptions | undefined): boolean {
  if (!options) return false;
  return (
    options.kind === 'provider' || (options.kind === 'action' && isProviderMethod(options.method))
  );
}
