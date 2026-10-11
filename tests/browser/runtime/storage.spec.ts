import { test, expect } from '@playwright/test';
import { setup } from '../../support/browser.js';

test('local, session and IndexedDB stores round-trip and remove data', async ({
  page,
  request,
}) => {
  const errors = await setup(page, request);
  const results = await page.evaluate(async () => {
    const { localStore, sessionStore, indexedDbStore } =
      await import('/packages/runtime/stores.js');
    const stores = [
      localStore<{ items: number[]; buster: string }>('test:'),
      sessionStore<{ items: number[]; buster: string }>('test:'),
      indexedDbStore<{ items: number[]; buster: string }>('test-runtime'),
    ];
    const results = [];
    for (const store of stores) {
      await store.set('key', { items: [1, 2], buster: 'v1' });
      const restored = await store.get('key');
      await store.remove('key');
      results.push({ restored, removed: (await store.get('key')) === undefined });
    }
    return results;
  });
  expect(results).toEqual(
    Array.from({ length: 3 }, () => ({ restored: { items: [1, 2], buster: 'v1' }, removed: true })),
  );
  expect(errors).toEqual([]);
});
