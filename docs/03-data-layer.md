# 03 · Data layer (part 1)

How fetched data is cached, kept fresh, persisted and updated after mutations. Inspired by RTK Query and TanStack Query, but not copied one-to-one. **Tags live only in actions; templates never see them.**

**Contents:** [Tags](#tags) · [Tag registry](#tag-registry) · [Cache lifetime](#cache-lifetime) · [Freshness](#freshness) · [Persistence](#persistence) · [Invalidation](#invalidation) · [Reconciliation](#reconciliation) · [Failure handling](#failure-handling)

---

## Tags

One shape everywhere: **`{ tag, key }`**.

- **`tag`**: the global type, e.g. `'Product'`, `'ProductDetail'`.
- **`key`**: the path to an item's id.
  - In `provides`, relative to each item (same as a list's `data-key`): `'id'`.
  - In `invalidates` and `reconciles`, relative to the **mutation's response body**: `'id'`, `'resource.id'`, `'results.0.id'`, …

A query declares one global tag plus a key, rather than a flat list of per-item tags, so long lists stay compact:

```js
export const loadProducts = query({
  url: '/api/products',
  provides: { tag: 'Product', key: 'id' },
  items: (response) => response.results,   // only if the response isn't already an array of objects
});
```

- Tags work on the **raw response**, through the `items` function (default: the response itself is the array). `context` only carries information to templates; the two don't overlap.
- The `key` is evaluated exactly like `data-key`, so a tag entry and its rendered element always line up.

## Tag registry

One compact object records which tags are in use:

```js
{
  Product: { queries: ['loadProducts'], ids: Set { 1, 2, 42 } },
}
```

- An entry is **added** when a `<use-template subscribe>` renders, and **removed** when its tag is invalidated or the element leaves the page.
- **Mounted** means "in the registry". Only mounted data is ever refetched.

## Cache lifetime

- **In memory**, keyed by action name plus serialized args, so every element using the same action and args shares one copy.
- **Reference-counted.** Each mounted `<use-template subscribe>` element is a subscriber. When the count reaches zero, a `keepUnusedFor` timer starts; if nothing subscribes before it ends, the data is dropped.

## Freshness

Two separate options, the same split as TanStack's `staleTime` and `gcTime`:

| Option | Question | Applies to | Default |
|---|---|---|---|
| `refetchAfter` | How old can data get before it's refetched? | Data in use | `respectCacheOr(Infinity)` |
| `keepUnusedFor` | How long is unused data kept in memory? | Data not in use | `respectCacheOr(Infinity)` |

Both accept:

| Value | `refetchAfter` | `keepUnusedFor` |
|---|---|---|
| seconds | refetch after that many seconds | drop after that many seconds unused |
| `Infinity` | never on age; only invalidation or reload | keep for the life of the page |
| `respectCacheOr(fallback)` | when the response's HTTP freshness runs out; `fallback` if there are no caching headers | same |

- **The library default is `respectCacheOr(Infinity)`**: the server decides via `Cache-Control: max-age`, `Expires`, `no-cache` (always refetch on use) and `no-store` (never keep). With no caching headers, nothing expires on age.
- `respectCacheOr` is the **only** form; there's no bare `respectCache`. Writing `respectCacheOr(300)` is just an override: "follow the headers; without them, 300 seconds".
- Once `keepUnusedFor` drops data, a region that remounts refetches it, even without an invalidation.

```js
import { respectCacheOr } from '../runtime/cache.js';

export const loadProducts = query({
  url: '/api/products',
  refetchAfter: respectCacheOr(300),
});
```

## Persistence

Opt-in, set globally with per-action overrides. `persist` takes a **store object**, never a string.

```js
import { localStore, sessionStore, indexedDbStore } from '../runtime/stores.js';

configure({ persist: sessionStore() });                              // global default

export const loadCatalog = query({ /* … */ persist: indexedDbStore() });
export const loadCart    = query({ /* … */ persist: localStore() });
export const loadSearch  = query({ /* … */ persist: false });
```

- Default `false`. Built-in stores are plain exported functions, so unused ones tree-shake away and projects can wrap them.
- Any other store is a convention, not a plugin: `{ get(key), set(key, value), remove(key) }`, returning promises.
- `maxAge` discards persisted entries older than this on restore (default 24 hours, as in TanStack). `buster` is a version string; changing it discards everything persisted.

## Invalidation

A mutation can drop cached data so mounted queries refetch:

```js
// whole tags: every query providing them, across all actions
export const importProducts = mutation({ url: '/api/products/import', invalidates: 'Product' });
export const checkout       = mutation({ url: '/api/checkout', invalidates: ['Cart', 'Order'] });

// one item, id read from the response
export const archiveProduct = mutation({
  url: (args) => `/api/products/${args.id}/archive`,
  invalidates: { tag: 'Product', key: 'resource.id' },
});

// one item, id from a function (e.g. DELETE → 204, no body)
export const deleteProduct = mutation({
  method: 'DELETE',
  url: (args) => `/api/products/${args.id}`,
  invalidates: { tag: 'Product', id: (args) => args.id },
});
```

| Form | Effect |
|---|---|
| `'Product'` or `['Cart', 'Order']` | Clear the whole tag(s) |
| `{ tag, key }` | Clear one item; id read from the mutation's response |
| `{ tag, id: fn }` | Clear one item; id computed from args |

- If the id can't be found, the **whole tag** is cleared.
- Ids match by value: a number and its string form are the same id, so `dataset.key` (always a string) identifies a numeric `id`. The same rule applies to `reconciles`.
- Mounted queries refetch; unmounted data is never fetched. Changes apply per `data-key`, so only changed items re-render.
- Paginated queries refetch according to their mode ([02](02-rendering-and-actions.md#pagination)).
- By default old content stays until fresh data arrives. `onInvalidate: 'pending'` on a query shows the `on-pending` template during the refetch instead.
- Each invalidated tag emits an `invalidate:Type` event.

## Reconciliation

A mutation can **reconcile** instead: its response is **upserted** into the cache, with no refetch.

```js
export const renameProduct = mutation({
  method: 'PUT',
  url: (args) => `/api/products/${args.id}`,
  reconciles: { tag: 'Product', key: 'id' },            // the body is the item
});

export const createProduct = mutation({
  url: '/api/products',
  reconciles: { tag: 'Product', key: 'resource.id' },   // the item is body.resource
});
```

- `reconciles` always needs `{ tag, key }`. **The item upserted is the object holding the key**: the whole body for `'id'`, `body.resource` for `'resource.id'`.
- **Contract:** that item has the same shape as the items the tag provides elsewhere.

**Flow:**

1. The request goes out. For an update, the target item is marked.
2. On response, the runtime reads the id at `key` and looks it up under the tag:
   - **Existing id:** the item replaces the old one in the cached response.
   - **New id:** the item is appended **at the end** of every mounted query providing the tag, and added to the registry.
3. If the query has a `sort` comparator `(a, b) => number`, the list is re-sorted. Default `null`: no sorting. The comparator decides how to handle non-numeric ids.
4. Changing the cached response re-runs that query's `context` function; only the affected item re-renders.

**No optimistic updates.** The UI only changes once the server has answered.

## Failure handling

| Situation | What happens |
|---|---|
| **Reconcile failure**: the mutation succeeded, but the key path or id isn't in the response, or the shape is wrong | Falls back to **invalidating the whole tag**. No option for this |
| **Mutation failure**: the request itself failed | Nothing changes (nothing was applied optimistically). The `error` event fires |
| **Refetch failure** | `onRefetchFailure: 'keep'` (default) keeps showing old data; `'throw'` renders `on-error` |
| **Timeout** | Only if the action sets `timeout` (seconds); there's no default, so `fetch`'s own behavior stands. The `timeout` event fires and the action ends in `error` |
