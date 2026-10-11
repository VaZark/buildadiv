import { isStaticComponentName } from './definitions.js';

/** Mark every element of a template's content (and nested templates) as owned by `name`. */
function markOwned(root: ParentNode, name: string): void {
  for (const element of Array.from(root.children)) {
    element.setAttribute('data-c', name);
    // A nested runtime host renders its own templates; only the host itself is owned.
    if (element.localName === 'use-template') continue;
    if (element.localName === 'template') markOwned((element as HTMLTemplateElement).content, name);
    else markOwned(element, name);
  }
}

/**
 * Component scoping is the builder's job; the runtime renders templates as they
 * are. A component template shipped for the runtime therefore gets its `data-c`
 * scope written into its markup here, so the elements the runtime later clones
 * match the component's scoped CSS exactly like elements expanded from tags.
 * Only static (hyphenated) component definitions are touched.
 */
export function scopeShippedTemplates(root: ParentNode): void {
  for (const template of root.querySelectorAll<HTMLTemplateElement>('template[data-component]')) {
    const name = template.getAttribute('data-component');
    if (isStaticComponentName(name)) markOwned(template.content, name);
  }
}
