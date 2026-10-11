import type { ComponentFile, ComponentLoader } from './components.js';
import type { DomRoot } from '../shared/types.js';
import { referencedTemplates } from '../shared/references.js';
import { isStaticComponentName } from './definitions.js';

/**
 * Collect every component a parsed source might use: hyphenated tags and
 * `<render-template>` references, including those inside template contents.
 * Over-collecting is harmless; unused components contribute nothing to output.
 */
function mentionedComponents(root: DomRoot, found: Set<string>): void {
  for (const element of root.querySelectorAll('*')) {
    const name = element.localName;
    if (name === 'render-template') {
      for (const reference of referencedTemplates(element))
        if (isStaticComponentName(reference)) found.add(reference);
    } else if (isStaticComponentName(name)) found.add(name);
    if (name === 'template') mentionedComponents((element as HTMLTemplateElement).content, found);
  }
}

/** Names the source already defines inline, which must not be loaded again. */
function definedComponents(root: DomRoot): Set<string> {
  const defined = new Set<string>();
  for (const template of root.querySelectorAll('template[data-component]')) {
    const name = template.getAttribute('data-component');
    if (name) defined.add(name);
  }
  return defined;
}

/**
 * Load the component files a page needs, following the components those files
 * mention in turn. Each name loads at most once; names the loader does not know
 * stay unknown custom elements, exactly as without a loader.
 */
export async function loadComponents(
  root: DomRoot,
  loadComponent: ComponentLoader,
  parse: (html: string) => Document,
): Promise<ComponentFile[]> {
  const requested = definedComponents(root);
  const mentioned = new Set<string>();
  mentionedComponents(root, mentioned);
  const files: ComponentFile[] = [];
  let pending = [...mentioned].filter((name) => !requested.has(name));
  while (pending.length) {
    for (const name of pending) requested.add(name);
    const loaded = await Promise.all(pending.map((name) => loadComponent(name)));
    const next = new Set<string>();
    for (const file of loaded) {
      if (!file) continue;
      files.push(file);
      const parsed = parse(file.html);
      for (const name of definedComponents(parsed)) requested.add(name);
      mentionedComponents(parsed, next);
    }
    pending = [...next].filter((name) => !requested.has(name));
  }
  return files;
}
