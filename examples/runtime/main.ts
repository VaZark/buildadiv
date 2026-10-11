import {
  configure,
  currency,
  date,
  lower,
  number,
  percent,
  relativeTime,
  truncate,
  upper,
} from '/lib/query-template.min.js';
import type { UseTemplate } from '/lib/query-template.min.js';
import * as actions from './api/gallery.js';

/** A project's own filter is any single-value function; its key is its name in HTML. */
const initials = (value: unknown): unknown =>
  value == null
    ? value
    : String(value)
        .split(/\s+/)
        .map((word) => word[0])
        .join('');

// Filters are opt-in: register the provided ones this page uses, plus its own.
configure({
  actions: { ...actions },
  filters: { currency, number, percent, date, relativeTime, upper, lower, truncate, initials },
  // The currency for `currency` when a pipeline names none; Intl can't infer one from a locale.
  currency: 'USD',
});

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
  document.querySelector<UseTemplate>('#note')!.data = {
    title: 'Filled from .data',
    author: 'You',
  };
});

// The filter table is a direct template too; its data is plain values to format.
document.querySelector<UseTemplate>('#filter-examples')!.data = {
  order: { total: 1234.5 },
  stock: 9876543,
  discount: 0.256,
  shipped: '2025-01-15T12:00:00',
  daysAgo: -1,
  minutesLeft: 5,
  customer: {
    name: 'Ada Lovelace',
    nickname: null,
    profile: 'HTTPS://EXAMPLE.COM/Ada',
    city: 'istanbul',
  },
  review: 'Lovely scarf, arrived quickly and well packed.',
};
