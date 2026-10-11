import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePath, truthy } from '../../../packages/shared/path.js';

test('paths resolve own properties and array indices without traversing prototypes', () => {
  assert.equal(resolvePath({ results: [{ id: 4 }] }, 'results.0.id'), 4);
  assert.equal(resolvePath({}, 'toString'), undefined);
  assert.equal(resolvePath({}, '__proto__.polluted'), undefined);
  assert.equal(resolvePath(null, 'a.b'), undefined);
  for (const value of [[], 0, '', null, undefined, false]) assert.equal(truthy(value), false);
  assert.equal(truthy([0]), true);
});
