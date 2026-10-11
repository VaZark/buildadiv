import { resolve, sep } from 'node:path';
import { build } from 'vite-plus';
import type { Bundler, BundleOutput } from '../contracts.js';
import { scopeCss } from '../css.js';
import { isComponentName } from '../components.js';

export interface ViteBundlerOptions {
  /** The site directory that root-relative component URLs (`/components/…`) resolve against. */
  root: string;
  /** Minify with Rolldown (JS) and Lightning CSS (CSS); on by default. */
  minify?: boolean;
}

const entryName = 'buildadiv-page-bundle';
const entryId = `\0${entryName}`;
// Stylesheets are imported with their component in the query so one transform can scope them.
const scopeQuery = /\.css\?scope=([a-z0-9-]+)$/;

/**
 * Node-only bundler built on Vite+ (Rolldown for JavaScript, Lightning CSS for
 * stylesheets). A virtual entry imports the components' files in first-use order,
 * styles before behavior, so the CSS cascade matches component use. Each
 * stylesheet is scoped to its component with the shared `scopeCss` before Vite
 * processes it, exactly as the runtime scopes styles it loads. The build stays in
 * memory; callers write the returned files. Only root-relative URLs inside `root`
 * are bundled, so a component cannot pull in arbitrary files.
 */
export function viteBundler({ root, minify = true }: ViteBundlerOptions): Bundler {
  const siteRoot = resolve(root);
  const fileFor = (url: string): string => {
    if (!url.startsWith('/') || url.startsWith('//'))
      throw new Error(`Bundled component files need root-relative URLs: ${url}`);
    const path = resolve(siteRoot, `.${decodeURIComponent(url.split(/[?#]/)[0])}`);
    if (!path.startsWith(siteRoot + sep))
      throw new Error(`Component file outside the site: ${url}`);
    return path;
  };

  return async ({ name, components }) => {
    for (const component of components)
      if (!isComponentName(component.name))
        throw new Error(`Invalid component name: ${component.name}`);
    const styles = components.flatMap(({ name: component, style }) =>
      style ? [`${fileFor(style)}?scope=${component}`] : [],
    );
    const scripts = components.flatMap(({ script }) => (script ? [fileFor(script)] : []));
    const imports = [...styles, ...scripts].map((path) => `import ${JSON.stringify(path)};`);
    const suffix = minify ? '.min' : '';
    const result = await build({
      root: siteRoot,
      configFile: false,
      logLevel: 'silent',
      publicDir: false,
      plugins: [
        {
          name: entryName,
          resolveId: (id) => (id === entryName ? entryId : undefined),
          load: (id) => (id === entryId ? imports.join('\n') : undefined),
        },
        {
          name: `${entryName}-scope`,
          enforce: 'pre',
          transform: (code, id) => {
            const component = scopeQuery.exec(id)?.[1];
            return component ? scopeCss(code, component) : undefined;
          },
        },
      ],
      build: {
        write: false,
        minify,
        cssMinify: minify,
        modulePreload: false,
        copyPublicDir: false,
        rollupOptions: {
          input: entryName,
          output: {
            entryFileNames: `${name}${suffix}.js`,
            assetFileNames: `${name}${suffix}[extname]`,
          },
        },
      },
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) =>
      'output' in item ? item.output : [],
    );
    const bundle: BundleOutput = {};
    for (const file of outputs) {
      if (file.type === 'chunk' && file.isEntry && scripts.length)
        bundle.js = { fileName: file.fileName, code: file.code };
      else if (file.type === 'asset' && file.fileName.endsWith('.css'))
        bundle.css = { fileName: file.fileName, code: String(file.source) };
    }
    return bundle;
  };
}
