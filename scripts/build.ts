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
await copyAssets('examples');
await copyAssets('tests/support');
