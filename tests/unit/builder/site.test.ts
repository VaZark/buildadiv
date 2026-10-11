import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { buildSite } from '../../../packages/builder/node/site.js';
import config from '../../../examples/site/buildadiv.config.js';

// The compiled example site (dist/examples/site) holds pages, component folders and compiled behavior.
const siteRoot = resolve('dist/examples/site');

test('buildSite writes each page with a bundle of only the components it uses', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'buildadiv-site-'));
  try {
    const result = await buildSite({ ...config, root: siteRoot, outDir, base: '/' });
    assert.deepEqual(result.pages.map((path) => path.slice(outDir.length + 1)).sort(), [
      'about.html',
      'index.html',
    ]);
    assert.deepEqual((await readdir(join(outDir, 'assets'))).sort(), [
      'shop-about.min.css',
      'shop-index.min.css',
      'shop-index.min.js',
    ]);
    const index = await readFile(join(outDir, 'index.html'), 'utf8');
    const indexCss = await readFile(join(outDir, 'assets/shop-index.min.css'), 'utf8');
    const aboutCss = await readFile(join(outDir, 'assets/shop-about.min.css'), 'utf8');

    assert.match(index, /<link rel="stylesheet" href="\/assets\/shop-index\.min\.css">/);
    assert.doesNotMatch(index, /<(site-layout|product-card)\b/);
    assert.doesNotMatch(index, /data-component="(site-layout|product-card)"/);
    assert.match(index, /data-component="product-list"/);
    // Tag-placed and runtime-rendered components are bundled; unused ones never are.
    for (const component of ['site-layout', 'product-card', 'product-list'])
      assert.match(indexCss, new RegExp(`\\[data-c=${component}\\]`));
    assert.doesNotMatch(indexCss + aboutCss, /unused-banner|banner/);
    assert.doesNotMatch(aboutCss, /product-card/);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test('the CLI builds from a config file and reports usage errors', async () => {
  const run = promisify(execFile);
  const cli = resolve('dist/packages/builder/node/cli.js');
  const { stdout } = await run('node', [
    cli,
    'build',
    '--config',
    join(siteRoot, 'buildadiv.config.js'),
  ]);
  assert.match(stdout, /Built 2 pages and 3 bundle files\./);
  await assert.rejects(run('node', [cli, 'serve']), (error: { code?: number; stderr?: string }) => {
    assert.equal(error.code, 2);
    assert.match(error.stderr ?? '', /Usage: buildadiv build/);
    return true;
  });
});
