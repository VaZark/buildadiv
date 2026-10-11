// The public builder API composes independently reviewable expansion stages.
export type {
  ExpansionOptions,
  BuildOptions,
  PageOptions,
  PageBuild,
  ComponentUsage,
  Bundler,
  BundleRequest,
  BundleOutput,
  BundleFile,
  BundleName,
  BundleNameParts,
  BundleOptions,
} from './contracts.js';
export type { ComponentFile, ComponentLoader } from '../shared/components.js';
export { buildHtml, buildPage } from './build.js';
export { siteComponents } from './usage.js';
export { bundleName } from './bundling.js';
export { componentFolder } from '../shared/components.js';
export { expandComponents } from './expansion.js';
export { removeStaticDefinitions } from './pruning.js';
export { parseHtml, serializeHtml } from './html.js';
