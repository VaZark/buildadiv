import { query } from '/lib/query-template.min.js';

interface Product {
  id: number;
  name: string;
  price: number;
}

/** Reads stay in api/; the page links only the standalone runtime file. */
export const loadProducts = query<unknown, Product[]>({
  url: '/api/products',
  provides: { tag: 'Product', key: 'id' },
});
