import { test, expect } from '@playwright/test';
import { setup } from '../../support/browser.js';

// One pipeline per case; the same strings are rendered by <use-template> and by {{ }}.
const pipelines: Record<string, string> = {
  price: 'price | currency:EUR',
  ratio: 'ratio | percent',
  count: 'count | number',
  when: 'when | date:long',
  ago: 'daysAgo | relativeTime:day',
  short: 'name | upper | truncate:6',
  missing: "missing | upper | fallback:'—'",
  quoted: "missing | fallback:'a|b:c'",
  custom: 'name | initials',
};
const expected: Record<string, string> = {
  price: '€1,234.50',
  ratio: '26%',
  count: '9,876,543',
  when: 'January 15, 2025',
  ago: 'yesterday',
  short: 'ADA L…',
  missing: '—',
  quoted: 'a|b:c',
  custom: 'AL',
};

test('filters give identical results in runtime bindings and build-time {{ }}', async ({
  page,
  request,
}) => {
  const errors = await setup(page, request);
  const result = await page.evaluate(
    async ({ pipelines }) => {
      const { configure } = await import('/packages/runtime/index.js');
      const filters = await import('/packages/runtime/filters.js');
      const { buildHtml, parseHtml } = await import('/packages/builder/index.js');
      const initials = (value: unknown) =>
        String(value)
          .split(/\s+/)
          .map((word) => word[0])
          .join('');
      // A deliberately unsafe filter: attribute sanitization must still apply to its output.
      const unsafe = () => 'javascript:alert(1)';
      const registry = { ...filters, initials, unsafe };
      configure({ filters: registry });
      const data = {
        price: 1234.5,
        ratio: 0.256,
        count: 9876543,
        when: '2025-01-15T12:00:00',
        daysAgo: -1,
        name: 'Ada Lovelace',
        url: 'HTTPS://EXAMPLE.COM/Ada',
        missing: null,
      };

      // Runtime: text and attribute bindings in a template from the page.
      const cells = Object.entries(pipelines)
        .map(([id, pipeline]) => `<p data-case="${id}" data-bind="${pipeline}">preview</p>`)
        .join('');
      document.body.insertAdjacentHTML(
        'beforeend',
        `<template data-component="filter-cases">${cells}
           <a class="link" data-bind-href="url | lower" data-bind-title="name | upper" href="#">Link</a>
           <a class="unsafe" data-bind-href="name | unsafe" href="#">Unsafe</a>
         </template>
         <use-template id="filter-cases" template="filter-cases"></use-template>`,
      );
      const host = document.querySelector<HTMLElement & { data: unknown }>('#filter-cases')!;
      host.data = data;
      const runtime = Object.fromEntries(
        Object.keys(pipelines).map((id) => [
          id,
          host.querySelector(`[data-case="${id}"]`)!.textContent,
        ]),
      );

      // Build time: the same pipelines and filter functions through {{ }}.
      const page = Object.entries(pipelines)
        .map(([id, pipeline]) => `<p data-case="${id}">{{ ${pipeline} }}</p>`)
        .join('');
      const built = parseHtml(buildHtml(`<body>${page}</body>`, { data, filters: registry }));
      const buildTime = Object.fromEntries(
        Object.keys(pipelines).map((id) => [
          id,
          built.querySelector(`[data-case="${id}"]`)!.textContent,
        ]),
      );

      const link = host.querySelector('.link')!;
      return {
        runtime,
        buildTime,
        href: link.getAttribute('href'),
        title: link.getAttribute('title'),
        unsafe: host.querySelector('.unsafe')!.hasAttribute('href'),
      };
    },
    { pipelines },
  );
  expect(result.runtime).toEqual(expected);
  expect(result.buildTime).toEqual(expected);
  expect(result.href).toBe('https://example.com/ada');
  expect(result.title).toBe('ADA LOVELACE');
  // A filter cannot smuggle a javascript: URL past attribute sanitization.
  expect(result.unsafe).toBe(false);
  expect(errors).toEqual([]);
});

