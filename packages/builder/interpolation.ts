import type { FilterRegistry } from '@buildadiv/shared/types.js';
import { evaluate } from '@buildadiv/shared/pipeline.js';

/**
 * Evaluate only expressions present in authored strings. Filter output is plain
 * text, including any braces it contains; missing values become empty strings.
 */
export function interpolate(source: string, data: unknown, filters: FilterRegistry): string {
  return source.replace(/{{\s*([^{}]+?)\s*}}/g, (_match, pipeline) => {
    const value = evaluate(pipeline.trim(), data, filters);
    return value == null ? '' : String(value);
  });
}
