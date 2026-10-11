import test from 'node:test';
import assert from 'node:assert/strict';
import { provider } from '../../../packages/runtime/action.js';
import { subscribe } from '../../../packages/runtime/data/queries.js';
import { named, reset, tick } from '../../support/runtime.js';

test('concurrent calls and subscribers share a request; built-in context fields are reserved', async () => {
  reset();
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    await tick();
    return new Response('[{"id":1}]');
  };
  const load = named(provider({ url: '/', context: () => ({ pending: true, count: 1 }) }));
  const [a, b] = await Promise.all([load(), load()]);
  assert.equal(calls, 1);
  assert.equal(a, b);
  assert.equal(a.context.pending, false);
  assert.equal(a.context.count, 1);
  let updates = 0;
  const off = subscribe(load, () => updates++);
  await tick();
  assert.equal(calls, 1);
  assert.ok(updates > 0);
  off();
  reset();
});
test('distinct argument caches, QUERY bodies and age-based refetch are independent', async () => {
  reset();
  const calls: { url: string; options: RequestInit }[] = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options: options || {} });
    return new Response('[{"id":1}]');
  };
  const load = named(provider<{ id: number }>({ url: (args) => '/item/' + args.id }));
  await load({ id: 1 });
  await load({ id: 2 });
  await load({ id: 1 });
  assert.equal(calls.length, 2);
  const { json } = await import('../../../packages/runtime/formats.js');
  const query = named(provider({ method: 'QUERY', url: '/search', send: json }));
  await query({ text: 'hello' });
  assert.equal(calls.at(-1)!.options.method, 'QUERY');
  assert.equal(calls.at(-1)!.options.body, '{"text":"hello"}');
  const timed = named(provider({ url: '/timed', refetchAfter: 0.02 }));
  const off = subscribe(timed, () => {});
  await timed();
  await new Promise((resolve) => setTimeout(resolve, 35));
  off();
  assert.ok(calls.filter((call) => call.url === '/timed').length >= 2);
  reset();
});
