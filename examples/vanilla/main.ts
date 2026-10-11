import { configure } from '../../packages/runtime/index.js';
import { currency } from '../../packages/runtime/filters.js';
import { loadProducts, renameProduct, importProducts } from './api/products.js';
configure({ filters: { currency }, actions: { loadProducts, renameProduct, importProducts } });
document
  .querySelector('#rename')!
  .addEventListener('click', () => renameProduct({ id: 1, name: 'Renamed scarf' }));
