import { query, mutation } from '../../../packages/runtime/action.js';

interface Product {
  id: number;
  name: string;
  price: number;
  inStock: boolean;
}
interface PageRow {
  id: number;
  name: string;
}

/** Products feed both the refresh and the string-id deletion scenarios. */
export const loadProducts = query<unknown, Product[]>({
  url: '/api/products',
  provides: { tag: 'Product', key: 'id' },
});

// #region docs:invalidate-item
/** Ids arrive from `dataset.key` as strings; invalidation must still match numeric ids. */
export const deleteProduct = mutation<{ id: string }>({
  method: 'DELETE',
  url: (args) => `/api/products/${args.id}`,
  invalidates: { tag: 'Product', id: (args) => args.id },
});
// #endregion

/** Restores the demo data; the subscribed product list refetches through its tag. */
export const resetDemo = mutation({ url: '/api/reset', invalidates: 'Product' });

/** Request counts per URL, turned into list rows by context (which also runs while pending). */
export const loadCalls = query<unknown, Record<string, number>>({
  url: '/api/calls',
  context: (response) => ({
    rows: Object.entries(response ?? {}).map(([path, count]) => ({ path, count })),
  }),
});

/** A slow pages-mode query, so a second page can be selected mid-request. */
export const loadPage = query<number, PageRow[]>({
  url: (page) => `/api/pages?page=${page}&delay=800`,
  paginated: { mode: 'pages', firstPage: 1, nextPage: (_response, page) => page + 1 },
});

/** Context is evaluated in every state, so it describes pending and success alike. */
export const loadStatus = query<unknown, Record<string, never>>({
  url: '/api/slow',
  context: (response, status) => ({
    phase: response ? `loaded with HTTP ${status}` : 'waiting for the server',
  }),
});

/** Error templates read the same user-defined context fields. */
export const loadFailure = query({
  url: '/api/error',
  context: (_response, status) => ({ hint: `The server answered ${status ?? 'nothing'}` }),
});

/** Careless context code throws while pending; the runtime reports it and keeps going. */
export const loadCareless = query<unknown, Record<string, never>>({
  url: '/api/slow',
  context: (response) => ({ fields: Object.keys(response!).length }),
});

/** Two regions share this query; one has a broken template (duplicate list keys). */
export const loadBrokenRows = query<unknown, Product[]>({ url: '/api/products' });
