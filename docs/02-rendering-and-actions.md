# 02 · Rendering and actions (part 1)

How data gets from an API onto the page: actions fetch it, `<render-template>` places it, templates render it.

**Contents:** [Who does what](#who-does-what) · [`<render-template>`](#render-template) · [Actions](#actions) · [Invoking actions](#invoking-actions) · [Context](#context) · [Pagination](#pagination) · [Request and response formats](#request-and-response-formats) · [Events](#events)

---

## Who does what

| Piece | Knows | Doesn't know |
|---|---|---|
| **Action** (`api/`) | The request, the method, how to decode it, which tags it provides or touches | Templates, or where anything appears |
| **`<render-template>`** | Where a component renders, and which template to use for each state | How the data is fetched |
| **Template** | The shape of the data it binds, and the slots it offers | Where data comes from |
| **`data-action` element** | Which function to call | Anything about data |

For choosing between bindings, slots, `<render-template>` and component tags, see [01 · When to use what](01-templates.md#when-to-use-what).

## `<render-template>`

The one runtime element for **placing** components in the browser, with or without data.

```html
<!-- a component with no data: name it, fill its slots with children -->
<render-template template="modal-dialog">
  <h2 slot="header">Delete product?</h2>
  <p>This can't be undone.</p>
  <button data-action="deleteProduct">Delete</button>
</render-template>

<!-- a component fed by an action: its bindings are filled from the data -->
<render-template
  subscribe-to-action="loadProducts"
  on-pending="product-skeleton"
  on-success="product-rows"
  on-no-content="no-products"
  on-error="error-message">
</render-template>
```

| Attribute | Meaning |
|---|---|
| `template="name"` | Render this component directly, with no action. Children fill its slots |
| `load-from-action="fn"` | **Load and forget.** Call the action once and render. No tag subscription, so invalidation and freshness never refresh it |
| `subscribe-to-action="fn"` | **Stay up to date.** Subscribe to the action's tags; invalidation, reconciliation, freshness and pagination keep it current |
| `on-pending`, `on-success`, `on-no-content`, `on-error` | The template to render in each state |

- **Children always fill slots**, whether or not there's an action. Bindings are filled from the action's data.
- **A state with no template does nothing.** There are no system defaults: the element keeps whatever it shows.
- Any number of elements can share an action, each with its own templates (e.g. a full list in one place and a count badge in another), from a single fetch.
- Only `subscribe-to-action` elements count as **mounted** for the tag registry and cache ([03](03-data-layer.md#tag-registry)).
- It applies bindings, attribute bindings, filters, slot filling, scope attributes and `data-if` hiding to what it renders.
- It's a plain custom element: no shadow DOM, no framework.

## Actions

All fetching and mutation lives in `api/` as **plain, readable, named functions**. Every action is an HTTP request.

```js
// api/products.js
import { provider, mutation } from '../runtime/action.js';

export const loadProducts = provider({ url: '/api/products' });

export const addToCart = mutation({ method: 'POST', url: '/api/cart' });
```

| Helper | HTTP methods | For | Options |
|---|---|---|---|
| `action()` | any | The **baseline**, available to everyone | every option |
| `provider()` | `GET` (default), `QUERY` | Reading | `provides`, `items`, `sort`, `paginated`, `refetchAfter`, `keepUnusedFor`, `persist`, `context`, `accepts`, `timeout`, `onRefetchFailure`, `onInvalidate`; `send` for `QUERY` bodies |
| `mutation()` | `POST` (default), `PUT`, `PATCH`, `DELETE`, … | Changing data | `invalidates`, `reconciles`, `send`, `context`, `accepts`, `timeout` |

- `provider()` and `mutation()` are thin layers over `action()`. They reject options that don't fit the role: a provider can't invalidate, a mutation can't provide.
- All three return an ordinary async function. Hand-written functions with the same signature are equally valid.
- `QUERY` (RFC 10008) is the HTTP method for safe, read-only requests that carry a body, such as a complex search. It reads, so it belongs with providers.
- Action names must be **unique** across the project, because events are named after them.
- Generated actions must be readable code a developer would happily maintain by hand.

**States.** Every action moves through `pending`, `success`, `no-content` and `error`.

- `no-content` is about the **response**: a 204 or an empty body. An empty array is an ordinary `success`; a list simply renders zero items. If an API returns `[]` instead of 204, that's its choice.

## Invoking actions

```html
<button data-action="loadCart">Refresh cart</button>
<form data-action="addToCart">…</form>
```

- `data-action` names the function. That's all the element knows.
- The event defaults to `click`, or `submit` on forms. `data-on="…"` overrides it (`load`, `change`, …).
- Actions are plain functions, so `onclick="loadCart()"` or an HTMX hook works too.
- A `data-action` on a provider is an explicit refresh: it refetches even when cached data is still fresh (a paginated provider loads its next page instead). Calling a provider from JS reads through the cache like any other caller.

**Arguments.** `data-action` never passes arguments (a form sends its fields as the body). When an action needs arguments, call it from a regular event handler:

```html
<button onclick="deleteProduct({ id: this.closest('[data-key]').dataset.key })">Delete</button>
```

Anything else an action needs (a URL parameter, a filter value) it reads itself, or receives from the JS that calls it. There is no `data-args`.

## Context

Every template rendered from an action receives **one object**:

```js
{
  response,   // the decoded response data; null when there isn't one (pending, error)
  context,    // built-in fields + extra fields the action adds
}
```

**Built-in fields**, present in every state:

| Field | Meaning |
|---|---|
| `context.pending` | `true` while the request is in flight |
| `context.success` | `true` after a successful response |
| `context.noContent` | `true` after a 204 or empty body |
| `context.error` | `true` after a failed request (network or HTTP 400+) |
| `context.statusCode` | The HTTP status code, when there is one |
| `context.nextPage` | Paginated actions: the next page param, or a falsy value when done |

**Extra fields** come from the action's optional `context` function, merged into `context`:

```js
export const loadProducts = provider({
  url: '/api/products',
  context: (response, status, args) => ({
    hasMore: Boolean(response && response.page < response.pages),
    isFiltered: Boolean(args?.category),
  }),
});
```

```html
<p data-bind="response.total | number">0</p>
<span data-if="context.isFiltered">Filtered</span>
```

- **This is where logic goes.** Comparisons, OR conditions and derived values become plain fields that templates test with `data-if`.
- The runtime doesn't interpret responses; the `context` function does, in plain JS.
- Built-in names are reserved; the function can't override them.
- The `context` function runs in **every state**, with `response` set to `null` while pending, after an error and for no content. Its fields are yours; the runtime doesn't check their shape. A `context` function that throws is reported as an uncaught error and adds no fields; the request carries on.
- Because `context` always exists, `on-pending` and `on-error` templates always have something to read.
- Fixtures mirror `{ response, context }`.

## Pagination

Two modes, because they invalidate differently. Modeled on RTK Query's infinite queries and TanStack's `useInfiniteQuery`.

```js
export const loadProducts = provider({
  url: (page) => `/api/products?page=${page}`,
  paginated: {
    mode: 'infinite',                 // 'pages' | 'infinite'
    firstPage: 1,
    nextPage: (response, page) => (response.page < response.pages ? page + 1 : null),
    refreshBehind: 1,                 // infinite only; default 1
  },
});
```

```html
<render-template subscribe-to-action="loadProducts" on-success="product-list"></render-template>

<!-- inside components/product-list/product-list.html -->
<button data-action="loadProducts" data-if="context.nextPage">Load more</button>
```

**Both modes:**

- `nextPage` is a function returning whatever page param the API uses (number, cursor, offset), or `null` / `undefined` / `false` when there's nothing left. It's exposed as `context.nextPage`.
- A `data-action` pointing at a paginated action loads the **next** page. `data-if="context.nextPage"` hides the button at the end. The button must live inside a template rendered by that action so it can see `context`.
- Pages combine through the `merge` behavior function. The default assumes each page is an array of objects. The merged data becomes `response`, and `context` runs on it.

| Mode | Behavior | On invalidation |
|---|---|---|
| `pages` | One page at a time; loading another replaces it | Refetch only the current page |
| `infinite` | Pages accumulate; the list grows | See below |

**Infinite invalidation:**

1. Find the **current page**: the one in view.
2. Refetch it and the `refreshBehind` pages just before it. If it's the first page, just refresh it.
3. Never refetch pages **after** the current one.
4. Mark all other older pages invalidated, without refetching yet.
5. Activate an `IntersectionObserver`: as the user scrolls up, refetch each invalidated page before it comes into view, staying `refreshBehind` pages ahead.
6. Remove the observer at the top, or on a full page reload.

## Request and response formats

Encoding and decoding happen in the action only. Templates only ever see decoded data, and `send` / `accepts` never appear in HTML.

```js
import { json, multipart } from '../runtime/formats.js';

export const updateProfile = mutation({
  method: 'POST',
  url: '/api/profile',
  send: multipart,     // default for forms; also json, urlencoded
  accepts: json,       // default; also text
  reconciles: { tag: 'Profile', key: 'id' },
});
```

- **`send`** encodes the body. Forms default to `multipart` (it handles file uploads); `json` converts the form or args to JSON.
- **`accepts`** decodes the response. Default `json`; `text` is also built in.
- **Any other format** (MessagePack, protobuf for gRPC-web, …) is a convention: pass a decoder function `(response: Response) => Promise<data>` and bring your own library.

```js
import { decode } from './vendor/msgpack.js';

export const loadReadings = provider({
  url: '/api/readings',
  accepts: async (res) => decode(new Uint8Array(await res.arrayBuffer())),
});
```

## Events

Actions and `<render-template>` elements emit `CustomEvent`s on `document`, so other code (notifications, analytics, closing a modal) can react without the action knowing.

**Name:** `functionName:event`, e.g. `createProduct:success`. No HTTP method prefix; action names are unique.

- State events reuse `<render-template>`'s names: `on-success` ↔ `success`.
- Lifecycle events follow **htmx 4**'s `before:` / `after:` / `finally:` convention, so anyone who knows htmx reads them instantly.

| Event | Fires when |
|---|---|
| `before:request` | Just before `fetch()` is called |
| `pending` | The action enters the pending state |
| `after:request` | The response has been read and decoded |
| `success` | The action enters the success state |
| `no-content` | The action enters the no-content state |
| `error` | The request failed: network error or HTTP 400+ |
| `timeout` | The action's `timeout` elapsed (it then ends in `error`) |
| `finally:request` | The request lifecycle ended, whatever the outcome |
| `before:render` | A `<render-template>` is about to update the DOM |
| `after:render` | A `<render-template>` has updated the DOM |
| `invalidate:Type` | A tag was invalidated (item id in the detail when there is one) |

```js
document.addEventListener('createProduct:success', () => showToast('Product created'));
document.addEventListener('createProduct:error', () => showToast('Could not create product'));
```

- `event: 'product-created'` on an action replaces its `functionName` prefix (`product-created:success`, …).
- The detail carries `{ action, method, args, event, result | error, tags }`, plus `element` for render events.

## Native browser setup

Load the runtime with a normal `<script type="module">`; no bundler or framework is
required. Import actions from `api/` and register their unique names explicitly:

```js
import { configure } from '../runtime/index.js';
import { loadProducts, renameProduct } from './api/products.js';
configure({ actions: { loadProducts, renameProduct } });
```

Registration supplies names for helper-created functions, document events, and
HTML action attributes. It does not put functions on `window`; inline handlers
require an explicit assignment by the application. Register before requesting
data. Direct components keep binding preview content until their `.data` property
is assigned; assigning `.data` renders ordinary data without an action.
Helper-created actions resolve to `{ response, context }` (including error states).
Request failures emit events rather than creating unhandled promise rejections.
Hand-written registered actions may return the same shape and reject on failure.
For custom trigger events, call `configure` before dispatching the event; delegated
listeners support elements inserted later. Form submission uses `FormData`, including
the submitter; a normal JavaScript call passes its argument as the request body.

Pagination calls without arguments load the next page (the first on initial load).
Explicit arguments select a page; selecting a different page while one loads waits for it, then loads the requested page. Infinite providers share a page sequence;
nonpaginated providers cache distinct JSON-serializable arguments separately.
The exported default `mergeInfinite` concatenates arrays and `mergePages` replaces
the response; use `merge` for envelopes. Infinite array rows carry page markers
for viewport tracking. Envelope-based lists use the provider's `items` function
for page markers. Styles are ordinary linked CSS with explicit `[data-c]` selectors;
the runtime adds scope attributes and never rewrites CSS.

## Component files

A `<render-template>` can render components that live in the `components/` folder
instead of in the page. Configure where they are, once:

```js
import { configure } from '../runtime/index.js';
import { componentFolder } from '../runtime/components.js';

configure({ components: componentFolder('/components/') });
```

- When a `<render-template>` names a template the page doesn't declare, the runtime
  loads `components/<name>/<name>.html`, links the stylesheets and imports the
  behavior modules it declares ([01](01-templates.md#component-folder)), then renders.
  The template is added to the page, so every later use renders immediately.
- Each component loads once, however many elements use it. Stylesheets finish
  loading and behavior modules finish importing before the first render.
- A template already in the page (inline, or shipped by the build) is used as is; the
  build declares that component's assets itself.
- `components` is a function `(name) => Promise<{ url, html } | undefined>`;
  `componentFolder(base)` is the default implementation. Without it, only templates
  declared in the page render, and an unknown name is reported as an error.
- A missing file (404) is an unknown template. A failing stylesheet or behavior module
  is reported, and the component still renders.

## TypeScript action roles

The helper contracts use separate `RequestOptions`, `QueryOptions` and
`WriteOptions` interfaces. Provider/mutation interfaces explicitly forbid opposing
role fields with `never`, including objects stored in intermediate variables.
GET providers forbid `send`; QUERY providers allow an encoder. Public method
types are derived from `HttpMethod`: providers accept GET/QUERY and mutations
accept standard write methods (default POST). Use the extensible `action()` helper
for other HTTP extension methods.

`ProviderAction` and `MutationAction` retain their exact role in `.options.kind`;
`NormalizedActionOptions` is the discriminated union used by execution. Providers
run the query/cache path, mutations run the write path, and baseline actions use
their method. Native JavaScript callers still receive boundary validation.
