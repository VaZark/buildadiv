import { configure } from '../../packages/runtime/index.js';
import { action, mutation, query } from '../../packages/runtime/action.js';
import { json } from '../../packages/runtime/formats.js';
import type { ActionResult, NormalizedActionOptions } from '../../packages/runtime/types.js';

interface Product {
  id: number;
  name: string;
}

/** Compile-only assertions exercise public types without making network requests. */
async function verifyPublicContracts(): Promise<void> {
  const load = query<{ category: string }, Product[]>({
    url: (args) => `/api/products?category=${args.category}`,
    context: (response) => ({ count: response?.length || 0 }),
    sort: (left, right) => left.name.localeCompare(right.name),
  });
  const rename = mutation<{ id: number; name: string }, Product>({
    method: 'PUT',
    url: (args) => `/api/products/${args.id}`,
  });
  configure({ actions: { load, rename } });
  const result: ActionResult<Product[]> = await load({ category: 'clothing' });
  result.response?.forEach((product) => product.name.toUpperCase());
  await rename({ id: 1, name: 'Scarf' });
  const queryKind: 'query' = load.options.kind;
  const mutationKind: 'mutation' = rename.options.kind;
  const search = query({ method: 'QUERY', url: '/search', send: json });
  const custom = action({ method: 'CUSTOM', url: '/custom' });
  void [queryKind, mutationKind, search, custom];

  const mutationFields = { url: '/products', invalidates: 'Product' };
  // @ts-expect-error Queries reject mutation options even through a variable.
  query(mutationFields);
  const queryFields = { url: '/products', provides: { tag: 'Product', key: 'id' } };
  // @ts-expect-error Mutations reject query options even through a variable.
  mutation(queryFields);
  // @ts-expect-error A query method must be GET or QUERY.
  query({ url: '/products', method: 'POST' });
  // @ts-expect-error A mutation cannot use a read method.
  mutation({ url: '/products', method: 'GET' });
  // @ts-expect-error GET has no encoder; QUERY supports body encoding.
  query({ url: '/products', method: 'GET', send: json });
  // @ts-expect-error Runtime metadata retains the query's forbidden fields.
  load.options.invalidates = 'Product';
  // @ts-expect-error Runtime metadata retains the mutation's forbidden fields.
  rename.options.provides = { tag: 'Product', key: 'id' };
  // @ts-expect-error Typed direct calls reject missing required argument fields.
  await rename({ id: 1 });
  // @ts-expect-error Response shapes remain specific through action results.
  const wrong: ActionResult<number> = result;
  void wrong;
}
void verifyPublicContracts;

/** Role narrowing keeps opposing option fields unavailable inside execution code. */
function verifyDiscriminator(options: NormalizedActionOptions): void {
  if (options.kind === 'query') {
    const absent: undefined = options.invalidates;
    const read: 'GET' | 'QUERY' = options.method;
    void [absent, read];
  } else if (options.kind === 'mutation') {
    const absent: undefined = options.provides;
    void [absent];
  }
}
void verifyDiscriminator;
