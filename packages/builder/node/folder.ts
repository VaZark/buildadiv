import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ComponentLoader } from '../components.js';
import { isComponentName } from '../components.js';

/** Whether a file exists, without throwing for the usual missing optional file. */
async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * The component folder convention on disk: `<root><base><name>/<name>.html`, with
 * `<name>.css` and `<name>.js` picked up when they exist. URLs are reported under
 * `base` (root-relative), the same URLs the site serves and `viteBundler` resolves.
 */
export function nodeComponentFolder(root: string, base = '/components/'): ComponentLoader {
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return async (name) => {
    if (!isComponentName(name)) throw new Error(`Invalid component name: ${name}`);
    const url = (extension: string) => `${prefix}${name}/${name}.${extension}`;
    const path = (extension: string) => join(root, url(extension));
    if (!(await exists(path('html')))) return undefined;
    const [style, script] = await Promise.all([exists(path('css')), exists(path('js'))]);
    return {
      url: url('html'),
      html: await readFile(path('html'), 'utf8'),
      ...(style && { style: url('css') }),
      ...(script && { script: url('js') }),
    };
  };
}
