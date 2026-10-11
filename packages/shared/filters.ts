import type { Filter, FilterArgument } from './types.js';

/** Use the page's language so standalone sites do not require locale configuration. */
const locale = (): string | undefined => globalThis.document?.documentElement.lang || undefined;
/** Replace absent values, keeping legitimate zero and false values intact. */
export const fallback: Filter = (value, replacement = '') =>
  value == null || value === '' ? replacement : value;
/** Case transforms preserve missing values so a later fallback can handle them. */
export const upper: Filter = (value) =>
  value == null ? value : String(value).toLocaleUpperCase(locale());
export const lower: Filter = (value) =>
  value == null ? value : String(value).toLocaleLowerCase(locale());
/** Limit text length including its ellipsis, without interpreting markup. */
export const truncate: Filter = (value, length: FilterArgument = 40) => {
  if (value == null) return value;
  const text = String(value),
    limit = Math.max(0, Math.floor(Number(length)));
  if (Number.isNaN(limit)) throw new RangeError('Truncate length must be numeric');
  if (limit === 0) return '';
  return text.length > limit ? text.slice(0, Math.max(0, limit - 1)) + '…' : text;
};
/** Numeric formatters delegate punctuation and currency placement to Intl. */
export const number: Filter = (value) =>
  value == null ? value : new Intl.NumberFormat(locale()).format(Number(value));
export const currency: Filter = (value, code = 'USD') =>
  value == null
    ? value
    : new Intl.NumberFormat(locale(), { style: 'currency', currency: String(code) }).format(
        Number(value),
      );
export const percent: Filter = (value) =>
  value == null
    ? value
    : new Intl.NumberFormat(locale(), { style: 'percent' }).format(Number(value));
/** Format a date using an Intl dateStyle; invalid dates/styles fail visibly. */
export const date: Filter = (value, style = 'medium') =>
  value == null
    ? value
    : new Intl.DateTimeFormat(locale(), {
        dateStyle: String(style) as Intl.DateTimeFormatOptions['dateStyle'],
      }).format(new Date(value as string | number | Date));
/** Format a numeric offset in the requested unit, rather than guessing its unit. */
export const relativeTime: Filter = (value, unit = 'second') =>
  value == null
    ? value
    : new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' }).format(
        Number(value),
        String(unit) as Intl.RelativeTimeFormatUnit,
      );
