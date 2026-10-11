import test from 'node:test';
import assert from 'node:assert/strict';
import { provider, mutation } from '../../../packages/runtime/action.js';
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
    provider({
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
