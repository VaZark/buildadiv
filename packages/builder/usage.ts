import type { ComponentUsage, PageBuild } from './contracts.js';

/**
 * Merge the component usage of every built page into one list, each component
 * once in first-use order: the input of a single site-wide CSS/JS bundle, so
 * only components some page actually uses are included.
 */
export function siteComponents(builds: Iterable<PageBuild>): ComponentUsage[] {
  const components = new Map<string, ComponentUsage>();
  for (const build of builds)
    for (const component of build.components)
      if (!components.has(component.name)) components.set(component.name, component);
  return [...components.values()];
}
