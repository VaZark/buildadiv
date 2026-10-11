import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
// Use the stable parser API separately from the TypeScript 7 native compiler.
import ts from 'typescript-ast';

interface Dependency {
  target: string;
  typeOnly: boolean;
}
const packageRoot = resolve('packages');
const allowedPackages: Record<string, ReadonlySet<string>> = {
  shared: new Set(['shared']),
  runtime: new Set(['runtime', 'shared']),
  builder: new Set(['builder', 'shared']),
  editor: new Set(['editor', 'shared', 'runtime', 'builder']),
};

/** Traverse only authored TypeScript so generated output cannot hide an invalid dependency. */
async function sourceFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(path)));
    else if (entry.name.endsWith('.ts')) files.push(path);
  }
  return files;
}

/** Parse import/export syntax accurately, excluding erased type references from cycle checks. */
function dependencies(source: ts.SourceFile): Dependency[] {
  const result: Dependency[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const allNamedTypes =
        !clause?.name &&
        bindings &&
        ts.isNamedImports(bindings) &&
        bindings.elements.length > 0 &&
        bindings.elements.every((item) => item.isTypeOnly);
      result.push({
        target: node.moduleSpecifier.text,
        typeOnly: clause?.isTypeOnly || Boolean(allNamedTypes),
      });
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const bindings = node.exportClause;
      const allNamedTypes =
        bindings &&
        ts.isNamedExports(bindings) &&
        bindings.elements.length > 0 &&
        bindings.elements.every((item) => item.isTypeOnly);
      result.push({
        target: node.moduleSpecifier.text,
        typeOnly: node.isTypeOnly || Boolean(allNamedTypes),
      });
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      result.push({ target: node.arguments[0].text, typeOnly: false });
    }
    if (node.kind === ts.SyntaxKind.AnyKeyword)
      throw new Error(`${relative(packageRoot, source.fileName)} uses explicit any`);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return result;
}

/** Enforce documented package isolation and native .js specifiers at every source dependency. */
async function dependencyGraph(): Promise<Map<string, string[]>> {
  const files = await sourceFiles(packageRoot);
  const known = new Set(files);
  const graph = new Map<string, string[]>();
  for (const path of files) {
    const text = await readFile(path, 'utf8');
    if (/\/\/\s*@ts-(?:ignore|nocheck)\b/.test(text))
      throw new Error(`${relative(packageRoot, path)} disables type checks`);
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
    const owner = relative(packageRoot, path).split('/')[0];
    const edges: string[] = [];
    for (const dependency of dependencies(source)) {
      if (!dependency.target.startsWith('.') || !dependency.target.endsWith('.js')) {
        throw new Error(
          `${relative(packageRoot, path)} must use a relative native .js import: ${dependency.target}`,
        );
      }
      const target = resolve(dirname(path), dependency.target.replace(/\.js$/, '.ts'));
      const targetOwner = relative(packageRoot, target).split('/')[0];
      if (!known.has(target) || !allowedPackages[owner]?.has(targetOwner)) {
        throw new Error(
          `Invalid package dependency: ${relative(packageRoot, path)} → ${dependency.target}`,
        );
      }
      if (!dependency.typeOnly) edges.push(target);
    }
    graph.set(path, edges);
  }
  return graph;
}

/** A depth-first stack reports the actual cycle; type-only cross-domain contracts remain legal. */
function assertAcyclic(graph: Map<string, string[]>): void {
  const finished = new Set<string>();
  const stack: string[] = [];
  const visit = (path: string): void => {
    const start = stack.indexOf(path);
    if (start >= 0)
      throw new Error(
        `Value-import cycle: ${[...stack.slice(start), path].map((item) => relative(packageRoot, item)).join(' → ')}`,
      );
    if (finished.has(path)) return;
    stack.push(path);
    for (const target of graph.get(path) || []) visit(target);
    stack.pop();
    finished.add(path);
  };
  for (const path of graph.keys()) visit(path);
}

const graph = await dependencyGraph();
assertAcyclic(graph);
console.log(
  `Architecture verified: ${graph.size} source modules, valid package boundaries, no value-import cycles.`,
);
