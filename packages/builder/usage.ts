import type { PageBuild, SiteAssets } from './contracts.js';

/**
 * Merge the component usage of every built page into the inputs of the site's
 * global CSS and JS builds. Each file appears once, in first-use order, so only
 * components some page actually uses are included.
 */
export function siteAssets(builds: Iterable<PageBuild>): SiteAssets {
  const styles = new Set<string>();
  const scripts = new Set<string>();
  for (const build of builds) {
    for (const component of build.components) {
      for (const href of component.styles) styles.add(href);
      for (const src of component.scripts) scripts.add(src);
    }
  }
  return { styles: [...styles], scripts: [...scripts] };
}
