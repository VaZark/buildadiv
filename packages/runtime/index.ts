import type { Configuration } from './contracts/configuration.js';
export type {
  Action,
  QueryAction,
  MutationAction,
  GenericAction,
  ActionOptions,
  ActionResult,
  ActionContext,
  QueryOptions,
  MutationOptions,
  Configuration,
  Store,
  RequestOptions,
  ReadOptions,
  WriteOptions,
  GetQueryOptions,
  HttpQueryOptions,
  NormalizedActionOptions,
  NormalizedQueryOptions,
  NormalizedMutationOptions,
  ReadMethod,
  MutationMethod,
  Method,
} from './types.js';

export { HttpMethod } from './types.js';
/** The `<use-template>` element class, for typing `.data` assignments and queries. */
export type { UseTemplate } from './dom/element.js';
import { settings, registerActions } from './configuration/settings.js';
import { UseTemplate } from './dom/element.js';

import { installTriggers, scanEvents } from './dom/triggers.js';

/** Explicitly register imported actions/filters and wake hosts awaiting those names. */
export function configureActions(options: Configuration = {}): void {
  if (options.actions) registerActions(options.actions);
  if (options.filters) Object.assign(settings.filters, options.filters);
  if (options.persist !== undefined) settings.persist = options.persist;
  if (options.maxAge !== undefined) settings.maxAge = options.maxAge;
  if (options.buster !== undefined) settings.buster = options.buster;
  if (options.locale !== undefined) settings.locale = options.locale;
  if (options.currency !== undefined) settings.currency = options.currency;
  scanEvents();
  for (const element of document.querySelectorAll('use-template')) element.start();
}
if (!customElements.get('use-template')) customElements.define('use-template', UseTemplate);
installTriggers();
