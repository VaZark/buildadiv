import test from 'node:test';
import assert from 'node:assert/strict';
import { provider, mutation, action } from '../../../packages/runtime/action.js';
import { named, reset } from '../../support/runtime.js';

test('helpers validate roles and function behaviors', () => {
  // @ts-expect-error Deliberately exercise runtime validation for untyped JavaScript callers.
  assert.throws(() => provider({ url: '/', invalidates: 'X' }), /Providers/);
  // @ts-expect-error Deliberately exercise runtime validation for untyped JavaScript callers.
  assert.throws(() => mutation({ url: '/', provides: { tag: 'X', key: 'id' } }), /Mutations/);
  // @ts-expect-error Deliberately exercise runtime validation for untyped JavaScript callers.
  assert.throws(() => action({ url: '/' }), /method/);
  // @ts-expect-error Deliberately exercise runtime validation for untyped JavaScript callers.
  assert.throws(() => provider({ url: '/', accepts: 'json' }), /function/);
  // @ts-expect-error Deliberately exercise runtime validation for untyped JavaScript callers.
  assert.throws(() => provider({ url: '/', paginated: { mode: 'infinite' } }), /Pagination/);
});
test('no-content, empty arrays, errors and timeout are distinct states', async () => {
  reset();
  globalThis.fetch = async () => new Response(null, { status: 204 });
  assert.equal((await named(provider({ url: '/' }))()).context.noContent, true);
  globalThis.fetch = async () => new Response('[]');
  assert.equal((await named(provider({ url: '/' }))()).context.success, true);
  globalThis.fetch = async () => new Response('bad', { status: 500 });
  const failure = await named(provider({ url: '/' }))();
  assert.equal(failure.context.error, true);
  assert.equal(failure.context.statusCode, 500);
  globalThis.fetch = (_url, options) =>
    new Promise((_resolve, reject) =>
      options!.signal!.addEventListener('abort', () => reject(new Error('aborted'))),
    );
  assert.equal((await named(provider({ url: '/', timeout: 0.001 }))()).context.error, true);
  reset();
});
test('context functions run in every state; a throwing context never blocks the request', async () => {
  reset();
  let fail = false;
  globalThis.fetch = async () =>
    new Response(fail ? 'failed' : '{"page":1,"pages":2}', { status: fail ? 500 : 200 });
  const seen: unknown[] = [];
  const load = named(
    provider<unknown, { page: number; pages: number }>({
      url: '/paged',
      context: (response, status) => {
        seen.push(status ?? null);
        return { hasMore: Boolean(response && response.page < response.pages) };
      },
    }),
  );
  const success = await load();
  assert.equal(success.context.hasMore, true);
  fail = true;
  const failed = await named(provider({ url: '/other', context: () => ({ seen: true }) }))();
  assert.equal(failed.context.error, true);
  assert.equal(failed.context.seen, true);
  assert.deepEqual(seen, [null, 200]);

  fail = false;
  const reported: unknown[] = [];
  const log = console.error;
  console.error = (error: unknown) => reported.push(error);
  const careless = named(
    provider<unknown, { page: number }>({
      url: '/careless',
      context: (response) => ({ page: response!.page }),
    }),
  );
  const result = await careless();
  console.error = log;
  assert.equal(result.context.success, true);
  assert.equal(result.context.page, 1);
  assert.equal(reported.length, 1);
  reset();
});
