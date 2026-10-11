import type { ActionState } from './results.js';
import type { PageRecord } from './queries.js';

/** Async storage is independent of browser APIs so applications can wrap it. */
export interface Store<Value = PersistedEntry> {
  get(key: string): Promise<Value | undefined>;
  set(key: string, value: Value): Promise<void>;
  remove(key: string): Promise<void>;
}
export interface PersistedEntry {
  response: unknown;
  statusCode: number | undefined;
  state: ActionState;
  savedAt: number;
  buster: string;
  freshFor: number | null;
  unusedFor: number | null;
  pages: PageRecord[];
  nextPage: unknown;
}
