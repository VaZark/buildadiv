import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import type { BundleName } from '../contracts.js';
import type { FilterRegistry } from '@buildadiv/shared/types.js';
import { buildPage } from '../build.js';
import { bundleName } from '../bundling.js';
import { parseHtmlNode } from './dom.js';
import { nodeComponentFolder } from './folder.js';
import { viteBundler } from './vite.js';

export interface SiteOptions {
  /** The site directory holding `pages/` and `components/`. */
  root: string;
  /** Where built pages and bundles are written. */
  outDir: string;
  /** The project prefix of every page bundle name. */
  project: string;
  /** Page folder inside `root`; defaults to `pages`. */
  pages?: string;
  /** URL path of the component folder, also its path inside `root`; defaults to `/components/`. */
  components?: string;
  /** URL path where `outDir` is served; defaults to `/` (deployed at the site root). */
  base?: string;
  /** Folder inside `outDir` for bundles; defaults to `assets`, linked as `${base}${assets}/`. */
  assets?: string;
  /** Names bundles from the project and page prefixes; defaults to `${project}-${page}`. */
  name?: BundleName;
  /** Build-time values for `{{ }}` and the filters they use. */
  data?: Record<string, unknown>;
  filters?: FilterRegistry;
  /** Minify bundles; on by default. */
  minify?: boolean;
  /** Override each page's own `<html lang>` (and nested `lang`) for formatting. */
  locale?: string;
  /** The currency for `currency` filters that name no code (Intl can't infer one). */
  currency?: string;
}
export interface SiteResult {
  pages: string[];
  bundles: string[];
}

/** Every `.html` file below a folder, as paths relative to it. */
async function htmlFiles(directory: string, base = directory): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await htmlFiles(path, base)));
    else if (entry.name.endsWith('.html')) files.push(relative(base, path));
  }
  return files.sort();
}

/**
 * Build a whole site on disk: each page in `pages/` gets its component tags
 * rendered and its own minified CSS/JS bundle holding only the components it
 * uses, named `${project}-${page}` (page paths join with `-`: `blog/post.html` →
 * `shop-blog-post`). Pages are written under `outDir` at the same relative paths
 * and bundles in `outDir/<assets>/`, which pages link as `${base}${assets}/<file>`.
 */
export async function buildSite({
  root,
  outDir,
  project,
  pages = 'pages',
  components = '/components/',
  base = '/',
  assets = 'assets',
  name = bundleName,
  data,
  filters,
  minify,
  locale,
  currency,
}: SiteOptions): Promise<SiteResult> {
  const pageRoot = join(root, pages);
  const loadComponent = nodeComponentFolder(root, components);
  const bundler = viteBundler({ root, ...(minify !== undefined && { minify }) });
  const result: SiteResult = { pages: [], bundles: [] };
  if (!/^[\w.-]+$/.test(assets)) throw new Error(`Invalid assets folder: ${assets}`);
  const assetUrl = `${base.endsWith('/') ? base : `${base}/`}${assets}/`;
  for (const file of await htmlFiles(pageRoot)) {
    const page = file
      .replace(/\.html$/, '')
      .split(sep)
      .join('-');
    const built = await buildPage(await readFile(join(pageRoot, file), 'utf8'), {
      parse: parseHtmlNode,
      loadComponent,
      ...(data && { data }),
      ...(filters && { filters }),
      ...(locale && { locale }),
      ...(currency && { currency }),
      bundle: { bundler, project, page, name, base: assetUrl },
    });
    const output = join(outDir, file);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, built.html);
    result.pages.push(output);
    for (const bundled of [built.bundle?.css, built.bundle?.js]) {
      if (!bundled) continue;
      const path = join(outDir, assets, bundled.fileName);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, bundled.code);
      result.bundles.push(path);
    }
  }
  return result;
}
