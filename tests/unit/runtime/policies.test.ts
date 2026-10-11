import test from 'node:test';
import assert from 'node:assert/strict';
import { respectCacheOr, serializeArgs } from '../../../packages/runtime/data/policies.js';

test('HTTP freshness respects age, directives, expires and fallback', () => {
  const policy = respectCacheOr(300);
  assert.equal(policy(new Headers()), 300);
  assert.equal(policy(new Headers({ 'Cache-Control': 'public, max-age=60', Age: '10' })), 50);
  assert.equal(policy(new Headers({ 'Cache-Control': 'no-store' })), 0);
  assert.equal(policy(new Headers({ 'Cache-Control': 'no-cache' })), 0);
  assert.ok(policy(new Headers({ Expires: new Date(Date.now() + 60000).toUTCString() })) > 58);
  assert.equal(serializeArgs({ b: 2, a: 1 }), serializeArgs({ a: 1, b: 2 }));
});
