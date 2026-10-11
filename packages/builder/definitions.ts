import type { ComponentFile } from '../shared/components.js';
import type { DomRoot } from '../shared/types.js';
import { readComponentFile } from '../shared/components.js';
import { parseHtml } from './html.js';

/** Only hyphenated names are static component tags; single-word names stay runtime declarations. */
export function isStaticComponentName(name: string | null): name is string {
  return Boolean(name?.includes('-'));
}

/** Stylesheet and behavior-module URLs a component file declares, for the global build. */
export interface ComponentAssets {
  styles: string[];
  scripts: string[];
}
export interface Definitions {
  templates: Map<string, HTMLTemplateElement>;
  assets: Map<string, ComponentAssets>;
}

const isComponentFile = (source: unknown): source is ComponentFile =>
  typeof source === 'object' && source !== null && 'html' in source && 'url' in source;

/**
 * Reuse inline and external template declarations without consuming them: the
 * runtime still needs its declarations. Static names require a hyphen, and
 * ambiguous duplicate definitions fail before any component tags are replaced.
 * Component files also contribute the stylesheets and behavior modules they declare.
 * Strings and files are parsed with `parse`, the same DOM adapter as the page.
 */
export function collectDefinitions(
  root: DomRoot,
  sources: Iterable<DomRoot | string | ComponentFile>,
  parse: (html: string) => Document = parseHtml,
): Definitions {
  const definitions = new Map<string, HTMLTemplateElement>();
  const assets = new Map<string, ComponentAssets>();
  const seen = new Set<HTMLTemplateElement>();
  const add = (template: HTMLTemplateElement) => {
    if (seen.has(template)) return;
    seen.add(template);
    const name = template.getAttribute('data-component');
    if (!isStaticComponentName(name)) return;
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
    if (typeof source === 'string') scan(parse(source));
    else if (isComponentFile(source)) {
      const { templates, styles, scripts } = readComponentFile(parse(source.html), source.url);
      for (const template of templates) {
        add(template);
        const name = template.getAttribute('data-component');
        if (isStaticComponentName(name)) assets.set(name, { styles, scripts });
      }
    } else if (source) scan(source);
    else throw new TypeError('Components must be template elements, HTML strings or files');
  }
  return { templates: definitions, assets };
}
