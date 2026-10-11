import type { CacheEntry } from '../contracts/queries.js';
interface ElementContainer {
  children: Iterable<Element>;
}
interface RenderRecord {
  start: Comment;
  end: Comment;
  nodes: ChildNode[];
  fragment?: DocumentFragment;
}

import { resolvePath, truthy } from '@buildadiv/shared/path.js';
import { evaluate } from '@buildadiv/shared/pipeline.js';
import { fillSlots } from '@buildadiv/shared/slots.js';
import { settings } from '../configuration/settings.js';
import { sameKey } from '../data/keys.js';

const initialDisplay = new WeakMap<HTMLElement, string>();
const nestedLists = new WeakMap<HTMLTemplateElement, TemplateRenderer>();
const owners = new WeakMap<Element, TemplateRenderer>();
import { safeAttribute } from '@buildadiv/shared/attributes.js';
export { safeAttribute } from '@buildadiv/shared/attributes.js';

/** Avoid redundant DOM writes, removing absent values rather than showing previews. */
function setAttribute(element: Element, name: string, value: string | null): void {
  if (value == null) {
    if (element.hasAttribute(name)) element.removeAttribute(name);
  } else if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}
/** Apply text, sanitized attributes and truthiness without replacing the whole element. */
function bindElement(element: HTMLElement, data: unknown): void {
  if (!initialDisplay.has(element)) initialDisplay.set(element, element.style.display);
  const passes = (attribute: string, invert: boolean): boolean =>
    !element.hasAttribute(attribute) ||
    element
      .getAttribute(attribute)!
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .every((path) =>
        invert ? !truthy(resolvePath(data, path)) : truthy(resolvePath(data, path)),
      );
  const display =
    passes('data-if', false) && passes('data-if-not', true) ? initialDisplay.get(element)! : 'none';
  if (element.style.display !== display) element.style.display = display;
  if (element.hasAttribute('data-bind')) {
    const value = evaluate(element.getAttribute('data-bind')!, data, settings.filters);
    const text = value == null ? '' : String(value);
    if (element.textContent !== text) element.textContent = text;
  }
  for (const attribute of Array.from(element.attributes)) {
    if (!attribute.name.startsWith('data-bind-')) continue;
    const name = attribute.name.slice(10);
    setAttribute(
      element,
      name,
      safeAttribute(name, evaluate(attribute.value, data, settings.filters)),
    );
  }
}
/** Nested lists own their item scope; skip their generated nodes in the outer binder. */
function bindTree(
  root: ElementContainer,
  data: unknown,
  preview: boolean,
  owner: TemplateRenderer,
): void {
  for (const element of Array.from(root.children || [])) {
    if (owners.has(element) && owners.get(element) !== owner) continue;
    if (element.localName === 'template' && element.getAttribute('data-accepts') === 'array') {
      if (preview) continue;
      let renderer = nestedLists.get(element as HTMLTemplateElement);
      if (!renderer) {
        const end = element.ownerDocument.createComment('list');
        element.after(end);
        renderer = new TemplateRenderer(element as HTMLTemplateElement, element.parentNode!, end);
        nestedLists.set(element as HTMLTemplateElement, renderer);
      }
      renderer.update(data, [], false);
      continue;
    }
    if (!preview) bindElement(element as HTMLElement, data);
    if (element.localName !== 'use-template') bindTree(element, data, preview, owner);
  }
}

// Each record owns real DOM nodes, not a virtual DOM. Keys retain those nodes.
export class TemplateRenderer {
  records: Map<unknown, RenderRecord>;
  constructor(
    public template: HTMLTemplateElement,
    public parent: Node,
    public before: ChildNode | null = null,
  ) {
    this.records = new Map<unknown, RenderRecord>();
  }
  /** Remove all owned ranges when the host changes to another state template. */
  clear(): void {
    for (const record of this.records.values()) for (const node of record.nodes) node.remove();
    this.records.clear();
  }
  /** Retain keyed DOM ranges and bind only changed values, preserving local behavior. */
  update(data: unknown, children: Node[] = [], preview = false, entry?: CacheEntry): void {
    const template = this.template;
    const list = template.dataset.accepts === 'array' && !preview;
    const source = list ? resolvePath(data, template.dataset.from || 'response') : null;
    const items = list ? (Array.isArray(source) ? source : []) : [data];
    const next = new Map<unknown, RenderRecord>();
    const updates: { record: RenderRecord; scope: unknown; key: unknown; item: unknown }[] = [];
    // Validate duplicate keys before changing the live DOM.
    const keys = items.map((item, index) =>
      list && template.dataset.key ? resolvePath(item, template.dataset.key) : index,
    );
    if (new Set(keys).size !== keys.length) throw new Error('List keys must be unique');
    for (let index = 0; index < items.length; index++) {
      const item = items[index],
        key = keys[index];
      const scope = list
        ? {
            ...(data && typeof data === 'object' ? data : {}),
            [template.dataset.item || 'item']: item,
            ...(template.dataset.index ? { [template.dataset.index]: index } : {}),
          }
        : data;
      let record = this.records.get(key);
      if (!record) {
        const fragment = template.content.cloneNode(true) as DocumentFragment;
        fillSlots(fragment, children);
        // Bound nested lists may insert siblings: boundary comments include them in ownership.
        const start = template.ownerDocument.createComment('item');
        const end = template.ownerDocument.createComment('/item');
        fragment.prepend(start);
        fragment.append(end);
        record = { start, end, nodes: Array.from(fragment.childNodes), fragment };
      }
      next.set(key, record);
      updates.push({ record, scope, key, item });
    }
    for (const [key, record] of this.records)
      if (!next.has(key)) {
        for (const node of this.range(record)) node.remove();
      }
    // Reorder ranges only when their next sibling differs, preserving focused nodes.
    let cursor = this.before;
    for (let index = updates.length - 1; index >= 0; index--) {
      const { record } = updates[index];
      if (record.fragment) {
        this.parent.insertBefore(record.fragment, cursor);
        delete record.fragment;
      } else if (record.end.nextSibling !== cursor) {
        for (const node of this.range(record)) this.parent.insertBefore(node, cursor);
      }
      cursor = record.start;
    }
    for (const { record, scope, key, item } of updates) {
      // A lightweight root facade avoids moving live nodes to a fragment to bind them.
      const roots = this.range(record).filter((node): node is HTMLElement => node.nodeType === 1);
      for (const root of roots) {
        owners.set(root, this);
        if (list && key != null) setAttribute(root, 'data-key', String(key));
        if (entry?.fn.options.paginated && list) {
          const options = entry.fn.options;
          const pageIndex = entry.pages.findIndex((page) => {
            const pageItems = (options.items || ((response) => response))(page.response);
            return (
              Array.isArray(pageItems) &&
              pageItems.some((candidate) =>
                template.dataset.key
                  ? sameKey(resolvePath(candidate, template.dataset.key), key)
                  : candidate === item,
              )
            );
          });
          if (pageIndex >= 0) setAttribute(root, 'data-page-index', String(pageIndex));
        }
      }
      bindTree({ children: roots }, scope, preview, this);
      record.nodes = this.range(record);
    }
    this.records = next;
  }
  /** Include nested-list siblings between boundaries when moving or deleting a row. */
  range(record: RenderRecord): ChildNode[] {
    if (record.fragment) return record.nodes;
    const nodes: ChildNode[] = [];
    for (let node: ChildNode | null = record.start; node; node = node.nextSibling) {
      nodes.push(node);
      if (node === record.end) break;
    }
    return nodes;
  }
}
