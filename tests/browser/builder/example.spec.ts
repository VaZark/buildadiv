import { test, expect } from '@playwright/test';

test('browser example produces a static preview with no component tags', async ({ page }) => {
  await page.goto('/examples/builder/index.html');
  await expect(page.locator('#output')).toContainText('VANILLA SHOP');
  await expect(page.frameLocator('iframe').locator('h1')).toHaveText('VANILLA SHOP');
  await expect(page.frameLocator('iframe').locator('h2')).toHaveText('Scarf');
  await expect(page.frameLocator('iframe').locator('site-layout, product-card')).toHaveCount(0);
});
