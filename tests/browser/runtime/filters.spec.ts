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
