import { test, expect } from '@playwright/test';

test('browser example produces a static preview with no component tags or definitions', async ({
  page,
}) => {
  await page.goto('/examples/builder/index.html');
  await expect(page.locator('#output')).toContainText('VANILLA SHOP');
  await expect(page.frameLocator('iframe').locator('h1')).toHaveText('VANILLA SHOP');
  await expect(page.frameLocator('iframe').locator('h2')).toHaveText('Scarf');
  await expect(page.frameLocator('iframe').locator('site-layout, product-card')).toHaveCount(0);
  // Component tags rendered at build time; their definitions are not shipped.
  await expect(page.frameLocator('iframe').locator('template[data-component]')).toHaveCount(0);
  await expect(page.locator('#output')).not.toContainText('data-component');
  // Component styles are marked for the global build, never linked into the page.
  await expect(page.locator('#output')).not.toContainText('product-card.css');
  await expect(page.locator('#assets')).toContainText(
    '/examples/builder/components/product-card/product-card.css',
  );
});
