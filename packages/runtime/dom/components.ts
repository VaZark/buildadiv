import { readComponentFile } from '../../shared/components.js';
import { settings } from '../configuration/settings.js';
import { reportFailure } from '../events.js';

const loads = new Map<string, Promise<HTMLTemplateElement | undefined>>();

/** Templates declared in the page (inline or previously loaded) win over component files. */
export function findTemplate(name: string): HTMLTemplateElement | undefined {
  return Array.from(
    document.querySelectorAll<HTMLTemplateElement>('template[data-component]'),
  ).find((candidate) => candidate.dataset.component === name);
}

/** Link a component stylesheet once, resolving when it has loaded or failed. */
function linkStylesheet(href: string): Promise<void> {
  const absolute = new URL(href, document.baseURI).href;
  const existing = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]'),
  ).some((link) => link.href === absolute);
  if (existing) return Promise.resolve();
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = absolute;
  const settled = new Promise<void>((resolve) => {
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener('error', () => {
      reportFailure(new Error(`Component stylesheet failed to load: ${absolute}`));
      resolve();
    });
  });
  document.head.append(link);
  return settled;
}

/**
 * Behavior modules are ordinary ES modules imported once (the module map
 * deduplicates by URL, including modules a built page already loads). A failing
 * module is reported; the component still renders without that behavior.
 */
async function importBehavior(src: string): Promise<void> {
  try {
    await import(new URL(src, document.baseURI).href);
  } catch (error) {
    reportFailure(error);
  }
}

/**
 * Resolve a template by name, loading its component file through the configured
 * loader when the page does not declare it. Each component loads once: its
 * stylesheets are linked and its behavior imported before the template is added
 * to the document, so the first render already has both. Resolves undefined for
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
      const parts = readComponentFile(parsed, file.url);
      await Promise.all([
        ...parts.styles.map(linkStylesheet),
        ...parts.scripts.map(importBehavior),
      ]);
      for (const template of parts.templates) {
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
