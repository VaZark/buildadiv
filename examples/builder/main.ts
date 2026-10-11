import { buildHtml } from '../../packages/builder/index.js';
import { upper, currency } from '../../packages/shared/filters.js';

// Keep source loading separate from expansion so the same builder can work with
// fetched files, file-picker input, or editor buffers without owning their I/O.
const source = await (await fetch('./source.html')).text();
const output = buildHtml(source, {
  data: {
    site: { title: 'Vanilla shop', note: 'Slots carry author-written markup.' },
    product: { name: 'Scarf', price: 25 },
  },
  filters: { upper, currency },
});
document.querySelector('iframe')!.srcdoc = output;
document.querySelector('#output')!.textContent = output;
