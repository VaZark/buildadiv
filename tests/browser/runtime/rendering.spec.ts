import { test, expect } from '@playwright/test';
import type { UseTemplate } from '../../../packages/runtime/dom/element.js';
import { setup, mount } from '../../support/browser.js';

test('native imports render slots, item bindings and share one fetch', async ({
  page,
  request,
}) => {
  const errors = await setup(page, request);
  await expect(page.locator('#layout h2')).toHaveText('Products');
  await expect(page.locator('#layout h2')).not.toHaveAttribute('slot');
  // The runtime adds no component scope; pages style rendered templates with their own CSS.
  await expect(page.locator('#products li').first()).not.toHaveAttribute('data-c');
  await expect(page.locator('#products li').first()).toContainText('€25.00');
  await expect(page.locator('#count')).toContainText('2 products');
  const calls = await (await request.get('/api/calls')).json();
  expect(calls['/api/products']).toBe(1);
  expect(errors).toEqual([]);
});

test('reconciliation retains DOM nodes, focus and listeners without a refetch', async ({
  page,
  request,
}) => {
  const errors = await setup(page, request);
  await page.evaluate(() => {
    window.firstRow = document.querySelector<HTMLLIElement>('#products li')!;
    window.secondRow = document.querySelectorAll<HTMLLIElement>('#products li')[1];
    window.clicks = 0;
    window.firstRow
      .querySelector<HTMLButtonElement>('.local')!
      .addEventListener('click', () => window.clicks++);
    window.firstRow.querySelector<HTMLButtonElement>('.local')!.focus();
  });
  await page.evaluate(async () => {
    const { renameProduct } = await import('/examples/vanilla/api/products.js');
    await renameProduct({ id: 1, name: '<img src=x onerror=alert(1)>' });
  });
  await expect(page.locator('#products li strong').first()).toHaveText(
    '<img src=x onerror=alert(1)>',
  );
  expect(
    await page.evaluate(
      () =>
        window.firstRow === document.querySelector<HTMLLIElement>('#products li')! &&
        window.secondRow === document.querySelectorAll<HTMLLIElement>('#products li')[1] &&
        document.activeElement === window.firstRow.querySelector<HTMLButtonElement>('.local')!,
    ),
  ).toBe(true);
  await page.locator('#products li .local').first().click();
  expect(await page.evaluate(() => window.clicks)).toBe(1);
  expect(await page.locator('#products img').count()).toBe(0);
  expect((await (await request.get('/api/calls')).json())['/api/products']).toBe(1);
  expect(errors).toEqual([]);
});

test('direct data, nested lists, primitive arrays and truthiness update safely', async ({
  page,
  request,
}) => {
  const errors = await setup(page, request);
  await mount(
    page,
    `<template data-component="nested" data-accepts="array" data-from="groups" data-item="group" data-key="id">
    <section><h3 data-bind="group.name">Group name</h3><ul><template data-accepts="array" data-from="group.tags" data-item="tag" data-index="j"><li><span data-bind="tag">Tag</span><b data-bind="j">0</b></li></template></ul>
      <p data-if="group.tags group.active">Available</p><p data-if-not="group.tags">Empty</p>
    </section></template><use-template id="nested" template="nested"></use-template>`,
  );
  await page.evaluate(
    () =>
      (document.querySelector<UseTemplate>('#nested')!.data = {
        groups: [{ id: 1, name: 'First', active: true, tags: ['a', 'b'] }],
      }),
  );
  await expect(page.locator('#nested li span')).toHaveText(['a', 'b']);
  await expect(page.locator('#nested li b')).toHaveText(['0', '1']);
  await expect(page.locator('#nested p').first()).toBeVisible();
  await page.evaluate(
    () =>
      (document.querySelector<UseTemplate>('#nested')!.data = {
        groups: [
          { id: 1, name: 'Changed', active: false, tags: ['c'] },
          { id: 2, name: 'Second', tags: [] },
        ],
      }),
  );
  await expect(page.locator('#nested li span')).toHaveText(['c']);
  await expect(page.locator('#nested section').first().locator('p').first()).toBeHidden();
  await expect(page.locator('#nested section').nth(1).locator('p').nth(1)).toBeVisible();
  await expect(page.locator('#nested h3')).toHaveText(['Changed', 'Second']);
  expect(errors).toEqual([]);
});

test('preview content clears for missing data and unsafe attribute bindings are removed', async ({
  page,
  request,
}) => {
  const errors = await setup(page, request);
  await mount(
    page,
    `<template data-component="safe"><p data-bind="name">Preview name</p><a data-bind-href="url" href="#">Link</a><img data-bind-src="image" src="/placeholder.png" alt="Preview"><p data-bind="missing | fallback:'a|b:c'">Fallback</p><button data-bind-onclick="code">Button</button></template><use-template id="safe" template="safe"></use-template>`,
  );
  await expect(page.locator('#safe p').first()).toHaveText('Preview name');
  await page.evaluate(
    () =>
      (document.querySelector<UseTemplate>('#safe')!.data = {
        url: 'java\nscript:alert(1)',
        image: 'data:text/html,<script>alert(1)</script>',
        code: 'alert(1)',
      }),
  );
  await expect(page.locator('#safe p').first()).toBeEmpty();
  await expect(page.locator('#safe a')).not.toHaveAttribute('href');
  await expect(page.locator('#safe img')).not.toHaveAttribute('src');
  await expect(page.locator('#safe button')).not.toHaveAttribute('onclick');
  await expect(page.locator('#safe p').nth(1)).toHaveText('a|b:c');
  expect(errors).toEqual([]);
});

test('use-template renders only templates in the page and loads nothing', async ({
  page,
  request,
}) => {
  const errors = await setup(page, request);
  const requested: string[] = [];
  page.on('request', (sent) => requested.push(new URL(sent.url()).pathname));
  await page.evaluate(() =>
    document.body.insertAdjacentHTML(
      'beforeend',
      '<use-template id="absent" template="not-in-page"></use-template>',
    ),
  );
  await expect.poll(() => errors).toContain('Unknown template: not-in-page');
  await expect(page.locator('#absent')).toBeEmpty();
  expect(requested).toEqual([]);
});
