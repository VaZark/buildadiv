import { fallback } from '@buildadiv/shared/filters.js';
import type { FilterRegistry } from '@buildadiv/shared/types.js';
import type { RegisteredAction, RegistrableAction } from '../contracts/actions.js';
import type { Store } from '../contracts/storage.js';

export const settings: {
  filters: FilterRegistry;
  actions: Map<string, RegisteredAction>;
  persist: Store | false;
  maxAge: number;
  buster: string;
} = {
  filters: { fallback },
  actions: new Map(),
  persist: false,
  maxAge: 86400,
  buster: '',
};

/** Bind imported functions to unique HTML/event names without exposing globals. */
export function registerActions(actions: Record<string, RegistrableAction>): void {
  for (const [name, imported] of Object.entries(actions)) {
    // HTML registration erases per-action generics; direct calls retain their types.
    const fn = imported as RegisteredAction;
    if (typeof fn !== 'function') throw new TypeError(`Action ${name} must be a function`);
    if (settings.actions.has(name) && settings.actions.get(name) !== fn)
      throw new Error(`Duplicate action: ${name}`);
    if (fn.actionName && fn.actionName !== name)
      throw new Error(`Action already registered as ${fn.actionName}`);
    Object.defineProperty(fn, 'actionName', { value: name, configurable: true });
    settings.actions.set(name, fn);
  }
}
