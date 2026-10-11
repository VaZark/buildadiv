import test from 'node:test';
import assert from 'node:assert/strict';
import { componentFolder } from '../../../packages/shared/components.js';

test('component folders map names to files; 404 is unknown and names cannot escape', async () => {
  const requested: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    requested.push(url);
    if (url.includes('missing-card')) return new Response('Not found', { status: 404 });
    if (url.includes('broken-card')) return new Response('Error', { status: 500 });
    return new Response('<template data-component="price-tag"></template>');
  };
  const load = componentFolder('https://site.test/components');
  assert.deepEqual(await load('price-tag'), {
    url: 'https://site.test/components/price-tag/price-tag.html',
    html: '<template data-component="price-tag"></template>',
  });
  assert.equal(await load('missing-card'), undefined);
  await assert.rejects(load('broken-card'), /HTTP 500/);
  await assert.rejects(load('../secrets'), /Invalid component name/);
  await assert.rejects(load('Price-Tag'), /Invalid component name/);
  assert.equal(requested.length, 3);
});
