import test from 'node:test';
import assert from 'node:assert/strict';
import { componentFolder } from '../../../packages/builder/components.js';

test('component folders map names to files, detect optional assets, and cannot escape', async () => {
  const requested: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requested.push(`${init?.method ?? 'GET'} ${url}`);
    if (url.includes('missing-card')) return new Response('Not found', { status: 404 });
    if (url.includes('broken-card')) return new Response('Error', { status: 500 });
    if (url.endsWith('.js')) return new Response(null, { status: 404 });
    return new Response(
      url.endsWith('.css') ? null : '<template data-component="price-tag"></template>',
    );
  };
  const load = componentFolder('https://site.test/components');
  // A stylesheet beside the template is picked up; the missing script is simply absent.
  assert.deepEqual(await load('price-tag'), {
    url: 'https://site.test/components/price-tag/price-tag.html',
    html: '<template data-component="price-tag"></template>',
    style: 'https://site.test/components/price-tag/price-tag.css',
  });
  assert.deepEqual(requested, [
    'GET https://site.test/components/price-tag/price-tag.html',
    'HEAD https://site.test/components/price-tag/price-tag.css',
    'HEAD https://site.test/components/price-tag/price-tag.js',
  ]);
  assert.equal(await load('missing-card'), undefined);
  await assert.rejects(load('broken-card'), /HTTP 500/);
  await assert.rejects(load('../secrets'), /Invalid component name/);
  await assert.rejects(load('Price-Tag'), /Invalid component name/);
});
