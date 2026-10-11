import { defineConfig } from '@playwright/test';
// A separate port lets the suite run while `npm run serve-examples` serves 4173.
const port = Number(process.env.TEST_PORT) || 4174;
export default defineConfig({
  testDir: './tests/browser',
  // The demo API is shared; serialize browser cases to keep request-count checks isolated.
  workers: 1,
  use: { baseURL: `http://127.0.0.1:${port}`, headless: true },
  webServer: {
    command: `PORT=${port} node dist/tests/support/server.js`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
});
