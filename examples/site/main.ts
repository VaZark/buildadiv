import { configure, currency } from '/lib/buildadiv-runtime.min.js';
import { loadProducts } from './api/products.js';

configure({ actions: { loadProducts }, filters: { currency } });
