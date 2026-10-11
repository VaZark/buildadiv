import { test, expect } from '@playwright/test';
import { setup } from '../../support/browser.js';

test('render-template loads a component folder once: template, scoped stylesheet and behavior', async ({
  page,
  request,
}) => {
  const errors = await setup(page, request);
  const fileRequests: string[] = [];
  page.on('request', (sent) => {
    if (sent.url().includes('/components/greeting-card/')) fileRequests.push(sent.url());
  });
  await page.evaluate(async () => {
    const { configure } = await import('/packages/runtime/index.js');
    const { componentFolder } = await import('/packages/runtime/components.js');
    configure({ components: componentFolder('/tests/support/components/') });
    document.body.insertAdjacentHTML(
      'beforeend',
      `<render-template id="first" template="greeting-card"><span slot="title">First</span></render-template>
       <render-template id="second" template="greeting-card"><span slot="title">Second</span></render-template>
       <render-template id="missing" template="no-such-card"></render-template>
       <article id="outsider" class="greeting">Same class, not the component</article>`,
    );
  });
  await expect(page.locator('#first h2')).toHaveText('First');
  await expect(page.locator('#second h2')).toHaveText('Second');
  // Preview content stays until data is supplied; the stylesheet applied before rendering.
  await expect(page.locator('#first p')).toHaveText('Preview message');
  expect(
    await page
      .locator('#first article')
      .evaluate((article) => getComputedStyle(article).borderTopWidth),
  ).toBe('3px');
  // Plain `.greeting` CSS is scoped to the component's elements, added once.
  expect(await page.locator('style[data-component-style="greeting-card"]').count()).toBe(1);
  expect(
    await page.locator('#outsider').evaluate((article) => getComputedStyle(article).borderTopWidth),
  ).toBe('0px');
  expect(await page.evaluate(() => window.greetingBehaviorLoads)).toBe(1);
  await page.locator('#second button').click();
  await expect(page.locator('#second button')).toHaveText('Waved');
  expect(fileRequests.filter((url) => url.endsWith('.html'))).toHaveLength(1);
  await expect.poll(() => errors).toContain('Unknown template: no-such-card');
  expect(errors.filter((message) => !message.includes('no-such-card'))).toEqual([]);
});

test('without a component loader only templates declared in the page render', async ({
  page,
  request,
}) => {
  const errors = await setup(page, request);
  await page.evaluate(() =>
    document.body.insertAdjacentHTML(
      'beforeend',
      '<render-template id="unloaded" template="greeting-card"></render-template>',
    ),
  );
  await expect.poll(() => errors).toContain('Unknown template: greeting-card');
  await expect(page.locator('#unloaded')).toBeEmpty();
});
