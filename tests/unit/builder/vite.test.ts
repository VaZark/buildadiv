import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { viteBundler } from '../../../packages/builder/node/vite.js';

/** Write a small site whose component behavior imports a helper module. */
async function site(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'buildadiv-bundle-'));
  const files: Record<string, string> = {
    'components/card-item/card-item.css': '.card[data-c="card-item"] {\n  color: #ff0000;\n}\n',
    'components/card-item/card-item.js':
      "import { mark } from './helper.js';\ndocument.addEventListener('click', () => mark('card'));\n",
    'components/card-item/helper.js':
      'export function mark(value) {\n  return `marked ${value}`;\n}\n',
    'components/badge-item/badge-item.css':
      '.badge[data-c="badge-item"] {\n  font-weight: bold;\n}\n',
  };
  for (const [path, code] of Object.entries(files)) {
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), code);
  }
  return root;
}

test('the Vite+ bundler unifies and minifies one page bundle per name', async () => {
  const root = await site();
  try {
    const bundle = viteBundler({ root });
    const output = await bundle({
      name: 'shop-home',
      styles: ['/components/card-item/card-item.css', '/components/badge-item/badge-item.css'],
      scripts: ['/components/card-item/card-item.js'],
    });
    assert.equal(output.css?.fileName, 'shop-home.min.css');
    assert.equal(output.js?.fileName, 'shop-home.min.js');
    // Minified, in first-use order, so the cascade follows component use.
    assert.match(
      output.css!.code,
      /^\.card\[data-c=card-item\]\{color:red\}\.badge\[data-c=badge-item\]\{font-weight:700\}\s*$/,
    );
    // The helper import is resolved into the bundle, not left as a request.
    assert.doesNotMatch(output.js!.code, /\bimport\b/);
    assert.match(output.js!.code, /marked/);
    assert.doesNotMatch(output.js!.code, /\n\s+/);

    const stylesOnly = await bundle({
      name: 'shop-about',
      styles: ['/components/badge-item/badge-item.css'],
      scripts: [],
    });
    assert.equal(stylesOnly.css?.fileName, 'shop-about.min.css');
    assert.equal(stylesOnly.js, undefined);

    await assert.rejects(
      bundle({ name: 'x', styles: ['https://cdn.test/a.css'], scripts: [] }),
      /root-relative/,
    );
    await assert.rejects(
      bundle({ name: 'x', styles: ['/../outside.css'], scripts: [] }),
      /outside the site/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
