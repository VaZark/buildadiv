import { test, expect } from '@playwright/test';

// dist/examples/site-output is produced by `npm run build:site` (part of `npm run build`).
test('a CLI-built page runs on the standalone runtime with its scoped page bundle', async ({
  page,
  request,
}) => {
  await request.get('/api/reset');
  const errors: string[] = [];
  const loaded: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (sent) => loaded.push(new URL(sent.url()).pathname));
  await page.goto('/examples/site-output/index.html');

  // Static parts were rendered at build time; the list renders in the browser.
  await expect(page.locator('h1')).toHaveText('VANILLA SHOP');
  await expect(page.locator('li.row')).toHaveCount(2);
  await expect(page.locator('li.row').first()).toContainText('Scarf');

  // Plain component CSS arrived scoped and bundled; behavior came from the bundle.
  const card = page.locator('article.card');
  expect(await card.evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe('1px');
  expect(
    await page
      .locator('li.row')
      .first()
      .evaluate((row) => getComputedStyle(row).display),
  ).toBe('flex');
  await card.getByRole('button', { name: 'Select' }).click();
  await expect(card).toHaveClass(/selected/);

  // One runtime file, one bundle per type, no per-component or source-module requests.
  expect(loaded).toContain('/lib/buildadiv-runtime.min.js');
  expect(loaded.filter((path) => path.includes('/assets/'))).toEqual([
    '/examples/site-output/assets/shop-index.min.css',
    '/examples/site-output/assets/shop-index.min.js',
  ]);
  expect(loaded.some((path) => path.startsWith('/packages/'))).toBe(false);
  expect(loaded.some((path) => path.includes('/components/'))).toBe(false);
  expect(await page.evaluate(() => window.unusedBannerLoaded)).toBeUndefined();
  expect(errors).toEqual([]);

  // A page without behavior gets only its own (smaller) stylesheet.
  loaded.length = 0;
  await page.goto('/examples/site-output/about.html');
  await expect(page.locator('h1')).toHaveText('About');
  expect(loaded.filter((path) => path.includes('/assets/'))).toEqual([
    '/examples/site-output/assets/shop-about.min.css',
  ]);
});
