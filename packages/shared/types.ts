/** Pipeline arguments are literals, not executable expressions or data paths. */
export type FilterArgument = string | number;
/** Single-value transforms keep template logic limited to formatting/fallbacks. */
export type Filter = (value: unknown, ...args: FilterArgument[]) => unknown;
export type FilterRegistry = Record<string, Filter>;
/** Shared DOM operations accept containers without assuming a live document. */
export type DomRoot = Document | DocumentFragment | Element;
