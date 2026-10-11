import type { BundleName, BundleOptions, BundleOutput, ComponentUsage } from './contracts.js';

/** The default bundle name joins the customisable project and page prefixes. */
export const bundleName: BundleName = ({ project, page }) => `${project}-${page}`;

const safeName = /^[\w.-]+$/;

/**
 * Unify one page's component stylesheets and behavior modules through the
 * supplied bundler, then link the resulting files at the end of `<head>` (after
 * the page's own styles, so component CSS can override them). Pages using no
 * component assets get no bundle and no links. Names are restricted to file-safe
 * characters so a prefix can never point outside the asset folder.
 */
export async function bundlePage(
  document: Document,
  components: ComponentUsage[],
  { bundler, project, page, name = bundleName, base = '/assets/' }: BundleOptions,
): Promise<BundleOutput> {
  const bundled = components.filter((component) => component.style || component.script);
  if (!bundled.length) return {};
  const fileBase = name({ project, page });
  if (!safeName.test(fileBase)) throw new Error(`Invalid bundle name: ${fileBase}`);
  const output = await bundler({ name: fileBase, components: bundled });

  const head = document.head ?? document.documentElement;
  const prefix = base.endsWith('/') ? base : `${base}/`;
  if (output.css) {
    const link = document.createElement('link');
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('href', prefix + output.css.fileName);
    head.append(link);
  }
  if (output.js) {
    const script = document.createElement('script');
    script.setAttribute('type', 'module');
    script.setAttribute('src', prefix + output.js.fileName);
    head.append(script);
  }
  return output;
}
