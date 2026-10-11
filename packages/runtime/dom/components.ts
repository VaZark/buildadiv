import { componentTemplates } from '../../shared/components.js';
import { scopeCss } from '../../shared/css.js';
import { settings } from '../configuration/settings.js';
import { reportFailure } from '../events.js';

const loads = new Map<string, Promise<HTMLTemplateElement | undefined>>();

/** Templates declared in the page (inline, shipped by the build or loaded) win over component files. */
export function findTemplate(name: string): HTMLTemplateElement | undefined {
  return Array.from(
    document.querySelectorAll<HTMLTemplateElement>('template[data-component]'),
  ).find((candidate) => candidate.dataset.component === name);
}

/**
 * Add a component's stylesheet, scoped to its elements with the same rules the
 * build uses. A stylesheet that fails to load is reported; the component still renders.
 */
async function addStyle(url: string, component: string): Promise<void> {
  try {
    const response = await fetch(new URL(url, document.baseURI));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const style = document.createElement('style');
    style.dataset.componentStyle = component;
    style.textContent = scopeCss(await response.text(), component);
    document.head.append(style);
  } catch (error) {
    reportFailure(new Error(`Component stylesheet failed to load: ${url} (${String(error)})`));
  }
}

/**
 * Behavior modules are ordinary ES modules imported once (the module map
 * deduplicates by URL). A failing module is reported; the component still
 * renders without that behavior.
 */
async function importBehavior(url: string): Promise<void> {
  try {
    await import(new URL(url, document.baseURI).href);
  } catch (error) {
    reportFailure(error);
  }
}

/**
 * Resolve a template by name, loading its component folder through the configured
 * loader when the page does not declare it. Each component loads once: its
 * stylesheet is added and its behavior imported before the template is added to
 * the document, so the first render already has both. Resolves undefined for
 * unknown components.
 */
export function ensureTemplate(name: string): Promise<HTMLTemplateElement | undefined> {
  const declared = findTemplate(name);
  if (declared) return Promise.resolve(declared);
  const loader = settings.components;
  if (!loader) return Promise.resolve(undefined);
  let load = loads.get(name);
  if (!load) {
    load = (async () => {
      const file = await loader(name);
      if (!file) return undefined;
      const parsed = new DOMParser().parseFromString(file.html, 'text/html');
      await Promise.all([
        file.style ? addStyle(file.style, name) : undefined,
        file.script ? importBehavior(file.script) : undefined,
      ]);
      for (const template of componentTemplates(parsed)) {
        if (!findTemplate(template.dataset.component!))
          document.body.append(document.importNode(template, true));
      }
      return findTemplate(name);
    })();
    // A failed load (network, invalid name) may be retried by a later render.
    load.catch(() => loads.delete(name));
    loads.set(name, load);
  }
  return load;
}
