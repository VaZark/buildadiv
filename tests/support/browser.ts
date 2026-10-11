import { expect } from '@playwright/test';
import type { Page, APIRequestContext } from '@playwright/test';
import type { Action } from '../../packages/runtime/contracts/actions.js';

export async function setup(page: Page, request: APIRequestContext): Promise<string[]> {
  await request.get('/api/reset');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/examples/vanilla/index.html');
  await expect(page.locator('#products li')).toHaveCount(2);
  return errors;
}
export async function mount(
  page: Page,
  html: string,
  definitions: Record<string, { url: string; timeout?: number; kind?: 'mutation' | 'query' }> = {},
): Promise<void> {
  await page.evaluate(
    async ({ html, definitions }) => {
      const { configure } = await import('/packages/runtime/index.js');
      const { query, mutation } = await import('/packages/runtime/action.js');
      const actions: Record<string, Action> = {};
      for (const [name, options] of Object.entries(definitions))
        actions[name] = options.kind === 'mutation' ? mutation(options) : query(options);
      configure({ actions });
      const documentFragment = new DOMParser().parseFromString(
        '<!doctype html><html><head></head><body>' + html + '</body></html>',
        'text/html',
      );
      document.body.append(...documentFragment.body.childNodes);
    },
    { html, definitions },
  );
}
