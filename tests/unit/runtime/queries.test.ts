import test from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../../../packages/runtime/action.js';
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
  const load = named(query({ url: '/', context: () => ({ pending: true, count: 1 }) }));
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
  const load = named(query<{ id: number }>({ url: (args) => '/item/' + args.id }));
  await load({ id: 1 });
  await load({ id: 2 });
  await load({ id: 1 });
  assert.equal(calls.length, 2);
  const { json } = await import('../../../packages/runtime/formats.js');
  const search = named(query({ method: 'QUERY', url: '/search', send: json }));
  await search({ text: 'hello' });
  assert.equal(calls.at(-1)!.options.method, 'QUERY');
  assert.equal(calls.at(-1)!.options.body, '{"text":"hello"}');
  const timed = named(query({ url: '/timed', refetchAfter: 0.02 }));
  const off = subscribe(timed, () => {});
  await timed();
  await new Promise((resolve) => setTimeout(resolve, 35));
  off();
  assert.ok(calls.filter((call) => call.url === '/timed').length >= 2);
  reset();
});
test('a failing subscriber is reported without changing the request outcome', async () => {
  reset();
  globalThis.fetch = async () => new Response('[{"id":1}]');
  const reported: unknown[] = [];
  const log = console.error;
  console.error = (error: unknown) => reported.push(error);
  const load = named(query({ url: '/' }));
  const seen: string[] = [];
  const offBroken = subscribe(load, (result) => {
    if (result.context.success) throw new Error('render failed');
  });
  const offHealthy = subscribe(load, (result) => {
    if (!result.context.pending) seen.push(result.context.success ? 'success' : 'error');
  });
  const result = await load();
  console.error = log;
  assert.equal(result.context.success, true);
  assert.deepEqual(seen, ['success']);
  assert.equal(reported.length, 1);
  offBroken();
  offHealthy();
  reset();
});
