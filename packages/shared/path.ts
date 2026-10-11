const forbidden = new Set(['__proto__', 'prototype', 'constructor']);

/** Resolve own dot-path properties so bindings cannot traverse prototype chains. */
export function resolvePath(value: unknown, path?: string): unknown {
  if (!path) return value;
  for (const part of path.split('.')) {
    if (forbidden.has(part) || value == null || !Object.hasOwn(Object(value), part))
      return undefined;
    value = (Object(value) as Record<string, unknown>)[part];
  }
  return value;
}

/** Empty arrays mean “nothing to show,” unlike JavaScript's default truthiness. */
export function truthy(value: unknown): boolean {
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}
