import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePipeline, evaluate } from '../../../packages/shared/pipeline.js';
import {
  fallback,
  upper,
  truncate,
  number,
  percent,
  date,
  relativeTime,
} from '../../../packages/shared/filters.js';

test('pipelines preserve quoted separators, apply filters, reject expressions and missing filters', () => {
  const pipeline = "name | fallback:'a|b:c' | upper";
  assert.equal(evaluate(pipeline, {}, { fallback, upper }), 'A|B:C');
  assert.equal(parsePipeline('name | truncate:4').filters[0].args[0], 4);
  assert.throws(() => parsePipeline('a > b'), SyntaxError);
  assert.throws(() => parsePipeline("a | fallback:'bad"), SyntaxError);
  assert.throws(() => evaluate('a | unknown', {}, {}), /Unregistered/);
  assert.equal(truncate('abcdef', 4), 'abc…');
  assert.equal(number(null), null);
  assert.equal(percent(0.5), '50%');
  assert.match(String(date('2025-01-01', 'long')), /2025/);
  assert.equal(relativeTime(-1, 'day'), 'yesterday');
});
