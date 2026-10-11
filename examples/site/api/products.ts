import { provider } from '/lib/buildadiv-runtime.min.js';

interface Product {
  id: number;
  name: string;
  price: number;
}

/** Reads stay in api/; the page links only the standalone runtime file. */
export const loadProducts = provider<unknown, Product[]>({
  url: '/api/products',
  provides: { tag: 'Product', key: 'id' },
});
