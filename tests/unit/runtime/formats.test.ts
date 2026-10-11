import test from 'node:test';
import assert from 'node:assert/strict';
import { json, text, multipart, urlencoded } from '../../../packages/runtime/formats.js';

test('format functions encode forms including repeated fields and decode responses', async () => {
  const form = new FormData();
  form.append('name', 'one');
  form.append('name', 'two');
  assert.deepEqual(JSON.parse(String(json(form).body)), { name: ['one', 'two'] });
  assert.equal(multipart(form).body, form);
  assert.equal(urlencoded(form).body!.toString(), 'name=one&name=two');
  assert.deepEqual(await json(new Response('{"ok":true}')), { ok: true });
  assert.equal(await text(new Response('hello')), 'hello');
});
