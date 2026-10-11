import { cp, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

/** Copy non-code fixtures alongside emitted modules so browsers use the same relative URLs. */
async function copyAssets(directory: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const source = join(directory, entry.name);
    if (entry.isDirectory()) await copyAssets(source);
    else if (entry.name.endsWith('.html') || entry.name.endsWith('.css')) {
      const destination = join('dist', source);
      await mkdir(join('dist', directory), { recursive: true });
      await cp(source, destination);
    }
  }
}

/**
 * Each workspace package compiles into its own `dist/`. The examples, tests and
 * demo server address modules as `/packages/<folder>/…` under the repository's
 * `dist/`, so mirror each package's output there. Package code imports the
 * private shared package by name (`@buildadiv/shared/…`): Node resolves it
 * through the workspace link, and pages that load modules directly map it
 * with an import map.
 */
async function mirrorPackages(): Promise<void> {
  for (const folder of ['shared', 'runtime', 'builder'])
    await cp(join('packages', folder, 'dist'), join('dist', 'packages', folder), {
      recursive: true,
    });
}

/** Serve the packed single-file runtime where the examples load it: `/lib/query-template.min.js`. */
async function copyPackedRuntime(): Promise<void> {
  await mkdir(join('dist', 'lib'), { recursive: true });
  await cp(join('packages', 'runtime', 'lib'), join('dist', 'lib'), { recursive: true });
}

if (process.argv.includes('--libs')) await copyPackedRuntime();
else {
  await copyAssets('examples');
  await copyAssets('tests/support');
  await mirrorPackages();
}
