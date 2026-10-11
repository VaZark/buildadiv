import type { BuildOptions, ComponentUsage, PageBuild, PageOptions } from './contracts.js';
import { bundlePage } from './bundling.js';
import { parseHtml, serializeHtml } from './html.js';
import { collectDefinitions } from './definitions.js';
import { expandComponents } from './expansion.js';
import { removeStaticDefinitions, runtimeTemplateNames } from './pruning.js';
import { loadComponents } from './loading.js';

/**
 * Compile one page and record which components it uses. Component tags are
 * expanded; definitions the runtime still renders are kept (external ones are
 * added to the page) and the rest are dropped. Component stylesheets and
 * behavior modules are never linked individually: they are reported in
 * `components` for the page bundle or the site's global build.
 */
function compilePage(
  html: string,
  { parse = parseHtml, components = [], ...options }: BuildOptions,
): { document: Document; components: ComponentUsage[] } {
  const document = parse(html);
  const definitions = collectDefinitions(document, components, parse);
  const used = new Set<string>();
  expandComponents(document, {
    ...options,
    components: definitions.templates.values(),
    onExpand: (name) => {
      used.add(name);
      options.onExpand?.(name);
    },
  });

  const lookup = (name: string) => {
    const template = definitions.templates.get(name);
    return template ? [template] : [];
  };
  const runtime = runtimeTemplateNames(document, lookup);
  for (const name of runtime) {
    const template = definitions.templates.get(name);
    if (template && !document.contains(template))
      (document.body ?? document.documentElement).append(document.importNode(template, true));
  }
  removeStaticDefinitions(document);

  const usage: ComponentUsage[] = [];
  for (const name of new Set([...used, ...runtime])) {
    if (!definitions.templates.has(name)) continue;
    const assets = definitions.assets.get(name);
    usage.push({ name, styles: assets?.styles ?? [], scripts: assets?.scripts ?? [] });
  }
  return { document, components: usage };
}

/**
 * Compile an HTML string without editing the source page. Parsing and output are
 * exported default functions so a future CLI can supply a DOM adapter; component
 * expansion itself stays browser-compatible and independent of the runtime.
 */
export function buildHtml(html: string, options: BuildOptions = {}): string {
  return (options.serialize ?? serializeHtml)(compilePage(html, options).document);
}

/**
 * Build a page whose components live in files: load every component it uses
 * (tags and runtime references, transitively) through `loadComponent`, compile
 * it and report its component usage. With `bundle`, the used components' CSS and
 * JS are unified into one minified file each, named from the project and page
 * prefixes and linked from the page; the files are returned for the caller to
 * write. Loading and bundling stay supplied functions, so the same build works
 * from a server folder, an editor buffer or the File System Access API.
 */
export async function buildPage(
  html: string,
  { loadComponent, bundle, ...options }: PageOptions,
): Promise<PageBuild> {
  const parse = options.parse ?? parseHtml;
  const files = await loadComponents(parse(html), loadComponent, parse);
  const { document, components } = compilePage(html, {
    ...options,
    components: [...(options.components ?? []), ...files],
  });
  const bundled = bundle ? await bundlePage(document, components, bundle) : undefined;
  const serialize = options.serialize ?? serializeHtml;
  return { html: serialize(document), components, ...(bundled && { bundle: bundled }) };
}
