import { configureActions, currency } from '/lib/query-template.min.js';
import { loadProducts } from './api/products.js';

configureActions({ actions: { loadProducts }, filters: { currency } });
