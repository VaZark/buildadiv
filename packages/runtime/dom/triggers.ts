import type { Action } from '../contracts/actions.js';
import { settings } from '../configuration/settings.js';
import { readsQueries } from '../actions/methods.js';
import { reload } from '../data/queries.js';

const delegatedEvents = new Set<string>();
/** One capturing listener per trigger supports current and later-inserted action elements. */
function delegate(type: string): void {
  if (delegatedEvents.has(type)) return;
  delegatedEvents.add(type);
  document.addEventListener(
    type,
    (event) => {
      const element =
        event.target instanceof Element ? event.target.closest<HTMLElement>('[data-action]') : null;
      if (!element) return;
      const expected =
        element.getAttribute('data-on') || (element.localName === 'form' ? 'submit' : 'click');
      if (expected !== type) return;
      const fn = settings.actions.get(element.dataset.action || '');
      if (!fn) throw new Error(`Unknown action: ${element.dataset.action}`);
      if (type === 'submit' || (type === 'click' && element.localName === 'a'))
        event.preventDefault();
      if (element.localName === 'form')
        fn(
          new FormData(
            element as HTMLFormElement,
            (event as SubmitEvent).submitter as HTMLElement | null,
          ),
        );
      // A clicked provider is an explicit refresh (or "load more"), not a cached read.
      else if (readsQueries(fn.options)) reload(fn as Action);
      else fn();
    },
    true,
  );
}
/** Register custom event types declared by markup after configuration or DOM changes. */
export function scanEvents(): void {
  for (const element of document.querySelectorAll<HTMLElement>('[data-action][data-on]'))
    delegate(element.dataset.on!);
}

/** Start delegated triggers once when the public runtime entry point is imported. */
export function installTriggers(): void {
  delegate('click');
  delegate('submit');
  scanEvents();
  new MutationObserver(scanEvents).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-on'],
  });
}
