import type { FilterContext, FilterRegistry } from '@buildadiv/shared/types.js';
import { evaluate } from '@buildadiv/shared/pipeline.js';

/**
 * Evaluate only expressions present in authored strings. Filter output is plain
 * text, including any braces it contains; missing values become empty strings.
 * `context` is the formatting locale/currency for where this text sits in the page.
 */
export function interpolate(
  source: string,
  data: unknown,
  filters: FilterRegistry,
  context: FilterContext = {},
): string {
  return source.replace(/{{\s*([^{}]+?)\s*}}/g, (_match, pipeline) => {
    const value = evaluate(pipeline.trim(), data, filters, context);
    return value == null ? '' : String(value);
  });
}
