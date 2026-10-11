import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Open the manual playground on fresh demo data, collecting uncaught page errors. */
async function openPlayground(page: Page, errors: string[]): Promise<void> {
  page.on('pageerror', (error) => errors.push(error.message));
  await page.request.get('/api/reset');
  await page.goto('/examples/playground/index.html');
  await expect(page.locator('.scenario').first().locator('.rows li')).toHaveCount(2);
}
const section = (page: Page, number: number) => page.locator('.scenario').nth(number - 1);
const calls = async (page: Page): Promise<Record<string, number>> =>
  (await page.request.get('/api/calls')).json();

test('playground scenarios behave as their instructions describe', async ({ page }) => {
  const errors: string[] = [];
  await openPlayground(page, errors);

  // 1 · A trigger refreshes fresh data.
  const before = (await calls(page))['/api/products'];
  await section(page, 1).getByRole('button', { name: 'Refresh products' }).click();
  await expect.poll(async () => (await calls(page))['/api/products']).toBe(before + 1);
  await page.getByRole('button', { name: 'Refresh counts' }).click();
  await expect(page.locator('.monitor')).toContainText('/api/products');

  // 2 · Delete with a string id.
  await section(page, 2).locator('.rows li', { hasText: 'Hat' }).getByRole('button').click();
  await expect(section(page, 2).locator('.rows li')).toHaveCount(1);
  await expect(section(page, 1).locator('.rows li')).toHaveCount(1);
  await page.getByRole('button', { name: 'Reset demo data' }).click();
  await expect(section(page, 2).locator('.rows li')).toHaveCount(2);

  // 3 · Select a page while another loads.
  await page.getByRole('button', { name: 'Page 2' }).click();
  await page.getByRole('button', { name: 'Page 5' }).click();
  const shownPage = section(page, 3).locator('strong');
  await expect(shownPage).toHaveText('Page 5', { timeout: 10_000 });
  const pages = Object.keys(await calls(page)).filter((path) => path.startsWith('/api/pages'));
  expect(pages.filter((path) => /page=[25]&/.test(path)).sort()).toEqual([
    '/api/pages?page=2&delay=800',
    '/api/pages?page=5&delay=800',
  ]);

  // 4 · Context runs in every state.
  await section(page, 4).getByRole('button', { name: 'Reload status' }).click();
  await expect(section(page, 4)).toContainText('waiting for the server');
  await expect(section(page, 4)).toContainText('loaded with HTTP 200');
  await expect(section(page, 4)).toContainText('The server answered 500');

  // 5 · A throwing context function is contained.
  await expect(section(page, 5)).toContainText('0 fields');

  // 6 · A broken template does not fail the request.
  await expect(section(page, 6)).toContainText('2 products (healthy region)');
  await expect(page.locator('#event-log')).toContainText('loadBrokenRows:success');
  await expect(page.locator('#event-log')).not.toContainText('loadBrokenRows:error');
  await expect(page.locator('#event-log')).toContainText('loadCareless:success');

  // Only the two deliberately broken scenarios report errors.
  const unexpected = errors.filter(
    (message) =>
      !message.includes('List keys must be unique') &&
      !message.includes('Cannot convert undefined or null to object'),
  );
  expect(unexpected).toEqual([]);
  expect(errors.some((message) => message.includes('List keys must be unique'))).toBe(true);
});
