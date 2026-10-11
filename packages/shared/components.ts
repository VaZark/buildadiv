import type { DomRoot } from './types.js';

/** A component's HTML file and the URL it came from (absolute or root-relative). */
export interface ComponentFile {
  url: string;
  html: string;
}
/** Find one component's file by name; resolve undefined when it does not exist. */
export type ComponentLoader = (name: string) => Promise<ComponentFile | undefined>;
/** What a component file declares: its templates and its optional stylesheet/behavior URLs. */
export interface ComponentParts {
  templates: HTMLTemplateElement[];
  styles: string[];
  scripts: string[];
}

const componentName = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const placeholderOrigin = 'https://component.invalid';

/**
 * Resolve a URL written inside a component file against that file's URL. Root-relative
 * file URLs stay root-relative, so built pages do not embed the builder's origin.
 */
function resolveAgainst(href: string, fileUrl: string): string {
  const resolved = new URL(href, new URL(fileUrl, placeholderOrigin));
  return resolved.origin === placeholderOrigin
    ? resolved.pathname + resolved.search + resolved.hash
    : resolved.href;
}

/** Absolute and root-relative bases are kept; a relative base resolves against the page. */
function folderRoot(base: string | URL): string {
  let root = String(base);
  if (!/^[a-z][a-z\d+.-]*:/i.test(root) && !root.startsWith('/')) {
    const page = globalThis.location?.href;
    if (!page) throw new TypeError(`A relative component folder needs a page URL: ${root}`);
    root = new URL(root, page).href;
  }
  return root.endsWith('/') ? root : `${root}/`;
}

/**
 * The default loader for the `components/<name>/<name>.html` folder convention.
 * A missing file resolves undefined (an unknown component); other HTTP failures
 * reject. Names are validated so a template name can never escape the folder.
 * Pass a root-relative base (`/components/`) so built pages link root-relative assets.
 */
export function componentFolder(base: string | URL): ComponentLoader {
  const root = folderRoot(base);
  return async (name) => {
    if (!componentName.test(name)) throw new Error(`Invalid component name: ${name}`);
    const url = `${root}${name}/${name}.html`;
    const response = await fetch(new URL(url, globalThis.location?.href ?? placeholderOrigin));
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error(`Loading component ${name} failed: HTTP ${response.status}`);
    return { url, html: await response.text() };
  };
}

/**
 * Read a parsed component file. Stylesheets and module scripts are optional and
 * declared with ordinary `<link rel="stylesheet">` and `<script type="module" src>`
 * tags; their URLs resolve against the file. Nothing is executed here.
 */
export function readComponentFile(root: DomRoot, url: string): ComponentParts {
  return {
    templates: Array.from(root.querySelectorAll<HTMLTemplateElement>('template[data-component]')),
    styles: Array.from(root.querySelectorAll('link[rel~="stylesheet"][href]'), (link) =>
      resolveAgainst(link.getAttribute('href')!, url),
    ),
    scripts: Array.from(root.querySelectorAll('script[type="module"][src]'), (script) =>
      resolveAgainst(script.getAttribute('src')!, url),
    ),
  };
}
