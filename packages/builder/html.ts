/**
 * Parse existing pages with the browser's HTML rules rather than inventing an
 * HTML grammar. Return a detached document; no scripts are executed during parse.
 */
export function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

/**
 * Produce HTML output after DOM expansion, preserving document-level comments
 * and the doctype. HTML serialization keeps native void elements and escaping.
 * Only node properties are used, so any DOM implementation (browser or jsdom) works;
 * doctypes serialize as `<!DOCTYPE name>`, as the HTML serialization algorithm does.
 */
export function serializeHtml(document: Document): string {
  return Array.from(document.childNodes, (node) => {
    if (node.nodeType === 10) return `<!DOCTYPE ${(node as DocumentType).name}>`;
    if (node.nodeType === 8) return `<!--${(node as Comment).data}-->`;
    return (node as Element).outerHTML ?? node.textContent ?? '';
  }).join('\n');
}
