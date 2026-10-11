import test from 'node:test';
import assert from 'node:assert/strict';
import { query, mutation } from '../../../packages/runtime/action.js';
import { subscribe } from '../../../packages/runtime/data/queries.js';
import { cache, getEntry } from '../../../packages/runtime/data/entries.js';
import { named, reset, tick } from '../../support/runtime.js';

test('reconcile upserts the key owner, sorts, recomputes context, and never fetches', async () => {
  reset();
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls++;
    return new Response(
      JSON.stringify(url === '/list' ? [{ id: 1, name: 'B' }] : { resource: { id: 2, name: 'A' } }),
    );
  };
  const load = named(
    query<unknown, { id: number; name: string }[]>({
      url: '/list',
      provides: { tag: 'Item', key: 'id' },
      sort: (a, b) => a.name.localeCompare(b.name),
      context: (response) => ({ count: response?.length || 0 }),
    }),
  );
  const off = subscribe(load, () => {});
  await load();
  const add = named(mutation({ url: '/add', reconciles: { tag: 'Item', key: 'resource.id' } }));
  await add();
  assert.equal(calls, 2);
  const result = getEntry(load).result!;
  assert.deepEqual(
    (result.response as { id: number }[]).map((item) => item.id),
    [2, 1],
  );
  assert.equal(result.context.count, 2);
  off();
  reset();
});
test('item invalidation refetches matching mounted queries and drops unmounted data', async () => {
  reset();
  const calls: string[] = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return new Response(
      url === '/change' ? '{"id":1}' : JSON.stringify([{ id: url === '/a' ? 1 : 2 }]),
    );
  };
  const a = named(query({ url: '/a', provides: { tag: 'Item', key: 'id' } }));
  const b = named(query({ url: '/b', provides: { tag: 'Item', key: 'id' } }));
  const c = named(query({ url: '/c', provides: { tag: 'Item', key: 'id' } }));
  const offA = subscribe(a, () => {}),
    offB = subscribe(b, () => {});
  await Promise.all([a(), b(), c()]);
  await named(mutation({ url: '/change', invalidates: { tag: 'Item', key: 'id' } }))();
  assert.equal(calls.filter((url) => url === '/a').length, 2);
  assert.equal(calls.filter((url) => url === '/b').length, 1);
  await named(mutation({ url: '/change', invalidates: 'Item' }))();
  assert.equal(calls.filter((url) => url === '/c').length, 1);
  assert.equal(cache.has(getEntry(c).key) && getEntry(c).result, null);
  offA();
  offB();
  reset();
});
test('failed reconcile invalidates; background failures keep data unless throw is requested', async () => {
  reset();
  let fail = false;
  globalThis.fetch = async (url) =>
    new Response(url === '/change' ? '{}' : fail ? 'failed' : '[{"id":1}]', {
      status: fail && url !== '/change' ? 500 : 200,
    });
  const load = named(query({ url: '/list', provides: { tag: 'Item', key: 'id' } }));
  const off = subscribe(load, () => {});
  await load();
  fail = true;
  await named(mutation({ url: '/change', reconciles: { tag: 'Item', key: 'id' } }))();
  assert.equal(getEntry(load).result!.context.success, true);
  load.options.onRefetchFailure = 'throw';
  await named(mutation({ url: '/change', invalidates: 'Item' }))();
  assert.equal(getEntry(load).result!.context.error, true);
  off();
  reset();
});
test('invalidation during an in-flight query schedules a fresh request', async () => {
  reset();
  let finish: (() => void) | undefined;
  let calls = 0;
  globalThis.fetch = async (url) => {
    if (url === '/change') return new Response('{}');
    calls++;
    if (calls === 1) await new Promise<void>((resolve) => (finish = resolve));
    return new Response('[{"id":1}]');
  };
  const load = named(query({ url: '/list', provides: { tag: 'Item', key: 'id' } }));
  const off = subscribe(load, () => {});
  await tick();
  const changed = named(mutation({ url: '/change', invalidates: 'Item' }))();
  await tick();
  finish!();
  await changed;
  assert.equal(calls, 2);
  off();
  reset();
});
test('item ids read from data-key strings match numeric cached ids', async () => {
  reset();
  let listCalls = 0;
  globalThis.fetch = async (url) => {
    if (url === '/list') listCalls++;
    return url === '/list'
      ? new Response('[{"id":42,"name":"Hat"}]')
      : new Response(url === '/rename' ? '{"id":"42","name":"Cap"}' : null, {
          status: url === '/rename' ? 200 : 204,
        });
  };
  const load = named(query({ url: '/list', provides: { tag: 'Item', key: 'id' } }));
  const off = subscribe(load, () => {});
  await load();
  const rename = named(mutation({ url: '/rename', reconciles: { tag: 'Item', key: 'id' } }));
  await rename();
  assert.deepEqual(getEntry(load).result!.response, [{ id: '42', name: 'Cap' }]);
  const remove = named(
    mutation<{ id: string }>({
      method: 'DELETE',
      url: (args) => '/item/' + args.id,
      invalidates: { tag: 'Item', id: (args) => args.id },
    }),
  );
  await remove({ id: '42' });
  assert.equal(listCalls, 2);
  off();
  reset();
});
