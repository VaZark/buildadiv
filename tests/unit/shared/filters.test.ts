import test from 'node:test';
import assert from 'node:assert/strict';
import {
  currency,
  date,
  fallback,
  lower,
  number,
  percent,
  relativeTime,
  truncate,
  upper,
} from '../../../packages/shared/filters.js';
import { evaluate } from '../../../packages/shared/pipeline.js';

/**
 * Filters read their locale from `<html lang>`. Give them one synchronously and
 * restore it before returning, so no other test can observe the stub.
 */
function inLanguage<Result>(lang: string, run: () => Result): Result {
  const scope = globalThis as { document?: unknown };
  const previous = scope.document;
  scope.document = { documentElement: { lang } };
  try {
    return run();
  } finally {
    if (previous === undefined) delete scope.document;
    else scope.document = previous;
  }
}
const english = <Result>(run: () => Result): Result => inLanguage('en-US', run);
// Intl may use narrow no-break spaces; compare with ordinary spaces.
const spaces = (value: unknown) => String(value).replace(/[  ]/g, ' ');

test('fallback replaces only missing values and is the one filter always available', () => {
  assert.equal(fallback(null, '—'), '—');
  assert.equal(fallback(undefined, '—'), '—');
  assert.equal(fallback('', '—'), '—');
  assert.equal(fallback(0, '—'), 0);
  assert.equal(fallback(false, '—'), false);
  assert.equal(fallback('Ada', '—'), 'Ada');
  assert.equal(fallback(null), '');
  // Registered nowhere, yet usable: the runtime and the builder both include it by default.
  assert.equal(evaluate("missing | fallback:'none'", {}, { fallback }), 'none');
});

test('currency formats with the page locale and an ISO code (USD by default)', () => {
  english(() => {
    assert.equal(currency(1234.5, 'EUR'), '€1,234.50');
    assert.equal(currency(5), '$5.00');
    assert.equal(currency('19.9', 'GBP'), '£19.90');
  });
  assert.equal(
    inLanguage('de-DE', () => spaces(currency(1234.5, 'EUR'))),
    '1.234,50 €',
  );
  assert.throws(() => english(() => currency(1, 'NOT-A-CODE')), RangeError);
});

test('number and percent format with the page locale', () => {
  english(() => {
    assert.equal(number(1234.5), '1,234.5');
    assert.equal(number('42'), '42');
    assert.equal(percent(0.256), '26%');
    assert.equal(percent(1), '100%');
  });
  assert.equal(
    inLanguage('de-DE', () => number(1234.5)),
    '1.234,5',
  );
});

test('date takes an Intl date style (medium by default); invalid input fails visibly', () => {
  const noon = '2025-01-15T12:00:00';
  english(() => {
    assert.equal(date(noon), 'Jan 15, 2025');
    assert.equal(date(noon, 'long'), 'January 15, 2025');
    assert.equal(date(noon, 'short'), '1/15/25');
    assert.equal(date(new Date(2025, 0, 15).getTime(), 'long'), 'January 15, 2025');
  });
  assert.equal(
    inLanguage('fr-FR', () => date(noon, 'long')),
    '15 janvier 2025',
  );
  assert.throws(() => english(() => date('not a date')), RangeError);
  assert.throws(() => english(() => date(noon, 'gigantic')), RangeError);
});

test('relativeTime formats a signed offset in the given unit (seconds by default)', () => {
  english(() => {
    assert.equal(relativeTime(-1, 'day'), 'yesterday');
    assert.equal(relativeTime(1, 'day'), 'tomorrow');
    assert.equal(relativeTime(3, 'hour'), 'in 3 hours');
    assert.equal(relativeTime(-30), '30 seconds ago');
  });
  assert.throws(() => english(() => relativeTime(1, 'fortnight')), RangeError);
});

test('upper and lower use the page locale for case rules', () => {
  english(() => {
    assert.equal(upper('café'), 'CAFÉ');
    assert.equal(lower('ADA'), 'ada');
    assert.equal(upper(42), '42');
  });
  // Turkish has a dotted capital I: locale-aware casing matters.
  assert.equal(
    inLanguage('tr', () => upper('istanbul')),
    'İSTANBUL',
  );
});

test('truncate limits length including the ellipsis (40 by default)', () => {
  assert.equal(truncate('abcdef', 4), 'abc…');
  assert.equal(truncate('abcd', 4), 'abcd');
  assert.equal(truncate('abcdef', 1), '…');
  assert.equal(truncate('abcdef', 0), '');
  assert.equal(truncate('x'.repeat(41)), `${'x'.repeat(39)}…`);
  assert.equal(truncate('<b>bold</b>', 5), '<b>b…');
  assert.throws(() => truncate('abc', 'many'), RangeError);
});

test('every opt-in filter passes missing values through so fallback can follow', () => {
  const filters = { currency, number, percent, date, relativeTime, upper, lower, truncate };
  for (const [name, filter] of Object.entries(filters)) {
    assert.equal(filter(null), null, `${name}(null)`);
    assert.equal(filter(undefined), undefined, `${name}(undefined)`);
    assert.equal(
      evaluate(`missing | ${name} | fallback:'—'`, {}, { ...filters, fallback }),
      '—',
      `${name} then fallback`,
    );
  }
});
