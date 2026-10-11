import { test, expect } from '@playwright/test';
import type { BuildOptions } from '../../../packages/builder/contracts.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/support/builder.html');
});

test('expands registered tags in place while preserving adjacent native nodes', async ({
  page,
}) => {
  const loaded: string[] = [];
  page.on('request', (request) => loaded.push(request.url()));
  const result = await page.evaluate(async () => {
    const { expandComponents, parseHtml } = await import('/packages/builder/index.js');
    const doc = parseHtml(
      '<!doctype html><body><template data-component="two-roots"><h2>{{ props.title }}</h2><p>{{ site.note }}</p></template><div id="before">Before</div><two-roots title="Welcome"></two-roots><div id="after">After</div><unrelated-widget>Keep me</unrelated-widget></body>',
    );
    const before = doc.querySelector('#before')!,
      after = doc.querySelector('#after')!;
    const returned = expandComponents(doc, { data: { site: { note: 'Note' } } });
    return {
      same:
        returned === doc &&
        before === doc.querySelector('#before')! &&
        after === doc.querySelector('#after')!,
      tags: doc.querySelectorAll('two-roots').length,
      heading: doc.querySelector('h2')!.textContent,
      scope: doc.querySelector<HTMLElement>('h2')!.dataset.c,
      custom: doc.querySelector('unrelated-widget')!.textContent,
      order: Array.from(doc.body.children).map((element) => element.id || element.localName),
    };
  });
  expect(result).toEqual({
    same: true,
    tags: 0,
    heading: 'Welcome',
    scope: 'two-roots',
    custom: 'Keep me',
    order: ['template', 'before', 'h2', 'p', 'after', 'unrelated-widget'],
  });
  expect(loaded.some((url) => url.includes('/runtime/'))).toBe(false);
});

test('nested components receive own props while forwarded slots retain caller scope', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { buildHtml, parseHtml } = await import('/packages/builder/index.js');
    const html = buildHtml(
      `<!doctype html><body>
      <template data-component="outer-frame"><section><h1>{{ props.title }}</h1><inner-frame title="Inner"><slot>Outer fallback</slot></inner-frame></section></template>
      <template data-component="inner-frame"><article><h2>{{ props.title }}</h2><slot>Inner fallback</slot></article></template>
      <outer-frame title="Outer"><p>{{ props.title }}</p><inner-frame title="Authored"><b>{{ props.title }}</b></inner-frame></outer-frame>
    </body>`,
      { data: { props: { title: 'Caller' } } },
    );
    const doc = parseHtml(html);
    return {
      heading: doc.querySelector('h1')!.textContent,
      subheads: Array.from(doc.querySelectorAll('h2'), (element) => element.textContent),
      paragraph: doc.querySelector('p')!.textContent,
      bold: doc.querySelector('b')!.textContent,
      scopes: [
        doc.querySelector<HTMLElement>('section')!.dataset.c,
        doc.querySelector<HTMLElement>('article')!.dataset.c,
        doc.querySelector<HTMLElement>('p')!.dataset.c,
      ],
      tags: doc.querySelectorAll('outer-frame, inner-frame').length,
    };
  });
  expect(result).toEqual({
    heading: 'Outer',
    subheads: ['Inner', 'Authored'],
    paragraph: 'Caller',
    bold: 'Caller',
    scopes: ['outer-frame', 'inner-frame', undefined],
    tags: 0,
  });
});

test('shared slots accept multiple named children, text and fallback markup', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { buildHtml, parseHtml } = await import('/packages/builder/index.js');
    const output = buildHtml(
      '<!doctype html><body><template data-component="slot-card"><header><slot name="heading">Default heading</slot></header><main><slot>Default body</slot></main><footer><slot name="footer"><em>{{ note }}</em></slot></footer></template><slot-card><h1 slot="heading">One</h1><h2 slot="heading">Two</h2>Text body</slot-card></body>',
      { data: { note: 'Fallback footer' } },
    );
    const doc = parseHtml(output);
    return {
      heading: doc.querySelector('header')!.textContent,
      body: doc.querySelector('main')!.textContent,
      footer: doc.querySelector('footer')!.textContent,
      remaining: doc.querySelectorAll('slot, [slot]').length,
    };
  });
  expect(result).toEqual({
    heading: 'OneTwo',
    body: 'Text body',
    footer: 'Fallback footer',
    remaining: 0,
  });
});

