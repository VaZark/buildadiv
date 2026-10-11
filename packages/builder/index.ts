// The public builder API composes independently reviewable expansion stages.
export type { ExpansionOptions, BuildOptions } from './contracts.js';
export { buildHtml } from './build.js';
export { expandComponents } from './expansion.js';
export { parseHtml, serializeHtml } from './html.js';
