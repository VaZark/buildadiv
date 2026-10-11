/**
 * `<use-template>` attributes that name a component template. The runtime
 * looks templates up by these names in the browser, and the builder uses the same
 * list to decide which definitions a built page must still ship.
 */
export const templateReferenceAttributes = [
  'template',
  'on-pending',
  'on-success',
  'on-no-content',
  'on-error',
] as const;

/** Names of the component templates one `<use-template>` element can render. */
export function referencedTemplates(host: Element): string[] {
  return templateReferenceAttributes
    .map((attribute) => host.getAttribute(attribute))
    .filter((name): name is string => Boolean(name));
}
