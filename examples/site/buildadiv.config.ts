import type { SiteOptions } from '../../packages/builder/node/site.js';
import { currency, upper } from '../../packages/shared/filters.js';

// Built with: node dist/packages/builder/node/cli.js build --config dist/examples/site/buildadiv.config.js
// `root` and `outDir` resolve against this file (its compiled copy in dist/).
const config: SiteOptions = {
  root: '.',
  outDir: '../site-output',
  // Served by `npm run serve-examples` under this path rather than at the site root.
  base: '/examples/site-output/',
  project: 'shop',
  data: { site: { title: 'Vanilla shop' }, featured: { name: 'Scarf', price: 25 } },
  filters: { currency, upper },
};
export default config;
