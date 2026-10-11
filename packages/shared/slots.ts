import type { DomRoot } from './types.js';

/**
 * Components accept author-written markup rather than treating it as data.
 * Replace slot sockets with cloned assigned children (or their fallback nodes),
 * remove the assignment attributes, and return assigned clones so a builder can
 * preserve the caller's evaluation scope without changing runtime slot rules.
 */
export function fillSlots(
  root: DomRoot,
  children: Iterable<Node>,
  clone: (node: Node) => Node = cloneSlotContent,
): Node[] {
  const groups = new Map<string, Node[]>();
  const inserted: Node[] = [];
  for (const node of children) {
    const name = node.nodeType === 1 ? (node as Element).getAttribute('slot') || '' : '';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name)!.push(node);
  }
  for (const slot of root.querySelectorAll('slot')) {
    // A nested runtime host owns its sockets; outer composition leaves it intact.
    if (slot.closest('render-template')) continue;
    const assigned = groups.get(slot.getAttribute('name') || '');
    const nodes = assigned?.length ? assigned.map(clone) : Array.from(slot.childNodes);
    if (assigned?.length) inserted.push(...nodes);
    slot.replaceWith(...nodes);
  }
  return inserted;
}

/**
 * Slot assignment must not move the page author's source nodes. Clone markup
 * and remove the consumed slot name, leaving its contents and listeners defined
 * by later component behavior free to initialize in the rendered instance.
 */
export function cloneSlotContent(node: Node): Node {
  const clone = node.cloneNode(true);
  if (clone.nodeType === 1) (clone as Element).removeAttribute('slot');
  return clone;
}
