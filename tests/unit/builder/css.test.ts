import test from 'node:test';
import assert from 'node:assert/strict';
import { scopeCss } from '../../../packages/builder/css.js';

const scope = (css: string) => scopeCss(css, 'product-card');

test('component CSS is scoped on the last compound of every selector', () => {
  assert.equal(scope('.card { padding: 1rem }'), '.card[data-c="product-card"] { padding: 1rem }');
  assert.equal(
    scope('.card .title, h2 > a:hover {}'),
    '.card .title[data-c="product-card"], h2 > a:hover[data-c="product-card"] {}',
  );
  // Pseudo-elements stay last; functional pseudo-classes keep their inner commas and combinators.
  assert.equal(
    scope('.card::before, .card:after, li:is(.a, .b) + li:nth-child(2n+1) {}'),
    '.card[data-c="product-card"]::before, .card[data-c="product-card"]:after, li:is(.a, .b) + li:nth-child(2n+1)[data-c="product-card"] {}',
  );
  // Strings and comments are not parsed as selectors or blocks.
  assert.equal(
    scope('/* .x { } */ a[title="a, b {"] { content: "}" }'),
    '/* .x { } */ a[title="a, b {"][data-c="product-card"] { content: "}" }',
  );
});

test('grouping at-rules are scoped inside; other at-rules and explicit scopes stay as written', () => {
  assert.equal(
    scope('@media (min-width: 40rem) { .card { margin: 0 } }'),
    '@media (min-width: 40rem) { .card[data-c="product-card"] { margin: 0 } }',
  );
  const keyframes = '@keyframes pulse { from { opacity: 0 } to { opacity: 1 } }';
  assert.equal(scope(keyframes), keyframes);
  assert.equal(scope('@import url("base.css");\n'), '@import url("base.css");\n');
  const explicit = ".card[data-c='product-card'] { color: red }";
  assert.equal(scope(explicit), explicit);
});
