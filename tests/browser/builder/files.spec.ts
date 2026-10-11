import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/support/builder.html');
});

test('buildPage renders file components and marks their assets for the global build', async ({
  page,
}) => {
  const loaded: string[] = [];
  page.on('request', (request) => loaded.push(new URL(request.url()).pathname));
  const result = await page.evaluate(async () => {
    const { buildPage, componentFolder, parseHtml, siteAssets } =
      await import('/packages/builder/index.js');
    const loadComponent = componentFolder('/tests/support/components/');
    const shop = await buildPage(
      `<!doctype html><html><head><link rel="stylesheet" href="/site.css"></head><body>
        <greeting-card><span slot="title">Built</span></greeting-card>
        <greeting-card><span slot="title">Twice</span></greeting-card>
        <render-template subscribe-to-action="loadStatus" on-success="status-badge"></render-template>
        <mystery-widget>Keep me</mystery-widget>
      </body></html>`,
      { loadComponent },
    );
    const about = await buildPage(
      '<!doctype html><html><head></head><body><greeting-card></greeting-card></body></html>',
      { loadComponent },
    );
    const plain = await buildPage('<!doctype html><html><body><p>No components</p></body></html>', {
      loadComponent,
    });
    const doc = parseHtml(shop.html);
    return {
      headings: Array.from(doc.querySelectorAll('article h2'), (heading) => heading.textContent),
      scope: doc.querySelector<HTMLElement>('article')!.dataset.c,
      tags: doc.querySelectorAll('greeting-card').length,
      shipped: Array.from(
        doc.querySelectorAll<HTMLTemplateElement>('template[data-component]'),
        (template) => template.dataset.component,
      ),
      // The page keeps only its own links; component files are never added to it.
      styles: Array.from(doc.querySelectorAll('link'), (link) => link.getAttribute('href')),
      scripts: doc.querySelectorAll('script').length,
      unknown: doc.querySelector('mystery-widget')!.textContent,
      usage: shop.components,
      plain: plain.components,
      site: siteAssets([shop, about, plain]),
    };
  });
  const folder = '/tests/support/components';
  expect(result).toEqual({
    headings: ['Built', 'Twice'],
    scope: 'greeting-card',
    tags: 0,
    // Rendered at build time, so not shipped; the runtime-rendered badge is shipped.
    shipped: ['status-badge'],
    styles: ['/site.css'],
    scripts: 0,
    unknown: 'Keep me',
    // Both tag and runtime use count; unknown elements are not components.
    usage: [
      {
        name: 'greeting-card',
        styles: [`${folder}/greeting-card/greeting-card.css`],
        scripts: [`${folder}/greeting-card/greeting-card.js`],
      },
      { name: 'status-badge', styles: [`${folder}/status-badge/status-badge.css`], scripts: [] },
    ],
    plain: [],
    // Merged across pages, each file once, in first-use order.
    site: {
      styles: [
        `${folder}/greeting-card/greeting-card.css`,
        `${folder}/status-badge/status-badge.css`,
      ],
      scripts: [`${folder}/greeting-card/greeting-card.js`],
    },
  });
  expect(loaded.filter((path) => path.endsWith('greeting-card.html'))).toHaveLength(2);
  // Building only reads component files; it never runs their behavior or the runtime.
  expect(loaded.some((path) => path.endsWith('.js') && path.includes('/components/'))).toBe(false);
  expect(loaded.some((path) => path.includes('/runtime/'))).toBe(false);
});

test('buildPage bundles a page under project and page prefixes and links only the bundle', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { buildPage, componentFolder, parseHtml } = await import('/packages/builder/index.js');
    type Request = { name: string; styles: string[]; scripts: string[] };
    const requests: Request[] = [];
    const bundler = async (request: Request) => {
      requests.push(request);
      return {
        css: { fileName: `${request.name}.min.css`, code: '.x{}' },
        ...(request.scripts.length && { js: { fileName: `${request.name}.min.js`, code: 'x()' } }),
      };
    };
    const loadComponent = componentFolder('/tests/support/components/');
    const source = `<!doctype html><html><head><link rel="stylesheet" href="/site.css"></head><body>
      <greeting-card></greeting-card>
      <render-template on-success="status-badge"></render-template></body></html>`;
    const home = await buildPage(source, {
      loadComponent,
      bundle: { bundler, project: 'shop', page: 'home' },
    });
    const custom = await buildPage(source, {
      loadComponent,
      bundle: {
        bundler,
        project: 'shop',
        page: 'about',
        name: ({ project, page }) => `${page}.${project}`,
        base: '/static',
      },
    });
    const empty = await buildPage('<!doctype html><html><head></head><body></body></html>', {
      loadComponent,
      bundle: { bundler, project: 'shop', page: 'plain' },
    });
    let invalid = 'no error';
    try {
      await buildPage(source, {
        loadComponent,
        bundle: { bundler, project: 'shop', page: '../escape' },
      });
    } catch (error) {
      invalid = error instanceof Error ? error.message : String(error);
    }
    const head = (html: string) =>
      Array.from(
        parseHtml(html).head.querySelectorAll('link, script'),
        (element) => element.getAttribute('href') ?? element.getAttribute('src'),
      );
    return {
      requests,
      home: { head: head(home.html), files: home.bundle },
      custom: head(custom.html),
      empty: { head: head(empty.html), files: empty.bundle },
      invalid,
    };
  });
  const folder = '/tests/support/components';
  expect(result.requests[0]).toEqual({
    name: 'shop-home',
    styles: [
      `${folder}/greeting-card/greeting-card.css`,
      `${folder}/status-badge/status-badge.css`,
    ],
    scripts: [`${folder}/greeting-card/greeting-card.js`],
  });
  expect(result.home).toEqual({
    // The page's own styles first; then one unified stylesheet and script for the page.
    head: ['/site.css', '/assets/shop-home.min.css', '/assets/shop-home.min.js'],
    files: {
      css: { fileName: 'shop-home.min.css', code: '.x{}' },
      js: { fileName: 'shop-home.min.js', code: 'x()' },
    },
  });
  expect(result.custom).toEqual([
    '/site.css',
    '/static/about.shop.min.css',
    '/static/about.shop.min.js',
  ]);
  // Nothing to bundle: no request, no files, no links.
  expect(result.requests).toHaveLength(2);
  expect(result.empty).toEqual({ head: [], files: {} });
  expect(result.invalid).toBe('Invalid bundle name: shop-../escape');
});
