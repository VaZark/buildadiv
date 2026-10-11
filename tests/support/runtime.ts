import type { Action } from '../../packages/runtime/contracts/actions.js';
import { registerActions, settings } from '../../packages/runtime/configuration/settings.js';
import { cache } from '../../packages/runtime/data/entries.js';

let serial = 0;
export function named<Args, Data>(fn: Action<Args, Data>): Action<Args, Data> {
  registerActions({ ['test' + serial++]: fn });
  return fn;
}
export function reset() {
  for (const entry of cache.values()) {
    clearTimeout(entry.freshTimer);
    clearTimeout(entry.unusedTimer);
  }
  cache.clear();
  settings.persist = false;
  settings.buster = '';
  settings.maxAge = 86400;
}
export const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
