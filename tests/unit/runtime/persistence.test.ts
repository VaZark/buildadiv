import test from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../../../packages/runtime/action.js';
import { subscribe } from '../../../packages/runtime/data/queries.js';
import { cache } from '../../../packages/runtime/data/entries.js';
import { settings } from '../../../packages/runtime/configuration/settings.js';
import type { PersistedEntry } from '../../../packages/runtime/contracts/storage.js';
import { named, reset, tick } from '../../support/runtime.js';

test('unused retention, no-store, persistence maxAge and buster', async () => {
  reset();
  let calls = 0;
  const data = new Map<string, PersistedEntry>();
  settings.persist = {
    async get(key) {
      return data.get(key);
    },
    async set(key, value) {
      data.set(key, structuredClone(value));
    },
    async remove(key) {
      data.delete(key);
    },
  };
  globalThis.fetch = async () => {
    calls++;
    return new Response('[{"id":1}]');
  };
  const load = named(query({ url: '/' }));
  await load();
  cache.clear();
  await load();
  assert.equal(calls, 1);
  cache.clear();
  settings.buster = 'v2';
  await load();
  assert.equal(calls, 2);
  cache.clear();
  settings.maxAge = -1;
  await load();
  assert.equal(calls, 3);
  const expiring = named(query({ url: '/', keepUnusedFor: 0.001 }));
  const off = subscribe(expiring, () => {});
  await expiring();
  off();
  await tick();
  assert.ok(!cache.has(`${expiring.actionName}:`));
  globalThis.fetch = async () => {
    calls++;
    return new Response('[]', { headers: { 'cache-control': 'no-store' } });
  };
  const noStore = named(query({ url: '/' }));
  await noStore();
  await tick();
  assert.ok(!data.has(`${noStore.actionName}:`));
  reset();
});
