import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, parsePipeline } from '../../../packages/shared/pipeline.js';
import { fallback, truncate, upper } from '../../../packages/shared/filters.js';
import type { Filter } from '../../../packages/shared/types.js';

test('pipelines parse a dot path and filters with literal arguments', () => {
  assert.deepEqual(parsePipeline('product.price'), { path: 'product.price', filters: [] });
  assert.deepEqual(parsePipeline("  name | truncate:12 | fallback:'n/a'  "), {
    path: 'name',
    filters: [
      { name: 'truncate', args: [12] },
      { name: 'fallback', args: ['n/a'] },
    ],
  });
  // Numbers become numbers; bare words stay strings (currency codes, date styles, units).
  assert.deepEqual(parsePipeline('x | f:-1.5:EUR:"two words"').filters[0].args, [
    -1.5,
    'EUR',
    'two words',
  ]);
  // Quoted arguments keep separators; backslashes escape quotes.
  assert.deepEqual(parsePipeline("x | fallback:'a|b:c'").filters[0].args, ['a|b:c']);
  assert.deepEqual(parsePipeline("x | fallback:'it\\'s'").filters[0].args, ["it's"]);
});

test('filters apply left to right, each receiving the previous result', () => {
  const calls: string[] = [];
  const trace =
    (label: string): Filter =>
    (value) => {
      calls.push(label);
      return `${String(value)}>${label}`;
    };
  const filters = { a: trace('a'), b: trace('b'), upper };
  assert.equal(evaluate('word | a | b | upper', { word: 'x' }, filters), 'X>A>B');
  assert.deepEqual(calls, ['a', 'b']);
  assert.equal(
    evaluate(
      "title | upper | truncate:4 | fallback:'—'",
      { title: 'hello' },
      {
        upper,
        truncate,
        fallback,
      },
    ),
    'HEL…',
  );
});

test('pipelines reject expressions and malformed syntax instead of executing them', () => {
  for (const source of ['a > b', 'a + 1', 'a()', "a['b']", '', 'a.', 'a | ', 'a | up per'])
    assert.throws(() => parsePipeline(source), SyntaxError, source);
  assert.throws(() => parsePipeline("a | fallback:'unterminated"), /Unterminated/);
});

test('only explicitly registered filters run; unknown names are errors', () => {
  assert.throws(() => evaluate('a | unknown', {}, {}), /Unregistered filter: unknown/);
  // Registry lookups use own properties only, so Object.prototype is never reachable.
  assert.throws(() => evaluate('a | toString', {}, {}), /Unregistered filter: toString/);
  assert.throws(() => evaluate('a | constructor', {}, {}), /Unregistered filter: constructor/);
  // A project's own filter is just a function under the name used in HTML.
  const initials: Filter = (value) =>
    String(value)
      .split(/\s+/)
      .map((word) => word[0])
      .join('');
  assert.equal(evaluate('name | initials', { name: 'Ada Lovelace' }, { initials }), 'AL');
  assert.equal(
    evaluate(
      'when | relative-time',
      { when: 2 },
      { 'relative-time': (value) => `${String(value)}!` },
    ),
    '2!',
  );
});
