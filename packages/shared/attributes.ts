const urlAttributes = new Set([
  'href',
  'src',
  'action',
  'formaction',
  'poster',
  'cite',
  'background',
  'xlink:href',
]);

/**
 * Both static interpolation and live bindings need the same attribute boundary.
 * Return a string for ordinary values, or null to remove missing/unsafe values;
 * executable attributes and unsafe URL schemes never accept bound data.
 */
export function safeAttribute(name: string, value: unknown): string | null {
  name = name.toLowerCase();
  if (/^on/.test(name) || ['srcdoc', 'style', 'srcset'].includes(name)) return null;
  if (value == null) return null;
  const string = String(value);
  if (urlAttributes.has(name)) {
    const compact = string.replace(/[\u0000-\u0020\u007f]/g, '');
    if (/^(?:javascript|vbscript|data):/i.test(compact)) return null;
  }
  return string;
}
