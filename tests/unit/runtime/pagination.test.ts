import test from 'node:test';
import assert from 'node:assert/strict';
import { query, mutation } from '../../../packages/runtime/action.js';
import { subscribe } from '../../../packages/runtime/data/queries.js';
import { getEntry } from '../../../packages/runtime/data/entries.js';
import { named, reset } from '../../support/runtime.js';

test('pagination merges, selects explicit pages, and refreshes only current and preceding pages', async () => {
  reset();
  const calls: string[] = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return new Response(
      url === '/change' ? '{}' : JSON.stringify([{ id: Number(String(url).slice(1)) }]),
    );
  };
  const load = named(
    query({
      url: (page) => '/' + page,
      provides: { tag: 'Page', key: 'id' },
      paginated: {
        mode: 'infinite',
        firstPage: 1,
        nextPage: (_response, page) => (page < 4 ? page + 1 : null),
      },
    }),
  );
  const off = subscribe(load, () => {});
  await getEntry(load).inflight;
  await load();
  await load();
  await load();
  assert.deepEqual(
    (getEntry(load).result!.response as { id: number }[]).map((item) => item.id),
    [1, 2, 3, 4],
  );
  getEntry(load).currentPage = 2;
  await named(mutation({ url: '/change', invalidates: 'Page' }))();
  assert.deepEqual(calls.slice(-3), ['/change', '/2', '/3']);
  assert.equal(getEntry(load).pages[0].invalidated, true);
  off();
  reset();
});
test('selecting a page while another page loads fetches both in order', async () => {
  reset();
  const calls: string[] = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    await new Promise((resolve) => setTimeout(resolve, 5));
    return new Response(JSON.stringify([{ id: Number(String(url).slice(1)) }]));
  };
  const load = named(
    query<number, { id: number }[]>({
      url: (page) => '/' + page,
      paginated: { mode: 'pages', firstPage: 1, nextPage: (_response, page) => page + 1 },
    }),
  );
  const [second, fifth, again] = await Promise.all([load(2), load(5), load(5)]);
  assert.deepEqual(calls, ['/2', '/5']);
  assert.deepEqual(second.response, [{ id: 2 }]);
  assert.deepEqual(fifth.response, [{ id: 5 }]);
  assert.equal(again, fifth);
  reset();
});
