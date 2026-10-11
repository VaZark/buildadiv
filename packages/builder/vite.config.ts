import { defineConfig } from 'vite-plus';

// `vp pack`: @buildadiv/builder's browser entry, Node entry and CLI. The private
// @buildadiv/shared code is inlined; jsdom and vite-plus stay dependencies.
export default defineConfig({
  pack: {
    entry: { index: 'index.ts', node: 'node/index.ts', cli: 'node/cli.ts' },
    outDir: 'lib',
    format: 'esm',
    platform: 'node',
    target: 'node22',
    sourcemap: true,
    deps: {
      // Only the private shared code may be inlined; the output imports only its dependencies.
      onlyBundle: [/^@buildadiv\/shared/],
      onlyImport: ['jsdom', 'vite-plus'],
      dts: { alwaysBundle: [/^@buildadiv\/shared/] },
    },
  },
});
