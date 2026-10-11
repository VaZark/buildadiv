import type { DomRoot, FilterRegistry } from '../shared/types.js';

export interface ExpansionOptions {
  components?: Iterable<HTMLTemplateElement | DomRoot | string>;
  data?: Record<string, unknown>;
  filters?: FilterRegistry;
}
export interface BuildOptions extends ExpansionOptions {
  parse?: (html: string) => Document;
  serialize?: (document: Document) => string;
}
