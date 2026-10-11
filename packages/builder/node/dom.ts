import { JSDOM } from 'jsdom';

/**
 * Node has no DOM, so site builds parse with jsdom, which follows the browser's
 * HTML parsing rules (including repairs to malformed markup). Scripts never run:
 * jsdom executes nothing unless asked to.
 */
export function parseHtmlNode(html: string): Document {
  return new JSDOM(html).window.document;
}
