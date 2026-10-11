import type { DomRoot } from '../shared/types.js';
import type { ExpansionOptions } from './contracts.js';
import { fallback } from '../shared/filters.js';
import { fillSlots, cloneSlotContent } from '../shared/slots.js';
import { safeAttribute } from '../shared/attributes.js';
import { collectDefinitions } from './definitions.js';
import { interpolate } from './interpolation.js';

interface AssignedScope {
  scope: Record<string, unknown>;
  stack: string[];
  component: string | undefined;
}

/**
 * Replace static component tags exactly where they occur in an existing DOM.
 * Shared slots and pipelines keep static output consistent with live regions;
 * runtime templates/hosts remain untouched. Attributes supply per-component
 * string props, while slotted markup keeps the caller's data and CSS scope.
 */
export function expandComponents<Root extends DomRoot>(
  root: Root,
  { components = [], data = {}, filters = {} }: ExpansionOptions = {},
): Root {
  if (!root?.querySelectorAll)
    throw new TypeError('Expansion requires a DOM document, fragment, or element');
  const definitions = collectDefinitions(root, components);
  const registry = { fallback, ...filters };
  const assignedScopes = new WeakMap<Node, AssignedScope>();

  /**
   * Forwarded slots may be cloned through several component definitions. Carry
   * each existing scope marker to its corresponding clone so caller props remain
   * authoritative even when a wrapper passes markup to another wrapper's slot.
   */
  function cloneWithScopes(source: Node): Node {
    const clone = cloneSlotContent(source);
    const copy = (original: Node, target: Node): void => {
      if (assignedScopes.has(original)) assignedScopes.set(target, assignedScopes.get(original)!);
      for (let index = 0; index < original.childNodes.length; index++) {
        copy(original.childNodes[index], target.childNodes[index]);
      }
    };
    copy(source, clone);
    return clone;
  }

  /**
   * Walk real nodes once, taking a snapshot before replacements. Scope overrides
   * on slot clones prevent a callee's props from leaking into caller-written
   * markup; the definition stack detects composition cycles without rejecting
   * finite nesting authored through slots.
   */
  function visit(
    node: Node,
    scope: Record<string, unknown>,
    stack: string[],
    component: string | undefined,
  ): void {
    const assigned = assignedScopes.get(node);
    if (assigned) ({ scope, stack, component } = assigned);
    if (node.nodeType === 3) {
      (node as Text).data = interpolate((node as Text).data, scope, registry);
      return;
    }
    if (node.nodeType !== 1) {
      for (const child of Array.from(node.childNodes)) visit(child, scope, stack, component);
      return;
    }
    const element = node as Element;
    const name = element.localName;
    if (name === 'template' || name === 'render-template') return;
    const definition = definitions.get(name);
    if (definition) {
      if (stack.includes(name)) throw new Error(`Component cycle: ${[...stack, name].join(' → ')}`);
      const props = Object.fromEntries(
        Array.from(element.attributes, (attribute) => [
          attribute.name,
          interpolate(attribute.value, scope, registry),
        ]),
      );
      const fragment = definition.content.cloneNode(true) as DocumentFragment;
      const assignedNodes = fillSlots(fragment, Array.from(node.childNodes), cloneWithScopes);
      for (const child of assignedNodes) {
        if (!assignedScopes.has(child)) assignedScopes.set(child, { scope, stack, component });
      }
      for (const child of Array.from(fragment.childNodes)) {
        visit(child, { ...scope, props }, [...stack, name], name);
      }
      element.replaceWith(fragment);
      return;
    }
    if (component) element.setAttribute('data-c', component);
    for (const attribute of Array.from(element.attributes)) {
      if (!attribute.value.includes('{{')) continue;
      const value = safeAttribute(attribute.name, interpolate(attribute.value, scope, registry));
      if (value == null) element.removeAttribute(attribute.name);
      else element.setAttribute(attribute.name, value);
    }
    if (name === 'script' || name === 'style') return;
    for (const child of Array.from(node.childNodes)) visit(child, scope, stack, component);
  }

  visit(root, data, [], undefined);
  return root;
}
