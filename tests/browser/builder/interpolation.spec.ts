import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/support/builder.html');
});

test('interpolated data stays text, unsafe attributes disappear, and braces are not re-evaluated', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { buildHtml, parseHtml } = await import('/packages/builder/index.js');
    const { upper } = await import('/packages/shared/filters.js');
    const output = buildHtml(
      '<!doctype html><body><template data-component="safe-card"><h1>{{ props.title }}</h1><a href="{{ url }}" onclick="{{ handler }}">Link</a><img src="{{ image }}" alt="{{ missing | fallback:\'Photo\' }}"><p>{{ missing }}</p><b>{{ name | upper }}</b><i>{{ braces }}</i></template><safe-card title="{{ name }}"></safe-card></body>',
      {
        data: {
          name: '<img src=x onerror=alert(1)>',
          url: 'java\nscript:alert(1)',
          handler: 'alert(1)',
          image: 'data:text/html,x',
          braces: '{{ name }}',
        },
        filters: { upper },
      },
    );
    const doc = parseHtml(output);
    return {
      text: doc.querySelector('h1')!.textContent,
      headingChildren: doc.querySelector('h1')!.children.length,
      href: doc.querySelector('a')!.getAttribute('href'),
      onclick: doc.querySelector('a')!.getAttribute('onclick'),
      src: doc.querySelector('img')!.getAttribute('src'),
      alt: doc.querySelector<HTMLImageElement>('img')!.alt,
      missing: doc.querySelector('p')!.textContent,
      upper: doc.querySelector('b')!.textContent,
      braces: doc.querySelector('i')!.textContent,
      escaped: output.includes('&lt;img'),
    };
  });
  expect(result).toEqual({
    text: '<img src=x onerror=alert(1)>',
    headingChildren: 0,
    href: null,
    onclick: null,
    src: null,
    alt: 'Photo',
    missing: '',
    upper: '<IMG SRC=X ONERROR=ALERT(1)>',
    braces: '{{ name }}',
    escaped: true,
  });
});

test('runtime declarations, hosts, comments and script/style contents remain unprocessed', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { buildHtml, parseHtml } = await import('/packages/builder/index.js');
    const source =
      '<!doctype html><body><!-- {{ missing | unknown }} --><template data-component="static-card"><p>{{ title }}</p></template><template data-component="runtime-list"><static-card></static-card><b data-bind="response.title">{{ title | unknown }}</b></template><render-template template="runtime-list"><static-card title="{{ missing | unknown }}"></static-card></render-template><script>const x = "{{ missing | unknown }}";</script><style>/* {{ missing | unknown }} */</style><static-card></static-card></body>';
    const output = buildHtml(source, { data: { title: 'Static' } });
    const original = parseHtml(source),
      built = parseHtml(output);
    return {
      runtime:
        original.querySelector('template[data-component="runtime-list"]')!.outerHTML ===
        built.querySelector('template[data-component="runtime-list"]')!.outerHTML,
      host:
        original.querySelector('render-template')!.outerHTML ===
        built.querySelector('render-template')!.outerHTML,
      script:
        original.querySelector('script')!.textContent ===
        built.querySelector('script')!.textContent,
      style:
        original.querySelector('style')!.textContent === built.querySelector('style')!.textContent,
      comment: output.includes('<!-- {{ missing | unknown }} -->'),
      value: built.querySelector('body > p')!.textContent,
    };
  });
  expect(result).toEqual({
    runtime: true,
    host: true,
    script: true,
    style: true,
    comment: true,
    value: 'Static',
  });
});
