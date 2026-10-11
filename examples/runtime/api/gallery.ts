import { mutation, provider } from '/lib/buildadiv-runtime.min.js';

interface LineItem {
  sku: string;
  name: string;
  quantity: number;
}
interface Order {
  id: number;
  customer: string;
  total: number;
  shipped: boolean;
  tags: string[];
  items: LineItem[];
}
interface CatalogItem {
  sku: string;
  name: string;
  price: number;
}
interface CatalogPage {
  items: CatalogItem[];
  page: number;
  pages: number;
  total: number;
}

/** Success after a visible delay. Context turns the response into template-ready flags. */
export const loadOrders = provider<unknown, Order[]>({
  url: '/api/orders?delay=700',
  provides: { tag: 'Order', key: 'id' },
  context: (response) => ({
    count: response?.length ?? 0,
    hasOpen: response?.some((order) => !order.shipped) ?? false,
  }),
});

/** A 204 response: the no-content state. */
export const loadNoOrders = provider({ url: '/api/orders/none?delay=500' });

/** An HTTP 503: the error state, with a hint computed in context. */
export const loadOutage = provider({
  url: '/api/outage?delay=500',
  context: (_response, status) => ({
    hint: status === 503 ? 'The orders service is down. Try again shortly.' : null,
  }),
});

/** Slower than its 0.1 s timeout: the error state without a status code. */
export const loadTooSlow = provider({ url: '/api/slow', timeout: 0.1 });

/** Marks one order shipped; its response is reconciled into every list showing it. */
export const shipOrder = mutation<{ id: string }, Order>({
  url: (args) => `/api/orders/${args.id}/ship`,
  reconciles: { tag: 'Order', key: 'id' },
});

/** Reopens every order; invalidating the tag makes every subscribed region refetch. */
export const reopenOrders = mutation({ url: '/api/orders/reopen', invalidates: 'Order' });

/** One page at a time: next/previous replace the page shown. */
export const loadCatalogPage = provider<number, CatalogPage>({
  url: (page) => `/api/catalog?page=${page}&size=3&delay=300`,
  items: (response) => response.items,
  paginated: {
    mode: 'pages',
    firstPage: 1,
    nextPage: (response, page) => (page < response.pages ? page + 1 : null),
  },
  context: (response) => ({
    page: response?.page ?? 1,
    pages: response?.pages ?? 1,
    previousPage: response && response.page > 1 ? response.page - 1 : null,
  }),
});

/** Pages accumulate: "Load more" appends the next page to one growing list. */
export const loadCatalogFeed = provider<number, CatalogPage>({
  url: (page) => `/api/catalog?page=${page}&size=3&delay=300`,
  provides: { tag: 'Catalog', key: 'sku' },
  items: (response) => response.items,
  merge: (cached, page) => ({ ...page, items: [...cached.items, ...page.items] }),
  paginated: {
    mode: 'infinite',
    firstPage: 1,
    nextPage: (response, page) => (page < response.pages ? page + 1 : null),
  },
  context: (response) => ({ shown: response?.items.length ?? 0, total: response?.total ?? 0 }),
});
