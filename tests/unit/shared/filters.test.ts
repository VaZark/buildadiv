import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fallback,
  lower,
  upper,
  currency,
  number,
  truncate,
  relativeTime,
} from '../../../packages/shared/filters.js';

test('opt-in filters preserve missing values and use single-value transforms', () => {
  assert.equal(fallback(0, 'missing'), 0);
  assert.equal(fallback(false, 'missing'), false);
  assert.equal(lower('HELLO'), 'hello');
  assert.equal(upper(undefined), undefined);
  assert.equal(currency(null, 'EUR'), null);
  assert.match(String(currency(25, 'EUR')), /25[.,]00/);
  assert.equal(number(1200), new Intl.NumberFormat().format(1200));
  assert.equal(truncate('abcdef', 0), '');
  assert.equal(truncate('abcdef', 4), 'abc…');
  assert.equal(relativeTime(null, 'day'), null);
});
