import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

interface PackedFile {
  path: string;
}
interface PackResult {
  name: string;
  files: PackedFile[];
}

/** Ask npm what a workspace package would publish, without publishing it. */
async function packed(workspace: string): Promise<PackResult> {
  const { stdout } = await promisify(execFile)('npm', [
    'pack',
    '--dry-run',
    '--json',
    '--workspace',
    workspace,
  ]);
  // npm returns an array, or (for workspaces in npm 12) an object keyed by package name.
  const parsed = JSON.parse(stdout) as PackResult[] | Record<string, PackResult>;
  const [result] = Array.isArray(parsed) ? parsed : Object.values(parsed);
  return result;
}

test('each product publishes only its packed lib, and never the private shared package', async () => {
  const runtime = await packed('@buildadiv/query-template');
  const builder = await packed('@buildadiv/builder');
  for (const { files } of [runtime, builder]) {
    const paths = files.map((file) => file.path);
    assert.ok(paths.includes('package.json'));
    assert.deepEqual(
      paths.filter((path) => path !== 'package.json' && !path.startsWith('lib/')),
      [],
    );
  }
  assert.ok(runtime.files.some((file) => file.path === 'lib/query-template.min.js'));
  assert.ok(builder.files.some((file) => file.path === 'lib/cli.mjs'));

  const { readFile } = await import('node:fs/promises');
  for (const folder of ['runtime', 'builder']) {
    const manifest = JSON.parse(await readFile(`packages/${folder}/package.json`, 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    assert.equal(manifest.dependencies?.['@buildadiv/shared'], undefined);
  }
  const shared = JSON.parse(await readFile('packages/shared/package.json', 'utf8')) as {
    private?: boolean;
  };
  assert.equal(shared.private, true);
});
