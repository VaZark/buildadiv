import type { ComponentFile, ComponentLoader } from '../shared/components.js';
import type { DomRoot, FilterRegistry } from '../shared/types.js';

export interface ExpansionOptions {
  /** Definitions: template elements, HTML strings, parsed roots, or component files with assets. */
  components?: Iterable<HTMLTemplateElement | DomRoot | string | ComponentFile>;
  data?: Record<string, unknown>;
  filters?: FilterRegistry;
  /** Called with each component name as its tag is expanded. */
  onExpand?: (name: string) => void;
}
export interface BuildOptions extends ExpansionOptions {
  parse?: (html: string) => Document;
  serialize?: (document: Document) => string;
}
/** One component a built page uses, with the folder files its CSS/JS bundle must include. */
export interface ComponentUsage {
  name: string;
  style?: string;
  script?: string;
}
/**
 * A built page and the components it uses, whether rendered from tags at build
 * time or left for the runtime. The page itself never links component assets;
 * the site's global CSS/JS build includes the files listed here.
 */
export interface PageBuild {
  html: string;
  components: ComponentUsage[];
  /** The page's unified bundle files to write, when `bundle` was requested. */
  bundle?: BundleOutput;
}

/**
 * The components one bundle unifies, in first-use order. Each stylesheet is
 * scoped to its component (`.card` → `.card[data-c="name"]`) while bundling.
 */
export interface BundleRequest {
  name: string;
  components: ComponentUsage[];
}
export interface BundleFile {
  fileName: string;
  code: string;
}
/** Each file is absent when the page uses no component stylesheet or script. */
export interface BundleOutput {
  css?: BundleFile;
  js?: BundleFile;
}
/** Unify, scope and minify one bundle's component files; owns no page HTML. */
export type Bundler = (request: BundleRequest) => Promise<BundleOutput>;
export interface BundleNameParts {
  project: string;
  page: string;
}
/** Names a page's bundle files (without extension) from the project and page prefixes. */
export type BundleName = (parts: BundleNameParts) => string;
export interface BundleOptions {
  bundler: Bundler;
  project: string;
  page: string;
  /** Defaults to `bundleName`: `${project}-${page}`. */
  name?: BundleName;
  /** URL path the bundle files are served from; defaults to `/assets/`. */
  base?: string;
}
export interface PageOptions extends BuildOptions {
  /** Finds component files for tags and runtime references the page does not define. */
  loadComponent: ComponentLoader;
  /** Unify the page's component CSS/JS into one minified file each and link them. */
  bundle?: BundleOptions;
}
