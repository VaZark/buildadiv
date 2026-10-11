import type { DomRoot } from '../shared/types.js';
import { referencedTemplates } from '../shared/references.js';
import { isStaticComponentName } from './definitions.js';

/**
 * Names of the static (hyphenated) definitions the runtime will render from this
 * page: those a `<render-template>` names, followed through each named
 * definition and through every shipped non-static template (runtime
 * declarations, nested lists), so a runtime template placing another component
 * keeps that component too. `lookup` supplies definitions by name, inline or external.
 */
export function runtimeTemplateNames(
  root: DomRoot,
  lookup: (name: string) => HTMLTemplateElement[],
): Set<string> {
  const needed = new Set<string>();
  const pending: DomRoot[] = [root];
  const scanned = new Set<DomRoot>();
  while (pending.length) {
    const scope = pending.pop()!;
    if (scanned.has(scope)) continue;
    scanned.add(scope);
    for (const host of scope.querySelectorAll('render-template')) {
      for (const name of referencedTemplates(host)) {
        if (needed.has(name) || !isStaticComponentName(name)) continue;
        needed.add(name);
        for (const template of lookup(name)) pending.push(template.content);
      }
    }
    for (const template of scope.querySelectorAll<HTMLTemplateElement>('template')) {
      if (!isStaticComponentName(template.getAttribute('data-component')))
        pending.push(template.content);
    }
  }
  return needed;
}

/**
 * Component tags render at build time, so their definitions have no use in the
 * browser. Remove every static (hyphenated) definition except those the runtime
 * still renders. Single-word runtime declarations and templates without
 * `data-component` are never removed.
 */
export function removeStaticDefinitions<Root extends DomRoot>(root: Root): Root {
  const definitions = new Map<string, HTMLTemplateElement[]>();
  for (const template of root.querySelectorAll<HTMLTemplateElement>('template[data-component]')) {
    const name = template.getAttribute('data-component');
    if (!isStaticComponentName(name)) continue;
    definitions.set(name, [...(definitions.get(name) ?? []), template]);
  }
  const needed = runtimeTemplateNames(root, (name) => definitions.get(name) ?? []);
  for (const [name, templates] of definitions) {
    if (!needed.has(name)) for (const template of templates) template.remove();
  }
  return root;
}
