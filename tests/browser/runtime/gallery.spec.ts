import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const ordersRequests = async (page: Page): Promise<number> =>
  ((await (await page.request.get('/api/calls')).json()) as Record<string, number>)[
    '/api/orders?delay=700'
  ] ?? 0;

test('the runtime gallery demonstrates every state and pattern it describes', async ({ page }) => {
  await page.request.get('/api/reset');
  const errors: string[] = [];
  const requested: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (sent) => requested.push(new URL(sent.url()).pathname));
  await page.goto('/examples/runtime/index.html');

  // 1 · Every state: pending first, then each action's own outcome.
  const success = page.locator('#state-success');
  await expect(success).toContainText('Loading…');
  await expect(success).toContainText('2 orders');
  await expect(success).toContainText('some still open');
  await expect(page.locator('#state-empty')).toContainText('No orders yet.');
  await expect(page.locator('#state-error')).toContainText('Request failed: 503');
  await expect(page.locator('#state-error')).toContainText('The orders service is down');
  await expect(page.locator('#state-timeout')).toContainText('Request failed: no response');
  await success.getByRole('button', { name: 'Reload' }).click();
  await expect(success).toContainText('Loading…');
  await expect(success).toContainText('2 orders');

  // 2 · Lists with nested templates, per-row conditionals and reconciliation.
  const rows = page.locator('.orders li.order');
  await expect(rows).toHaveCount(2);
  const ada = rows.filter({ hasText: 'Ada' });
  const grace = rows.filter({ hasText: 'Grace' });
  await expect(ada.locator('.tags li')).toHaveText(['gift', 'express']);
  await expect(ada.locator('.lines li')).toHaveText(['1 × Scarf', '2 × Hat']);
  await expect(grace.locator('.tags')).toBeHidden();
  await expect(grace.locator('.badge')).toHaveText('Shipped');
  await expect(grace.locator('.ship')).toBeHidden();
  await grace.evaluate((row) => ((row as HTMLElement & { marked?: boolean }).marked = true));
  const before = await ordersRequests(page);
  await ada.getByRole('button', { name: 'Mark shipped' }).click();
  await expect(ada.locator('.badge')).toHaveText('Shipped');
  await expect(ada.locator('.ship')).toBeHidden();
  expect(await grace.evaluate((row) => (row as HTMLElement & { marked?: boolean }).marked)).toBe(
    true,
  );
  expect(await ordersRequests(page)).toBe(before);

  // 3 · subscribe follows changes; load keeps its first result.
  // Compare rendered text: each row keeps both conditional branches, one hidden.
  const shown = (selector: string) => () => page.locator(selector).allInnerTexts();
  const subscribed = shown('#subscribed li');
  const loadedOnce = shown('#loaded-once li');
  await expect.poll(subscribed).toEqual(['Ada: shipped', 'Grace: shipped']);
  await expect.poll(loadedOnce).toEqual(['Ada: open', 'Grace: shipped']);
  await page.getByRole('button', { name: 'Reopen all orders' }).click();
  await expect.poll(subscribed).toEqual(['Ada: open', 'Grace: open']);
  expect(await ordersRequests(page)).toBe(before + 1);
  await expect.poll(loadedOnce).toEqual(['Ada: open', 'Grace: shipped']);

  // 4 · Pages mode: next/previous replace the page; buttons hide at the ends.
  const pages = page.locator('#pages');
  await expect(pages.locator('.catalog li')).toHaveCount(3);
  await expect(pages).toContainText('Page 1 of 3');
  await expect(pages.locator('.previous-page')).toBeHidden();
  await pages.locator('.next-page').click();
  await expect(pages).toContainText('Page 2 of 3');
  await expect(pages.locator('.catalog li').first()).toContainText('Catalog item 4');
  await pages.locator('.previous-page').click();
  await expect(pages).toContainText('Page 1 of 3');
  await pages.locator('.next-page').click();
  await expect(pages).toContainText('Page 2 of 3');
  await pages.locator('.next-page').click();
  await expect(pages).toContainText('Page 3 of 3');
  await expect(pages.locator('.catalog li')).toHaveCount(2);
  await expect(pages.locator('.next-page')).toBeHidden();

  // 5 · Infinite mode: the list grows and stays on screen; the button hides when done.
  const feed = page.locator('#feed');
  await expect(feed.locator('.feed li')).toHaveCount(3);
  await expect(feed).toContainText('Showing 3 of 8');
  await feed.locator('.load-more').click();
  await expect(feed.locator('.feed li')).toHaveCount(6);
  await feed.locator('.load-more').click();
  await expect(feed.locator('.feed li')).toHaveCount(8);
  await expect(feed).toContainText("That's everything.");
  await expect(feed.locator('.load-more')).toBeHidden();

  // 6 · A direct template: preview content and slot first, then `.data`.
  const note = page.locator('#note');
  await expect(note.locator('h3')).toHaveText('Preview title');
  await expect(note).toContainText("page author's markup");
  await page.getByRole('button', { name: 'Fill from .data' }).click();
  await expect(note.locator('h3')).toHaveText('Filled from .data');
  await expect(note).toContainText('By You');

  // The page runs on the standalone runtime file alone.
  expect(requested).toContain('/lib/query-template.min.js');
  expect(requested.some((path) => path.startsWith('/packages/'))).toBe(false);
  expect(errors).toEqual([]);
});
