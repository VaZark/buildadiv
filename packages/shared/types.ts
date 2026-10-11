/** Pipeline arguments are literals, not executable expressions or data paths. */
export type FilterArgument = string | number;
/**
 * Formatting defaults supplied by whoever evaluates a pipeline: the runtime (its
 * configuration, then the page's `<html lang>`) or the builder (its options, then
 * the built page's `<html lang>`). Filters read it as `this`; a per-use argument
 * still wins.
 */
export interface FilterContext {
  locale?: string;
  currency?: string;
}
/**
 * Single-value transforms keep template logic limited to formatting/fallbacks.
 * `this` is the formatting context; filters that don't format (or arrow functions)
 * simply ignore it.
 */
export type Filter = (
  this: FilterContext | void,
  value: unknown,
  ...args: FilterArgument[]
) => unknown;
export type FilterRegistry = Record<string, Filter>;
/** Shared DOM operations accept containers without assuming a live document. */
export type DomRoot = Document | DocumentFragment | Element;
