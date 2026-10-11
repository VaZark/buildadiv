import type { FilterRegistry } from '../../shared/types.js';
import type { RegistrableAction } from './actions.js';
import type { Store } from './storage.js';

export interface Configuration {
  actions?: Record<string, RegistrableAction>;
  filters?: FilterRegistry;
  persist?: Store | false;
  maxAge?: number;
  buster?: string;
}
