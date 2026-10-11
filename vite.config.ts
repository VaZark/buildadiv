import { defineConfig } from 'vite-plus';

// Vite+ supplies the static checks (Oxfmt, Oxlint, type-aware linting) and the
// development environment for the whole workspace. Each published package packs
// itself with its own `vite.config.ts`; development builds stay on `tsc -b`.
export default defineConfig({
  fmt: {
    singleQuote: true,
    printWidth: 100,
    trailingComma: 'all',
    ignorePatterns: [
      'dist/**',
      'packages/*/dist/**',
      'packages/*/lib/**',
      'test-results/**',
      'playwright-report/**',
      'package-lock.json',
      // Spec tables stay hand-aligned; only the code map is machine-formatted.
      'docs/0[0-7]-*.md',
      // API docs embed code synced from /examples (npm run docs:sync); don't reflow it.
      'docs/api/*.md',
    ],
  },
  lint: {
    ignorePatterns: [
      'dist/**',
      'packages/*/dist/**',
      'packages/*/lib/**',
      'test-results/**',
      'playwright-report/**',
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    rules: {
      // Bindings and filters deliberately turn unknown data into text with String().
      'typescript/no-base-to-string': 'off',
    },
    overrides: [
      {
        // node:test registers cases through test(), whose returned promise the runner owns.
        files: ['tests/unit/**/*.ts'],
        rules: { 'typescript/no-floating-promises': 'off' },
      },
    ],
  },
});
