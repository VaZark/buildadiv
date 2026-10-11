import type { CacheEntry } from '../contracts/queries.js';
import { serializeArgs, mergeInfinite, mergePages } from './policies.js';

/** Merge one fetched page and keep the next cursor attached to the sequence tail. */
export function mergePage(
  entry: CacheEntry,
  args: unknown,
  decoded: unknown,
): { data: unknown; nextPage: unknown } {
  let data: unknown = decoded;
  let nextPage: unknown = null;
  const pagination = entry.fn.options.paginated!;
  nextPage = pagination.nextPage(decoded, args);
  const existing = entry.pages.findIndex(
    (page) => serializeArgs(page.args) === serializeArgs(args),
  );
  const page = { args, response: decoded, invalidated: false };
  if (pagination.mode === 'pages') {
    entry.pages = [page];
    entry.currentPage = 0;
  } else if (existing >= 0) entry.pages[existing] = page;
  else entry.pages.push(page);
  const merge =
    entry.fn.options.merge || (pagination.mode === 'infinite' ? mergeInfinite : mergePages);
  data = entry.pages.reduce<unknown>(
    (merged, page, index) => (index === 0 ? page.response : merge(merged, page.response)),
    null,
  );
  // Refreshing an older page must not change the next cursor of the tail.
  const tail = entry.pages.at(-1)!;
  nextPage = pagination.nextPage(tail.response, tail.args);
  return { data, nextPage };
}
