import { test, expect } from '@playwright/test';
import type { RenderTemplate } from '../../../packages/runtime/dom/element.js';
import { setup, mount } from '../../support/browser.js';

test('invalidation refreshes subscribers but load-once regions remain unchanged', async ({
  page,
  request,
}) => {
  const errors = await setup(page, request);
  await mount(
    page,
    '<render-template id="once" load-from-action="loadProducts" on-success="product-rows"></render-template>',
  );
  await expect(page.locator('#once li')).toHaveCount(2);
  await page.locator('[data-action="importProducts"]').click();
  await expect(page.locator('#products li strong').nth(1)).toHaveText('Imported hat');
  await expect(page.locator('#once li strong').nth(1)).toHaveText('Hat');
  expect((await (await request.get('/api/calls')).json())['/api/products']).toBe(2);
  expect(errors).toEqual([]);
});

test('states distinguish 204, empty list, HTTP failure and timeout; document events follow lifecycle', async ({
  page,
  request,
}) => {
  const errors = await setup(page, request);
  await page.evaluate(() => {
    window.events = [];
    for (const event of [
      'before:request',
      'pending',
      'after:request',
      'no-content',
      'finally:request',
    ])
      document.addEventListener('emptyTest:' + event, () => window.events.push(event));
    window.timeoutEvents = [];
    for (const event of ['timeout', 'error', 'finally:request'])
      document.addEventListener('slowTest:' + event, () => window.timeoutEvents.push(event));
  });
  await mount(
    page,
    `<template data-component="nothing"><p>No content</p></template>
    <render-template id="empty" load-from-action="emptyTest" on-no-content="nothing"></render-template>
    <render-template id="zero" load-from-action="zeroTest" on-success="product-rows" on-no-content="nothing"></render-template>
    <render-template id="error" load-from-action="errorTest" on-error="failure"></render-template>
    <render-template id="slow" load-from-action="slowTest" on-error="failure"></render-template>`,
    {
      emptyTest: { url: '/api/empty' },
      zeroTest: { url: '/api/zero' },
      errorTest: { url: '/api/error' },
      slowTest: { url: '/api/slow', timeout: 0.02 },
    },
  );
  await expect(page.locator('#empty')).toContainText('No content');
  await expect(page.locator('#zero')).toBeEmpty();
  await expect(page.locator('#error')).toContainText('500');
  await expect(page.locator('#slow')).toContainText('network');
  expect(await page.evaluate(() => window.events)).toEqual([
    'before:request',
    'pending',
    'after:request',
    'no-content',
    'finally:request',
  ]);
  expect(await page.evaluate(() => window.timeoutEvents)).toEqual([
    'timeout',
    'error',
    'finally:request',
  ]);
  expect(errors).toEqual([]);
});

test('form submission sends multipart fields and submitter; custom events invoke without arguments', async ({
  page,
  request,
}) => {
  const errors = await setup(page, request);
  await page.evaluate(async () => {
    const { configure } = await import('/packages/runtime/index.js');
    const { mutation } = await import('/packages/runtime/action.js');
    window.formResult = null;
    window.customArgs = 'unset';
    const submitTest = mutation({ url: '/api/echo' });
    const customTest = async (args?: unknown): Promise<void> => {
      window.customArgs = args;
    };
    document.addEventListener(
      'submitTest:success',
      (event) => (window.formResult = (event as CustomEvent).detail.result.response),
    );
    configure({ actions: { submitTest, customTest } });
  });
  await mount(
    page,
    '<form data-action="submitTest"><input name="title" value="Hello"><button name="intent" value="save">Submit</button></form><select data-action="customTest" data-on="change"><option>One</option><option>Two</option></select>',
  );
  await page.locator('form button').click();
  await expect.poll(() => page.evaluate(() => window.formResult)).not.toBeNull();
  const result = await page.evaluate(() => window.formResult!);
  expect(result.type).toContain('multipart/form-data');
  expect(result.body).toContain('Hello');
  expect(result.body).toContain('save');
  await page.locator('select').selectOption({ label: 'Two' });
  expect(await page.evaluate(() => window.customArgs === undefined)).toBe(true);
  expect(errors).toEqual([]);
});

test('disconnect releases subscriptions; remount restores cached data', async ({
  page,
  request,
}) => {
  const errors = await setup(page, request);
  await page.evaluate(() => {
    window.detached = document.querySelector<RenderTemplate>('#products render-template')!;
    window.detached.remove();
    document.querySelector('#count')!.remove();
  });
  await page.locator('[data-action="importProducts"]').click();
  await expect
    .poll(async () => (await (await request.get('/api/calls')).json())['/api/import'])
    .toBe(1);
  await page.evaluate(() => document.querySelector('#products')!.append(window.detached));
  await expect(page.locator('#products li strong').nth(1)).toHaveText('Imported hat');
  expect(errors).toEqual([]);
});

test('a provider trigger refetches fresh data; render failures leave the request successful', async ({
  page,
  request,
}) => {
  const errors = await setup(page, request);
  await page.evaluate(() => {
    window.events = [];
    for (const event of ['success', 'error'])
      document.addEventListener('loadProducts:' + event, () => window.events.push(event));
  });
  await mount(
    page,
    `<button id="refresh" data-action="loadProducts">Refresh products</button>
    <template data-component="duplicate-rows" data-accepts="array" data-item="row" data-key="missing">
      <li data-bind="row.name">Row</li>
    </template>
    <render-template id="broken" subscribe-to-action="loadProducts" on-success="duplicate-rows"></render-template>`,
  );
  await page.locator('#refresh').click();
  await expect
    .poll(async () => (await (await request.get('/api/calls')).json())['/api/products'])
    .toBe(2);
  await expect(page.locator('#products li')).toHaveCount(2);
  expect(await page.evaluate(() => window.events)).toEqual(['success']);
  expect(errors).toContain('List keys must be unique');
});
