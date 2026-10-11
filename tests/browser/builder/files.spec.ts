import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/support/builder.html');
});

const folder = '/tests/support/components';
const greetingCard = {
  name: 'greeting-card',
  style: `${folder}/greeting-card/greeting-card.css`,
  script: `${folder}/greeting-card/greeting-card.js`,
};
// status-badge has a stylesheet but no behavior module: only existing files are picked up.
const statusBadge = { name: 'status-badge', style: `${folder}/status-badge/status-badge.css` };

test('buildPage renders folder components and reports the files beside each template', async ({
  page,
}) => {
  const loaded: string[] = [];
  page.on('request', (request) =>
    loaded.push(`${request.method()} ${new URL(request.url()).pathname}`),
  );
  const result = await page.evaluate(async () => {
    const { buildPage, componentFolder, parseHtml, siteComponents } =
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
      // The runtime adds no scope, so the shipped component template carries it already.
      shippedScope: doc
        .querySelector<HTMLTemplateElement>('template[data-component="status-badge"]')!
        .content.querySelector<HTMLElement>('.badge')!.dataset.c,
      // Without bundling the page keeps only its own links.
      links: Array.from(doc.querySelectorAll('link'), (link) => link.getAttribute('href')),
      scripts: doc.querySelectorAll('script').length,
      unknown: doc.querySelector('mystery-widget')!.textContent,
      usage: shop.components,
      plain: plain.components,
      site: siteComponents([shop, about, plain]),
    };
  });
  expect(result).toEqual({
    headings: ['Built', 'Twice'],
    scope: 'greeting-card',
    tags: 0,
    // Rendered at build time, so not shipped; the runtime-rendered badge is shipped.
    shipped: ['status-badge'],
    shippedScope: 'status-badge',
    links: ['/site.css'],
    scripts: 0,
    unknown: 'Keep me',
    // Tag and runtime uses both count; unknown elements are not components.
    usage: [greetingCard, statusBadge],
    plain: [],
    // Merged across pages, each component once, in first-use order.
    site: [greetingCard, statusBadge],
  });
  expect(loaded.filter((entry) => entry.endsWith('greeting-card.html'))).toHaveLength(2);
  // Optional files are only checked for (HEAD); behavior is never fetched or run.
  expect(loaded).toContain(`HEAD ${folder}/greeting-card/greeting-card.js`);
  expect(
    loaded.some(
      (entry) => entry.startsWith('GET') && entry.endsWith('.js') && entry.includes('/components/'),
    ),
  ).toBe(false);
  expect(loaded.some((entry) => entry.includes('/runtime/'))).toBe(false);
});

test('buildPage bundles a page under project and page prefixes and links only the bundle', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { buildPage, componentFolder, parseHtml } = await import('/packages/builder/index.js');
    type Request = {
      name: string;
      components: { name: string; style?: string; script?: string }[];
    };
    const requests: Request[] = [];
    const bundler = async (request: Request) => {
      requests.push(request);
      return {
        css: { fileName: `${request.name}.min.css`, code: '.x{}' },
        ...(request.components.some((component) => component.script) && {
          js: { fileName: `${request.name}.min.js`, code: 'x()' },
        }),
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
  expect(result.requests[0]).toEqual({
    name: 'shop-home',
    components: [greetingCard, statusBadge],
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
