import { configure, currency } from '/lib/query-template.min.js';
import { loadProducts } from './api/products.js';

configure({ actions: { loadProducts }, filters: { currency } });
