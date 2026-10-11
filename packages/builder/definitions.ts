import type { DomRoot } from '../shared/types.js';
import { parseHtml } from './html.js';

/**
 * Reuse inline and external template declarations without consuming them: the
 * runtime still needs its declarations. Static names require a hyphen, and
 * ambiguous duplicate definitions fail before any component tags are replaced.
 */
export function collectDefinitions(
  root: DomRoot,
  sources: Iterable<DomRoot | string>,
): Map<string, HTMLTemplateElement> {
  const definitions = new Map<string, HTMLTemplateElement>();
  const seen = new Set<HTMLTemplateElement>();
  const add = (template: HTMLTemplateElement) => {
    if (seen.has(template)) return;
    seen.add(template);
    const name = template.getAttribute('data-component');
    if (!name?.includes('-')) return;
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(name) || name === 'render-template') {
      throw new Error(`Invalid static component name: ${name}`);
    }
    if (definitions.has(name)) throw new Error(`Duplicate component: ${name}`);
    definitions.set(name, template);
  };
  const scan = (source: DomRoot) => {
    if (
      source.nodeType === 1 &&
      (source as Element).localName === 'template' &&
      (source as Element).hasAttribute('data-component')
    )
      add(source as HTMLTemplateElement);
    for (const template of source.querySelectorAll<HTMLTemplateElement>('template[data-component]'))
      add(template);
  };
  scan(root);
  for (const source of sources) {
    if (typeof source === 'string') scan(parseHtml(source));
    else if (source) scan(source);
    else throw new TypeError('Components must be template elements or HTML strings');
  }
  return definitions;
}
