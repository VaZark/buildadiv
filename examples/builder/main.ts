import { buildPage, componentFolder, siteAssets } from '../../packages/builder/index.js';
import { upper, currency } from '../../packages/shared/filters.js';

// Keep source loading separate from expansion so the same builder can work with
// fetched files, file-picker input, or editor buffers without owning their I/O.
const source = await (await fetch('./source.html')).text();
const page = await buildPage(source, {
  // Components live in folders; only the ones this page uses are loaded and recorded.
  loadComponent: componentFolder('/examples/builder/components/'),
  data: {
    site: { title: 'Vanilla shop', note: 'Slots carry author-written markup.' },
    product: { name: 'Scarf', price: 25 },
  },
  filters: { upper, currency },
});
document.querySelector('iframe')!.srcdoc = page.html;
document.querySelector('#output')!.textContent = page.html;
// A site build merges every page's usage; here the site has a single page.
document.querySelector('#assets')!.textContent = JSON.stringify(siteAssets([page]), null, 2);
