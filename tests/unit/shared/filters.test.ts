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
import type { FilterContext } from '../../../packages/shared/types.js';

/**
 * Filters take their formatting defaults as `this`: the runtime and the builder
 * pass the configured locale or the element's language. Tests pass it directly.
 */
const inLanguage = (locale: string, currency?: string): FilterContext => ({
  locale,
  ...(currency && { currency }),
});
const english = inLanguage('en-US');
// Intl may use narrow no-break spaces; compare with ordinary spaces.
const spaces = (value: unknown) => String(value).replace(/[\u00a0\u202f]/g, ' ');

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

test('currency formats a named or configured currency for the locale; Intl validates it', () => {
  const format = (locale: string, ...args: (string | number)[]) =>
    spaces(currency.call(inLanguage(locale), 1234.5, ...args));
  assert.equal(format('en-US', 'EUR'), '€1,234.50');
  assert.equal(format('de-DE', 'EUR'), '1.234,50 €');
  assert.equal(format('de-DE', 'USD'), '1.234,50 $');
  assert.equal(format('ja-JP', 'JPY'), '￥1,235');
  // A configured currency applies when the pipeline names none; a named code still wins.
  assert.equal(spaces(currency.call(inLanguage('en-US', 'EUR'), 5)), '€5.00');
  assert.equal(spaces(currency.call(inLanguage('en-US', 'EUR'), 5, 'GBP')), '£5.00');
  // A trailing argument overrides the locale for this one use; an empty code keeps the default.
  assert.equal(spaces(currency.call(english, 1234.5, 'EUR', 'fr-FR')), '1 234,50 €');
  assert.equal(
    spaces(currency.call(inLanguage('en-US', 'EUR'), 1234.5, '', 'de-DE')),
    '1.234,50 €',
  );
  // Intl cannot choose a currency for a locale, so a missing one says how to supply it.
  assert.throws(() => currency.call(english, 1), /currency needs a code/);
  // Invalid codes and locales are Intl's own errors.
  assert.throws(() => currency.call(english, 1, 'NOT-A-CODE'), RangeError);
  assert.throws(() => currency.call(english, 1, 'EUR', 'not a locale!'), RangeError);
});

test('number and percent group and punctuate per locale, overridable per use', () => {
  assert.equal(number.call(english, 1234.5), '1,234.5');
  assert.equal(number.call(english, '42'), '42');
  assert.equal(number.call(inLanguage('de-DE'), 1234.5), '1.234,5');
  assert.equal(spaces(number.call(inLanguage('fr-FR'), 1234.5)), '1 234,5');
  assert.equal(number.call(english, 1234.5, 'de-DE'), '1.234,5');
  assert.equal(percent.call(english, 0.256), '26%');
  assert.equal(spaces(percent.call(inLanguage('fr-FR'), 0.256)), '26 %');
  assert.equal(spaces(percent.call(english, 1, 'de-DE')), '100 %');
});

test('date takes a style (medium by default) and a locale; invalid input fails visibly', () => {
  const noon = '2025-01-15T12:00:00';
  assert.equal(date.call(english, noon), 'Jan 15, 2025');
  assert.equal(date.call(english, noon, 'long'), 'January 15, 2025');
  assert.equal(date.call(english, noon, 'short'), '1/15/25');
  assert.equal(date.call(english, new Date(2025, 0, 15).getTime(), 'long'), 'January 15, 2025');
  assert.equal(date.call(inLanguage('fr-FR'), noon, 'long'), '15 janvier 2025');
  // Per use: `date:long:ja-JP`, or `date::fr-FR` to keep the default style.
  assert.equal(date.call(english, noon, 'long', 'ja-JP'), '2025年1月15日');
  assert.equal(date.call(english, noon, '', 'fr-FR'), '15 janv. 2025');
  assert.throws(() => date.call(english, 'not a date'), RangeError);
  assert.throws(() => date.call(english, noon, 'gigantic'), RangeError);
});

test('relativeTime formats a signed offset in a unit (seconds by default) per locale', () => {
  assert.equal(relativeTime.call(english, -1, 'day'), 'yesterday');
  assert.equal(relativeTime.call(english, 1, 'day'), 'tomorrow');
  assert.equal(relativeTime.call(english, 3, 'hour'), 'in 3 hours');
  assert.equal(relativeTime.call(english, -30), '30 seconds ago');
  assert.equal(relativeTime.call(inLanguage('de-DE'), -1, 'day'), 'gestern');
  assert.equal(relativeTime.call(english, -1, 'day', 'es'), 'ayer');
  assert.throws(() => relativeTime.call(english, 1, 'fortnight'), RangeError);
});

test("upper and lower use the locale's case rules, overridable per use", () => {
  assert.equal(upper.call(english, 'café'), 'CAFÉ');
  assert.equal(lower.call(english, 'ADA'), 'ada');
  assert.equal(upper.call(english, 42), '42');
  // Turkish has a dotted capital I: locale-aware casing matters.
  assert.equal(upper.call(inLanguage('tr'), 'istanbul'), 'İSTANBUL');
  assert.equal(upper.call(english, 'istanbul', 'tr'), 'İSTANBUL');
  assert.equal(lower.call(inLanguage('tr'), 'I'), 'ı');
});

test('without any locale, filters use the environment default', () => {
  const environment = new Intl.NumberFormat().resolvedOptions().locale;
  assert.equal(number(1234.5), new Intl.NumberFormat(environment).format(1234.5));
  assert.equal(number.call({}, 1234.5), new Intl.NumberFormat(environment).format(1234.5));
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
