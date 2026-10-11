import type { Configuration } from './contracts/configuration.js';
export type {
  Action,
  ProviderAction,
  MutationAction,
  GenericAction,
  ActionOptions,
  ActionResult,
  ActionContext,
  ProviderOptions,
  MutationOptions,
  Configuration,
  Store,
  RequestOptions,
  QueryOptions,
  WriteOptions,
  GetProviderOptions,
  QueryProviderOptions,
  NormalizedActionOptions,
  NormalizedProviderOptions,
  NormalizedMutationOptions,
  ProviderMethod,
  MutationMethod,
  Method,
} from './types.js';

export { HttpMethod } from './types.js';
import { settings, registerActions } from './configuration/settings.js';
import { RenderTemplate } from './dom/element.js';

import { installTriggers, scanEvents } from './dom/triggers.js';

/** Explicitly register imported actions/filters and wake hosts awaiting those names. */
export function configure(options: Configuration = {}): void {
  if (options.actions) registerActions(options.actions);
  if (options.filters) Object.assign(settings.filters, options.filters);
  if (options.persist !== undefined) settings.persist = options.persist;
  if (options.maxAge !== undefined) settings.maxAge = options.maxAge;
  if (options.buster !== undefined) settings.buster = options.buster;
  if (options.components !== undefined) settings.components = options.components;
  scanEvents();
  for (const element of document.querySelectorAll('render-template')) element.start();
}
if (!customElements.get('render-template'))
  customElements.define('render-template', RenderTemplate);
installTriggers();
