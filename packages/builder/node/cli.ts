#!/usr/bin/env node
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import type { SiteOptions } from './site.js';
import { buildSite } from './site.js';

/**
 * `buildadiv build [--config buildadiv.config.js]`: build a site from a config
 * module whose default export is the `buildSite` options. `root` and `outDir`
 * resolve against the config file, so a config can live inside its site.
 */
async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { config: { type: 'string', short: 'c', default: 'buildadiv.config.js' } },
  });
  if (positionals[0] !== 'build') {
    console.error('Usage: buildadiv build [--config buildadiv.config.js]');
    process.exitCode = 2;
    return;
  }
  const configPath = resolve(values.config);
  const loaded: unknown = (await import(pathToFileURL(configPath).href)).default;
  if (!loaded || typeof loaded !== 'object')
    throw new TypeError(`${configPath} must export options`);
  const options = loaded as SiteOptions;
  const base = dirname(configPath);
  const result = await buildSite({
    ...options,
    root: resolve(base, options.root),
    outDir: resolve(base, options.outDir),
  });
  console.log(`Built ${result.pages.length} pages and ${result.bundles.length} bundle files.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
