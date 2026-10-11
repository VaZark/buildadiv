/**
 * Component CSS is written plainly (`.card { … }`) and scoped to the component's
 * own elements through the `data-c` attribute the build adds (to expanded tags and
 * to shipped runtime templates): `.card` → `.card[data-c="product-card"]`. The
 * runtime knows nothing about components; scoping is entirely the build's.
 *
 * Only the last compound of each selector is scoped, as in Vue's scoped styles:
 * ancestors may be page elements, the styled element is the component's. Rules in
 * conditional group at-rules are scoped; other at-rules (keyframes, font faces)
 * and selectors that already mention `[data-c` are left as written.
 */
export function scopeCss(css: string, component: string): string {
  return scopeRules(css, `[data-c="${component.replace(/["\\]/g, '\\$&')}"]`);
}

const groupingAtRules = /^@(?:media|supports|container|layer|scope|document)\b/i;
const legacyPseudoElements = /^:(?:before|after|first-line|first-letter)\b/i;

/** Index just after a quoted string or comment starting at `index`, or -1 if none starts there. */
function skipLiteral(text: string, index: number): number {
  const character = text[index];
  if (character === '/' && text[index + 1] === '*') {
    const end = text.indexOf('*/', index + 2);
    return end < 0 ? text.length : end + 2;
  }
  if (character === '"' || character === "'") {
    for (let cursor = index + 1; cursor < text.length; cursor++) {
      if (text[cursor] === '\\') cursor++;
      else if (text[cursor] === character) return cursor + 1;
    }
    return text.length;
  }
  return -1;
}

/** Find the next top-level `{`, `;` or `}` from `index`, skipping strings, comments and brackets. */
function nextDelimiter(text: string, index: number): number {
  let depth = 0;
  for (let cursor = index; cursor < text.length; cursor++) {
    const skipped = skipLiteral(text, cursor);
    if (skipped >= 0) {
      cursor = skipped - 1;
      continue;
    }
    const character = text[cursor];
    if (character === '(' || character === '[') depth++;
    else if (character === ')' || character === ']') depth--;
    else if (depth === 0 && (character === '{' || character === ';' || character === '}'))
      return cursor;
  }
  return text.length;
}

/** Index of the `}` matching the `{` at `open`. */
function matchingBrace(text: string, open: number): number {
  let depth = 0;
  for (let cursor = open; cursor < text.length; cursor++) {
    const skipped = skipLiteral(text, cursor);
    if (skipped >= 0) {
      cursor = skipped - 1;
      continue;
    }
    if (text[cursor] === '{') depth++;
    else if (text[cursor] === '}' && --depth === 0) return cursor;
  }
  return text.length;
}

/** Rewrite style-rule preludes in a rule list, recursing into grouping at-rules. */
function scopeRules(css: string, scope: string): string {
  let output = '';
  let cursor = 0;
  while (cursor < css.length) {
    const delimiter = nextDelimiter(css, cursor);
    if (delimiter >= css.length || css[delimiter] !== '{') {
      output += css.slice(cursor, delimiter + 1);
      cursor = delimiter + 1;
      continue;
    }
    const close = matchingBrace(css, delimiter);
    const prelude = css.slice(cursor, delimiter);
    const block = css.slice(delimiter + 1, close);
    const statement = prelude.replace(/^(?:\s|\/\*[\s\S]*?\*\/)*/, '');
    if (statement.startsWith('@'))
      output += groupingAtRules.test(statement)
        ? `${prelude}{${scopeRules(block, scope)}}`
        : `${prelude}{${block}}`;
    else output += `${scopeSelectorList(prelude, scope)}{${block}}`;
    cursor = close + 1;
  }
  return output;
}

/** Split on top-level commas, keeping each selector's surrounding whitespace. */
function splitSelectors(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let cursor = 0; cursor < list.length; cursor++) {
    const skipped = skipLiteral(list, cursor);
    if (skipped >= 0) {
      cursor = skipped - 1;
      continue;
    }
    const character = list[cursor];
    if (character === '(' || character === '[') depth++;
    else if (character === ')' || character === ']') depth--;
    else if (character === ',' && depth === 0) {
      parts.push(list.slice(start, cursor));
      start = cursor + 1;
    }
  }
  parts.push(list.slice(start));
  return parts;
}

function scopeSelectorList(list: string, scope: string): string {
  return splitSelectors(list)
    .map((selector) => {
      const [, before, body, after] = /^(\s*)([\s\S]*?)(\s*)$/.exec(selector)!;
      return body ? before + scopeSelector(body, scope) + after : selector;
    })
    .join(',');
}

/** Add the scope to the selector's last compound, before any pseudo-element. */
function scopeSelector(selector: string, scope: string): string {
  let depth = 0;
  let compoundStart = 0;
  let pseudoElement = -1;
  for (let cursor = 0; cursor < selector.length; cursor++) {
    const skipped = skipLiteral(selector, cursor);
    if (skipped >= 0) {
      cursor = skipped - 1;
      continue;
    }
    const character = selector[cursor];
    if (character === '(' || character === '[') depth++;
    else if (character === ')' || character === ']') depth--;
    else if (depth === 0 && /[\s>+~]/.test(character)) {
      compoundStart = cursor + 1;
      pseudoElement = -1;
    } else if (depth === 0 && character === ':' && pseudoElement < 0) {
      const rest = selector.slice(cursor);
      if (rest.startsWith('::') || legacyPseudoElements.test(rest)) pseudoElement = cursor;
    }
  }
  const compound = selector.slice(compoundStart);
  if (/\[\s*data-c\b/.test(compound)) return selector;
  const insertAt = pseudoElement >= 0 ? pseudoElement : selector.length;
  return selector.slice(0, insertAt) + scope + selector.slice(insertAt);
}
