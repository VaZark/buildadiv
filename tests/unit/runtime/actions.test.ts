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
