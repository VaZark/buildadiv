import type { Action } from './actions.js';
import type { ActionResult } from './results.js';

export type CacheLifetime = number | ((headers: Headers) => number);
export interface Tag {
  tag: string;
  key: string;
}
export type Invalidation<Args = unknown> =
  string | string[] | { tag: string; key?: string; id?: (args: Args) => unknown };
export interface Pagination<Args = unknown, Data = unknown> {
  mode: 'pages' | 'infinite';
  firstPage: Args;
  nextPage: (response: Data, page: Args) => Args | null | undefined | false;
  refreshBehind?: number;
}
export interface PageRecord {
  args: unknown;
  response: unknown;
  invalidated: boolean;
}
export type Subscriber = (result: ActionResult, entry: CacheEntry) => void;
/** Internal cache entries erase per-action generics at the registry boundary. */
export interface CacheEntry {
  key: string;
  fn: Action;
  args: unknown;
  listeners: Set<Subscriber>;
  result: ActionResult | null;
  pages: PageRecord[];
  currentPage: number;
  updatedAt: number;
  freshFor: number;
  unusedFor: number;
  restored: boolean;
  invalidated: boolean;
  noStore?: boolean;
  freshTimer?: ReturnType<typeof setTimeout>;
  unusedTimer?: ReturnType<typeof setTimeout>;
  inflight?: Promise<ActionResult> | null;
}

/** Mutation effects and timers refetch through this coordinator boundary. */
export type QueryRefresher = (entry: CacheEntry) => Promise<ActionResult | void>;
