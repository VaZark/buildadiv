import { HttpMethod } from '../contracts/http.js';
import type { ProviderMethod, MutationMethod } from '../contracts/http.js';

/** Narrow an untyped method at the JavaScript boundary; typed providers already enforce this union. */
export function isProviderMethod(method: string): method is ProviderMethod {
  return method === HttpMethod.GET || method === HttpMethod.QUERY;
}

/** Validate standard write methods for JavaScript callers; custom methods use action(). */
export function isMutationMethod(method: string): method is MutationMethod {
  return Object.hasOwn(HttpMethod, method) && !isProviderMethod(method);
}
