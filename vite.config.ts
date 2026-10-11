import { defineConfig } from 'vite-plus';

// Vite+ supplies the static checks (Oxfmt, Oxlint, type-aware linting) and the
// development environment. Builds stay on `tsc` so output remains plain ES modules.
export default defineConfig({
  fmt: {
    singleQuote: true,
    printWidth: 100,
    trailingComma: 'all',
    ignorePatterns: [
      'dist/**',
      'test-results/**',
      'playwright-report/**',
      'package-lock.json',
      // Spec tables stay hand-aligned; only the code map is machine-formatted.
      'docs/0[0-7]-*.md',
    ],
  },
  lint: {
    ignorePatterns: ['dist/**', 'test-results/**', 'playwright-report/**'],
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
