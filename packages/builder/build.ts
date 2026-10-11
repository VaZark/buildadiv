import type { BuildOptions } from './contracts.js';
import { parseHtml, serializeHtml } from './html.js';
import { expandComponents } from './expansion.js';

/**
 * Compile an HTML string without editing the source page. Parsing and output are
 * exported default functions so a future CLI can supply a DOM adapter; component
 * expansion itself stays browser-compatible and independent of the runtime.
 */
export function buildHtml(
  html: string,
  { parse = parseHtml, serialize = serializeHtml, ...options }: BuildOptions = {},
): string {
  const document = parse(html);
  expandComponents(document, options);
  return serialize(document);
}
