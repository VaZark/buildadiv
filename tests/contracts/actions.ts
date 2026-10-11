import { configure } from '../../packages/runtime/index.js';
import { action, mutation, provider } from '../../packages/runtime/action.js';
import { json } from '../../packages/runtime/formats.js';
import type { ActionResult, NormalizedActionOptions } from '../../packages/runtime/types.js';

interface Product {
  id: number;
  name: string;
}

/** Compile-only assertions exercise public types without making network requests. */
async function verifyPublicContracts(): Promise<void> {
  const load = provider<{ category: string }, Product[]>({
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
  const providerKind: 'provider' = load.options.kind;
  const mutationKind: 'mutation' = rename.options.kind;
  const query = provider({ method: 'QUERY', url: '/search', send: json });
  const custom = action({ method: 'CUSTOM', url: '/custom' });
  void [providerKind, mutationKind, query, custom];

  const mutationFields = { url: '/products', invalidates: 'Product' };
  // @ts-expect-error Providers reject mutation options even through a variable.
  provider(mutationFields);
  const queryFields = { url: '/products', provides: { tag: 'Product', key: 'id' } };
  // @ts-expect-error Mutations reject query options even through a variable.
  mutation(queryFields);
  // @ts-expect-error A provider method must be GET or QUERY.
  provider({ url: '/products', method: 'POST' });
  // @ts-expect-error A mutation cannot use a read method.
  mutation({ url: '/products', method: 'GET' });
  // @ts-expect-error GET has no encoder; QUERY supports body encoding.
  provider({ url: '/products', method: 'GET', send: json });
  // @ts-expect-error Runtime metadata retains the provider's forbidden fields.
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
  if (options.kind === 'provider') {
    const absent: undefined = options.invalidates;
    const read: 'GET' | 'QUERY' = options.method;
    void [absent, read];
  } else if (options.kind === 'mutation') {
    const absent: undefined = options.provides;
    void absent;
  }
}
void verifyDiscriminator;
