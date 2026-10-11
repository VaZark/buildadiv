import type { DomRoot } from './types.js';

/**
 * A component's template file and its optional stylesheet and behavior module.
 * By convention they sit together in `components/<name>/` as `<name>.html`,
 * `<name>.css` and `<name>.js`; whichever exists is picked up when the component
 * is used. URLs are absolute or root-relative.
 */
export interface ComponentFile {
  url: string;
  html: string;
  style?: string;
  script?: string;
}
/** Find one component's files by name; resolve undefined when it does not exist. */
export type ComponentLoader = (name: string) => Promise<ComponentFile | undefined>;

const componentName = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const placeholderOrigin = 'https://component.invalid';
/** Validated so a template name can never escape the components folder. */
export const isComponentName = (name: string): boolean => componentName.test(name);

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
 * The default loader for the component folder convention, over HTTP. A missing
 * template file (404) resolves undefined, an unknown component; other HTTP
 * failures reject. The optional stylesheet and behavior module are detected with
 * `HEAD` requests, so a component without them costs one quiet 404 each.
 * Pass a root-relative base (`/components/`) so built pages use root-relative URLs.
 */
export function componentFolder(base: string | URL): ComponentLoader {
  const root = folderRoot(base);
  const request = (url: string, method: 'GET' | 'HEAD') =>
    fetch(new URL(url, globalThis.location?.href ?? placeholderOrigin), { method });
  return async (name) => {
    if (!isComponentName(name)) throw new Error(`Invalid component name: ${name}`);
    const folder = `${root}${name}/${name}`;
    const response = await request(`${folder}.html`, 'GET');
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error(`Loading component ${name} failed: HTTP ${response.status}`);
    const [style, script] = await Promise.all(
      ['css', 'js'].map(async (extension) =>
        (await request(`${folder}.${extension}`, 'HEAD')).ok ? `${folder}.${extension}` : undefined,
      ),
    );
    return {
      url: `${folder}.html`,
      html: await response.text(),
      ...(style && { style }),
      ...(script && { script }),
    };
  };
}

/** The component templates a parsed component file declares. */
export function componentTemplates(root: DomRoot): HTMLTemplateElement[] {
  return Array.from(root.querySelectorAll<HTMLTemplateElement>('template[data-component]'));
}
