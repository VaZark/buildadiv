import type { FilterArgument, FilterRegistry } from './types.js';
import { resolvePath } from './path.js';

/** Split only unquoted separators so literal URLs and punctuation stay intact. */
function split(source: string, separator: string): string[] {
  const pieces: string[] = [];
  let buffer = '',
    quote = '',
    escape = false;
  for (const character of source) {
    if (escape) {
      buffer += character;
      escape = false;
      continue;
    }
    if (character === '\\' && quote) {
      escape = true;
      buffer += character;
      continue;
    }
    if (quote) {
      if (character === quote) quote = '';
      buffer += character;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      buffer += character;
      continue;
    }
    if (character === separator) {
      pieces.push(buffer.trim());
      buffer = '';
    } else buffer += character;
  }
  if (quote || escape) throw new SyntaxError('Unterminated filter argument');
  pieces.push(buffer.trim());
  return pieces;
}

/** Parse paths and literal filter arguments; reject expressions rather than execute them. */
export function parsePipeline(source: string): {
  path: string;
  filters: { name: string; args: FilterArgument[] }[];
} {
  const [path, ...filters] = split(source, '|');
  if (!/^[\w$]+(?:\.[\w$]+)*$/.test(path)) throw new SyntaxError(`Invalid binding path: ${path}`);
  return {
    path,
    filters: filters.map((part) => {
      const [name, ...args] = split(part, ':');
      if (!/^[\w-]+$/.test(name)) throw new SyntaxError(`Invalid filter: ${name}`);
      return {
        name,
        args: args.map((argument) => {
          if (/^(['"]).*\1$/s.test(argument))
            return argument.slice(1, -1).replace(/\\(['"\\])/g, '$1');
          if (/^-?\d+(?:\.\d+)?$/.test(argument)) return Number(argument);
          return argument;
        }),
      };
    }),
  };
}

/** Apply explicitly registered transforms in order; unknown filters are errors. */
export function evaluate(source: string, data: unknown, registry: FilterRegistry): unknown {
  const { path, filters } = parsePipeline(source);
  let value = resolvePath(data, path);
  for (const { name, args } of filters) {
    if (!Object.hasOwn(registry, name) || typeof registry[name] !== 'function')
      throw new Error(`Unregistered filter: ${name}`);
    value = registry[name](value, ...args);
  }
  return value;
}
