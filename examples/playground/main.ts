import { configureActions } from '../../packages/runtime/index.js';
import { currency } from '../../packages/runtime/filters.js';
import * as actions from './api/playground.js';

configureActions({ filters: { currency }, actions: { ...actions } });

/** Page buttons pass arguments, so they use ordinary listeners rather than data-action. */
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-page]')) {
  button.addEventListener('click', () => void actions.loadPage(Number(button.dataset.page)));
}

/** Read the row's id the documented way: a string from the rendered data-key. */
document.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('.delete') : null;
  const row = button?.closest<HTMLElement>('[data-key]');
  if (row?.dataset.key) void actions.deleteProduct({ id: row.dataset.key });
});

/**
 * Show document events as they happen so manual checks can confirm event order,
 * for example that a broken template no longer turns success into error.
 */
const log = document.querySelector<HTMLOListElement>('#event-log')!;
const states = ['pending', 'success', 'no-content', 'error', 'timeout'];
for (const name of Object.keys(actions)) {
  for (const state of states) {
    document.addEventListener(`${name}:${state}`, () => {
      const item = document.createElement('li');
      item.textContent = `${new Date().toLocaleTimeString()}  ${name}:${state}`;
      log.prepend(item);
      while (log.children.length > 40) log.lastElementChild!.remove();
    });
  }
}
document.querySelector('#clear-log')!.addEventListener('click', () => log.replaceChildren());