test('an unregistered filter is an error, not a silent no-op', async ({ page, request }) => {
  await setup(page, request);
  // Assigning `.data` renders synchronously, so the error reaches the code that assigned it.
  const assign = page.evaluate(() => {
    document.body.insertAdjacentHTML(
      'beforeend',
      `<template data-component="unknown-filter"><p data-bind="name | sparkle">Preview</p></template>
       <use-template id="unknown-filter" template="unknown-filter"></use-template>`,
    );
    document.querySelector<HTMLElement & { data: unknown }>('#unknown-filter')!.data = {
      name: 'Ada',
    };
  });
  await expect(assign).rejects.toThrow('Unregistered filter: sparkle');
});

// Intl may use narrow no-break spaces; compare with ordinary spaces.
const spaces = (text: string | null) => (text ?? '').replace(/[\u00a0\u202f]/g, ' ');
const normalized = (values: Record<string, string | null>) =>
  Object.fromEntries(Object.entries(values).map(([key, text]) => [key, spaces(text)]));

test('formatting follows the nearest lang, at runtime and in the page being built', async ({
  page,
  request,
}) => {
  await setup(page, request);
  const result = await page.evaluate(async () => {
    const { configure } = await import('/packages/runtime/index.js');
    const { currency, date } = await import('/packages/runtime/filters.js');
    const { buildHtml, parseHtml } = await import('/packages/builder/index.js');
    configure({ filters: { currency, date }, currency: 'EUR' });
    const data = { price: 1234.5, when: '2025-01-15T12:00:00' };

    // Runtime: one template, rendered in an English page and inside a German section.
    document.body.insertAdjacentHTML(
      'beforeend',
      `<template data-component="money"><p data-bind="price | currency">€0</p></template>
       <use-template id="money-en" template="money"></use-template>
       <section lang="de-DE"><use-template id="money-de" template="money"></use-template></section>`,
    );
    const render = (id: string) => {
      const host = document.querySelector<HTMLElement & { data: unknown }>(id)!;
      host.data = data;
      return host.textContent!.trim();
    };
    const runtime = { english: render('#money-en'), german: render('#money-de') };
    configure({ locale: 'fr-FR' });
    const configured = render('#money-en');

    // Build time: the built page's own languages decide, not this (English) page's.
    const source = `<!doctype html><html lang="de-DE"><body>
      <template data-component="price-tag"><b>{{ price | currency }}</b><slot></slot></template>
      <p id="page">{{ price | currency }}</p>
      <p id="nested" lang="fr-FR">{{ when | date:long }}</p>
      <p id="per-use">{{ when | date:long:ja-JP }}</p>
      <section lang="en-GB"><price-tag><i>{{ when | date:long }}</i></price-tag></section>
    </body></html>`;
    const read = (html: string) => {
      const doc = parseHtml(html);
      return {
        page: doc.querySelector('#page')!.textContent,
        nested: doc.querySelector('#nested')!.textContent,
        perUse: doc.querySelector('#per-use')!.textContent,
        component: doc.querySelector('section b')!.textContent,
        slotted: doc.querySelector('section i')!.textContent,
      };
    };
    const filters = { currency, date };
    return {
      runtime,
      configured,
      built: read(buildHtml(source, { data, filters, currency: 'EUR' })),
      overridden: read(buildHtml(source, { data, filters, currency: 'EUR', locale: 'en-US' })),
    };
  });
  expect(normalized(result.runtime)).toEqual({ english: '€1,234.50', german: '1.234,50 €' });
  expect(spaces(result.configured)).toBe('1 234,50 €');
  expect(normalized(result.built)).toEqual({
    page: '1.234,50 €',
    nested: '15 janvier 2025',
    perUse: '2025年1月15日',
    component: '€1,234.50',
    slotted: '15 January 2025',
  });
  // A locale option overrides the page's languages; a per-use argument still wins.
  expect(normalized(result.overridden)).toEqual({
    page: '€1,234.50',
    nested: 'January 15, 2025',
    perUse: '2025年1月15日',
    component: '€1,234.50',
    slotted: 'January 15, 2025',
  });
});
