import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/** Every name a published typings file exports, values and types alike. */
async function exportedNames(path: string): Promise<string[]> {
  const text = await readFile(path, 'utf8');
  const names = new Set<string>();
  for (const match of text.matchAll(
    /^export (?:declare )?(?:function|const|enum|class|interface|type)\s+(\w+)/gm,
  ))
    names.add(match[1]);
  for (const match of text.matchAll(/^export (?:type )?\{([\s\S]*?)\}/gm))
    for (const entry of match[1].split(',')) {
      const name = entry
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
        .at(-1);
      if (name) names.add(name);
    }
  return [...names];
}

test('API docs quote /examples and the published typings exactly', async () => {
  assert.deepEqual(await syncDocs(false), [], 'run npm run docs:sync');
});

test('every published export is documented in its package API doc', async () => {
  const packages = [
    {
      doc: 'docs/api/query-template.md',
      typings: ['packages/runtime/lib/query-template.min.d.ts'],
    },
    {
      doc: 'docs/api/builder.md',
      typings: ['packages/builder/lib/index.d.mts', 'packages/builder/lib/node.d.mts'],
    },
  ];
  for (const { doc, typings } of packages) {
    const text = await readFile(doc, 'utf8');
    for (const path of typings)
      for (const name of await exportedNames(path))
        assert.ok(text.includes(`\`${name}\``), `${doc} does not mention \`${name}\``);
  }
});
