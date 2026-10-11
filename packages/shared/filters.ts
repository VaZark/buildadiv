import type { Filter, FilterArgument, FilterContext } from './types.js';

/**
 * Every formatting filter is locale-aware. The locale is, in order: the filter's own
 * trailing argument (`number:de-DE`), the evaluating context (configured locale or
 * the page's `<html lang>`), then the environment's default. An empty argument
 * (`date::fr-FR`) keeps that argument's default.
 */
function localeFor(context: FilterContext | void, override?: FilterArgument): string | undefined {
  return (
    (override === undefined || override === '' ? context?.locale : String(override)) || undefined
  );
}
/** An argument left empty in the pipeline means "use the default". */
const given = (argument: FilterArgument | undefined): argument is FilterArgument =>
  argument !== undefined && argument !== '';

/** Replace absent values, keeping legitimate zero and false values intact. */
export const fallback: Filter = (value, replacement = '') =>
  value == null || value === '' ? replacement : value;

/** Case transforms use the locale's rules (Turkish `i` → `İ`) and preserve missing values. */
export const upper: Filter = function (value, locale) {
  return value == null ? value : String(value).toLocaleUpperCase(localeFor(this, locale));
};
export const lower: Filter = function (value, locale) {
  return value == null ? value : String(value).toLocaleLowerCase(localeFor(this, locale));
};

/** Limit text length including its ellipsis, without interpreting markup. */
export const truncate: Filter = (value, length: FilterArgument = 40) => {
  if (value == null) return value;
  const text = String(value),
    limit = Math.max(0, Math.floor(Number(length)));
  if (Number.isNaN(limit)) throw new RangeError('Truncate length must be numeric');
  if (limit === 0) return '';
  return text.length > limit ? text.slice(0, Math.max(0, limit - 1)) + '…' : text;
};

/** Numbers group and punctuate per locale. */
export const number: Filter = function (value, locale) {
  return value == null
    ? value
    : new Intl.NumberFormat(localeFor(this, locale)).format(Number(value));
};
/**
 * Money, formatted for the locale. The currency is the named code or the configured
 * one; `Intl` validates both and the locale. Intl cannot pick a currency for a
 * locale, so a missing one is an error that says how to supply it.
 */
export const currency: Filter = function (value, code, locale) {
  if (value == null) return value;
  const chosen = given(code) ? String(code) : this?.currency;
  if (!chosen)
    throw new TypeError('currency needs a code: name one (currency:EUR) or configure a currency');
  return new Intl.NumberFormat(localeFor(this, locale), {
    style: 'currency',
    currency: chosen,
  }).format(Number(value));
};
/** A fraction as a percentage, formatted for the locale. */
export const percent: Filter = function (value, locale) {
  return value == null
    ? value
    : new Intl.NumberFormat(localeFor(this, locale), { style: 'percent' }).format(Number(value));
};
/** Format a date using an Intl dateStyle (medium by default); invalid dates/styles fail visibly. */
export const date: Filter = function (value, style, locale) {
  return value == null
    ? value
    : new Intl.DateTimeFormat(localeFor(this, locale), {
        dateStyle: (given(style)
          ? String(style)
          : 'medium') as Intl.DateTimeFormatOptions['dateStyle'],
      }).format(new Date(value as string | number | Date));
};
/** Format a signed offset in the requested unit (seconds by default), rather than guessing it. */
export const relativeTime: Filter = function (value, unit, locale) {
  return value == null
    ? value
    : new Intl.RelativeTimeFormat(localeFor(this, locale), { numeric: 'auto' }).format(
        Number(value),
        (given(unit) ? String(unit) : 'second') as Intl.RelativeTimeFormatUnit,
      );
};
