import { defineConfig } from 'vite-plus';

// `vp pack`: @buildadiv/query-template as one standalone, minified ES module with
// bundled typings. The private @buildadiv/shared code is inlined, so the published
// package has no dependencies.
export default defineConfig({
  pack: {
    entry: { 'query-template.min': 'standalone.ts' },
    outDir: 'lib',
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    sourcemap: true,
    deps: {
      // Only the private shared code may be inlined, and the output imports nothing.
      onlyBundle: [/^@buildadiv\/shared/],
      onlyImport: [],
      dts: { alwaysBundle: [/^@buildadiv\/shared/] },
    },
  },
});