test('external definitions, custom filters and explicit host props work without consuming source templates', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { buildHtml, parseHtml } = await import('/packages/builder/index.js');
    const definitions = parseHtml(
      '<template data-component="external-card"><div id="{{ props.id }}" class="{{ props.class }}"><h1>{{ props.title | suffix:\'!\' }}</h1></div></template>',
    );
    const template = definitions.querySelector<HTMLTemplateElement>('template')!;
    const output = buildHtml(
      '<!doctype html><body><external-card id="chosen" class="card" title="Hello"></external-card></body>',
      {
        components: [template],
        filters: { suffix: (value, suffix) => String(value) + suffix },
      },
    );
    const stringOutput = buildHtml('<!doctype html><body><external-card></external-card></body>', {
      components: ['<template data-component="external-card"><p>String definition</p></template>'],
    });
    const doc = parseHtml(output);
    return {
      title: doc.querySelector('h1')!.textContent,
      className: doc.querySelector('#chosen')!.className,
      sourceIntact: template.content.querySelector('h1')!.textContent,
      stringValue: parseHtml(stringOutput).querySelector('p')!.textContent,
    };
  });
  expect(result).toEqual({
    title: 'Hello!',
    className: 'card',
    sourceIntact: "{{ props.title | suffix:'!' }}",
    stringValue: 'String definition',
  });
});

test('cycles, duplicate definitions and unknown filters report actionable errors', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { buildHtml } = await import('/packages/builder/index.js');
    const error = (html: string, options?: BuildOptions): string => {
      try {
        buildHtml(html, options);
        return 'no error';
      } catch (failure) {
        return failure instanceof Error ? failure.message : String(failure);
      }
    };
    return {
      cycle: error(
        '<body><template data-component="first-card"><second-card></second-card></template><template data-component="second-card"><first-card></first-card></template><first-card></first-card></body>',
      ),
      duplicate: error(
        '<body><template data-component="same-card"><p>A</p></template><template data-component="same-card"><p>B</p></template><same-card></same-card></body>',
      ),
      filter: error('<body><p>{{ title | missing }}</p></body>'),
      finite: error(
        '<body><template data-component="nested-frame"><div><slot>Content</slot></div></template><nested-frame><nested-frame>Inner</nested-frame></nested-frame></body>',
      ),
    };
  });
  expect(result.cycle).toBe('Component cycle: first-card → second-card → first-card');
  expect(result.duplicate).toBe('Duplicate component: same-card');
  expect(result.filter).toBe('Unregistered filter: missing');
  expect(result.finite).toBe('no error');
});

test('a component wrapper leaves nested runtime hosts and their slot sockets untouched', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { buildHtml, parseHtml } = await import('/packages/builder/index.js');
    const output = buildHtml(`<body>
      <template data-component="static-wrapper"><section><slot name="outside">Fallback</slot><render-template template="live"><slot name="outside">Runtime fallback</slot><p>{{ missing | unknown }}</p></render-template></section></template>
      <static-wrapper><h3 slot="outside">Filled outside</h3></static-wrapper>
    </body>`);
    const doc = parseHtml(output);
    return {
      filled: doc.querySelector('section > h3')!.textContent,
      runtime: doc.querySelector('section > render-template')!.outerHTML,
    };
  });
  expect(result.filled).toBe('Filled outside');
  expect(result.runtime).toBe(
    '<render-template template="live"><slot name="outside">Runtime fallback</slot><p>{{ missing | unknown }}</p></render-template>',
  );
});
