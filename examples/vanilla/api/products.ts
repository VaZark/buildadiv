import { query, mutation } from '../../../packages/runtime/action.js';
import { json } from '../../../packages/runtime/formats.js';
interface Product {
  id: number;
  name: string;
  price: number;
  inStock: boolean;
}

/** Reads stay in api/ and provide ids for live list reconciliation. */
export const loadProducts = query<unknown, Product[]>({
  url: '/api/products',
  provides: { tag: 'Product', key: 'id' },
});
export const renameProduct = mutation<{ id: number; name: string }, Product>({
  method: 'PUT',
  url: (args) => `/api/products/${args.id}`,
  send: json,
  reconciles: { tag: 'Product', key: 'id' },
});
export const importProducts = mutation({ url: '/api/import', invalidates: 'Product' });
