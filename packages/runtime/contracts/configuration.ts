import type { FilterRegistry } from '@buildadiv/shared/types.js';
import type { RegistrableAction } from './actions.js';
import type { Store } from './storage.js';

export interface Configuration {
  actions?: Record<string, RegistrableAction>;
  filters?: FilterRegistry;
  persist?: Store | false;
  maxAge?: number;
  buster?: string;
  /** Overrides the language filters format for; otherwise each element's nearest `lang`. */
  locale?: string;
  /** The currency for `currency` filters that name no code (Intl can't infer one). */
  currency?: string;
}
