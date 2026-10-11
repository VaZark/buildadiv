import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  // The demo API is shared; serialize browser cases to keep request-count checks isolated.
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173', headless: true },
  webServer: {
    command: 'node dist/tests/support/server.js',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
});
