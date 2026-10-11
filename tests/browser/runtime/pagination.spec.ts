import { test, expect } from '@playwright/test';
import { setup, mount } from '../../support/browser.js';

test('infinite pagination loads more and marks page rows; pages mode replaces', async ({
  page,
  request,
}) => {
  const errors = await setup(page, request);
  await page.evaluate(async () => {
    const { configure } = await import('/packages/runtime/index.js');
    const { provider } = await import('/packages/runtime/action.js');
    const make = (mode: 'pages' | 'infinite') =>
      provider<number>({
        url: (page) => '/api/pages?page=' + page,
        paginated: {
          mode,
          firstPage: 1,
          nextPage: (_response, page) => (page < 3 ? page + 1 : null),
        },
      });
    configure({ actions: { infiniteTest: make('infinite'), pagesTest: make('pages') } });
  });
  await mount(
    page,
    '<render-template id="infinite" subscribe-to-action="infiniteTest" on-success="product-rows"></render-template><button data-action="infiniteTest">More infinite</button><render-template id="pages" subscribe-to-action="pagesTest" on-success="product-rows"></render-template><button data-action="pagesTest">Next page</button>',
  );
  await expect(page.locator('#infinite li')).toHaveCount(1);
  await expect(page.locator('#pages li')).toHaveCount(1);
  await page.getByText('More infinite', { exact: true }).click();
  await expect(page.locator('#infinite li')).toHaveCount(2);
  await expect(page.locator('#infinite li').nth(1)).toHaveAttribute('data-page-index', '1');
  await page.getByText('Next page', { exact: true }).click();
  await expect(page.locator('#pages li strong')).toHaveText('Page 2');
  expect(errors).toEqual([]);
});

test('infinite viewport invalidation refreshes nearby older pages when scrolling back', async ({
  page,
  request,
}) => {
  const errors = await setup(page, request);
  await page.evaluate(async () => {
    const { configure } = await import('/packages/runtime/index.js');
    const { provider, mutation } = await import('/packages/runtime/action.js');
    const viewportTest = provider<number>({
      url: (page) => '/api/pages?page=' + page,
      provides: { tag: 'Viewport', key: 'id' },
      paginated: {
        mode: 'infinite',
        firstPage: 1,
        nextPage: (_response, page) => (page < 5 ? page + 1 : null),
      },
    });
    const invalidateViewport = mutation({ url: '/api/import', invalidates: 'Viewport' });
    configure({ actions: { viewportTest, invalidateViewport } });
    window.viewportTest = viewportTest;
    window.invalidateViewport = invalidateViewport;
  });
  await mount(
    page,
    '<template data-component="tall-rows" data-accepts="array" data-item="row" data-key="id"><article style="height:900px"><h2 data-bind="row.name">Page name</h2></article></template><render-template id="viewport" subscribe-to-action="viewportTest" on-success="tall-rows"></render-template>',
  );
  await expect(page.locator('#viewport article')).toHaveCount(1);
  await page.evaluate(async () => {
    await window.viewportTest();
    await window.viewportTest();
    await window.viewportTest();
    await window.viewportTest();
  });
  await expect(page.locator('#viewport article')).toHaveCount(5);
  await page.locator('#viewport article').nth(3).scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { getEntry } = await import('/packages/runtime/data/entries.js');
        return getEntry(window.viewportTest).currentPage;
      }),
    )
    .toBe(3);
  await page.evaluate(() => window.invalidateViewport());
  const after = await (await request.get('/api/calls')).json();
  expect(after['/api/pages?page=3']).toBe(2);
  expect(after['/api/pages?page=4']).toBe(2);
  expect(after['/api/pages?page=1']).toBe(1);
  expect(after['/api/pages?page=5']).toBe(1);
  await page.locator('#viewport article').first().scrollIntoViewIfNeeded();
  await expect
    .poll(async () => (await (await request.get('/api/calls')).json())['/api/pages?page=1'])
    .toBe(2);
  expect(errors).toEqual([]);
});
