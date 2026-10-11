import { configure, currency } from '/lib/buildadiv-runtime.min.js';
import type { RenderTemplate } from '/lib/buildadiv-runtime.min.js';
import * as actions from './api/gallery.js';

configure({ actions: { ...actions }, filters: { currency } });

/**
 * Actions that need arguments are called from ordinary listeners. The id comes
 * from the row's rendered `data-key`; the page number from a bound attribute.
 */
document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const ship = target?.closest('.ship');
  const row = ship?.closest<HTMLElement>('[data-key]');
  if (row?.dataset.key) void actions.shipOrder({ id: row.dataset.key });

  const previous = target?.closest<HTMLElement>('.previous-page');
  if (previous?.dataset.page) void actions.loadCatalogPage(Number(previous.dataset.page));
});

// A direct template has no action: assigning `.data` renders it.
document.querySelector('#fill-note')!.addEventListener('click', () => {
  document.querySelector<RenderTemplate>('#note')!.data = {
    title: 'Filled from .data',
    author: 'You',
  };
});
