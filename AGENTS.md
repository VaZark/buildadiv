# AGENTS.md

A browser-based visual editor for building websites from plain HTML, CSS and JavaScript. It combines a component library viewer (like Storybook), a visual canvas (like GrapesJS) and a synced code/design view (like Dreamweaver). In v2, external agents can port React and Vue components into the format over MCP. That port is one-way.

> Status: idea stage. This file is the working spec. Update it when decisions change.

The project has **two parts**:

| Part | What it is | Composition | When it runs | Shipped as |
|---|---|---|---|---|
| **1. Runtime library** | Purely client-side rendering: templates, bindings, `<render-template>`, actions, tags and cache | `<render-template>` | In the browser | A standalone library anyone can drop into a page |
| **2. Builder & editor** | Parses existing HTML files and builds them with an Astro-style component renderer, with a visual editor on top | Component tags | At build time and in the editor | The browser-based editor and its build |

- **Part 1 stands alone.** It needs no build step and no editor: include the library, write templates and actions, done. It must never depend on part 2.
- **Part 2 builds on part 1.** It turns plain HTML files into component-based sites and outputs static HTML that uses the runtime library for its live regions.
- Component tags never reach the browser: the build expands them into static HTML. `<render-template>` is the only thing the runtime understands.

---

## Principles

1. **The web platform is the source of truth.** Output is HTML, CSS and JS. No framework runtime ships to users.
2. **Ports are one-way.** React/Vue → vanilla. We never export back to a framework.
3. **Structure is readable and testable without data.** Every component renders meaningfully from its preview content alone.
4. **Browser-only.** The editor runs entirely in the browser. No Electron, no Tauri, no desktop bindings, no required local server.
5. **Small over clever.** Prefer a few obvious conventions to a framework. If a feature starts turning the binder into a framework, stop and discuss it.
6. **Know the target.** Mostly static sites, plus light SPAs that are mostly static (dashboards, charts). Full web apps are not the target.
7. **Client-side runtime.** Backends already have their own templating, partials and server rendering. The runtime brings that logic to the front end; it does not render on a server or integrate with server template engines. Static pre-rendering happens only in our own build, through component tags.
8. **Every behavior is a function, with a default.** Wherever an action needs a behavior (decoding, encoding, finding items, merging pages, storage), it accepts a plain function. The runtime provides a sensible default function, and nothing is looked up by string name.

---

## Component format

A component is a folder:

```
components/product-card/
  product-card.html     # <template> defining structure
  product-card.css      # scoped styles
  product-card.js       # local behavior (optional)
  product-card.fixtures.json  # named sample-data variants (optional)
```

### Template

```html
<template data-component="product-card">
  <article class="card">
    <h3><slot name="title">Product name</slot></h3>
    <p class="price" data-bind="price | currency:EUR">€0.00</p>
    <img data-bind-src="image_url" data-bind-alt="image_alt" src="placeholder.png" alt="Product photo">
    <slot>Optional description.</slot>
  </article>
</template>
```

- `<template data-component="name">` declares a component. The name must match the folder.
- `<template>` declares structure. It is not a separate templating language, and its only logic is simple truthiness checks (see Conditionals). It renders only the data it's given.
- **Every slot and binding has preview content.** That content is what the editor and tests show when there's no data.

### Slots

- `<slot name="x">` holds named content. A bare `<slot>` holds default content.
- We do **not** use shadow DOM, so native slotting doesn't apply. `<render-template>` fills slots itself.

### Bindings

Binding is **split by role**:

| Syntax | Filled | By | Where |
|---|---|---|---|
| `{{ value }}` | At build time | Part 2's build (or a backend's own templating, which handles it locally) | Pages and component tags, **outside** `<template>` |
| `data-bind`, `data-bind-<attr>` | At runtime | Part 1's `<render-template>` | Inside `<template>` |

- The build **skips the contents of `<template>`**, so it never touches runtime bindings, and the runtime never sees `{{ }}`.
- Part 1 needs no build: everything it understands is a `data-*` attribute.

**Runtime bindings:**

- `data-bind="path"` sets the element's text.
- `data-bind-<attr>="path"` sets an attribute, e.g. `data-bind-src`, `data-bind-href`, `data-bind-alt`.
- **Bindings always insert text, never HTML.** Text goes through `textContent`, never `innerHTML`. Templates only ever receive plain data, so markup in a value is shown as text.
- **URL attributes are sanitized.** `href`, `src` and similar never accept `javascript:` URLs.
- Paths use dots: `product.name`, `title.en`. Objects are just objects. Keyed data like `{ "en": …, "fr": … }` is addressed by key with ordinary bindings, not iterated.
- An array of primitives binds the item itself: `data-bind="tag"` where `tag` is the item name.

### Filters

Both sides share **one filter syntax and one set of filter functions**: a value, then a pipeline of filters.

```html
<!-- build time (part 2) -->
<h1>{{ site.title | upper }}</h1>

<!-- runtime (part 1): the same filters, inside the attribute value -->
<p data-bind="price | currency:EUR | fallback:'—'">€0.00</p>
<a data-bind-href="product.url | fallback:'#'">View</a>
```

- **Syntax:** `path | filter | filter:arg | filter:arg1:arg2`. Filters run left to right.
- **No collisions with backends.** At runtime the pipeline lives inside a `data-*` attribute value, which no server template engine parses.
- **Works for attributes too**, so `data-bind-href` gets formatting and fallbacks with no extra attributes.
- **Filters are single-value transforms only**: format, fallback, upper, truncate, … No expressions, comparisons or conditions. Those belong in the action's `context`.
- **Each filter is a plain function** (principle 8). A page ships only the filters it uses, and parsing the pipeline is a few dozen lines, so the runtime stays small. The builder uses the same functions at build time.

**Only `fallback` ships by default.** Every other filter is **opt-in**: the developer imports it and registers it in the client runtime, so nothing unused is shipped.

```js
import { configure } from '../runtime/index.js';
import { currency, number, upper } from '../runtime/filters.js';
import { slugify } from './my-filters.js';   // a project's own filter is just a function

configure({ filters: { currency, number, upper, slugify } });
```

- **Always available:** `fallback:'text'`, used when the value is missing or null.
- **Provided, opt-in:** `Intl`-based formats (`currency:EUR`, `number`, `percent`, `date:long`, `relative-time`, with the locale from `<html lang>`) and small text helpers (`upper`, `lower`, `truncate:40`).
- **Custom filters** are registered the same way. The key is the name used in HTML, since HTML can only hold strings.
- Using a filter that isn't registered is an error the editor and linter flag, not a silent no-op.

**Missing values:** with no `fallback` filter, a missing or null value is **skipped** and the element renders empty. Preview content is never shown to real users as a stand-in for missing data; it exists for the editor and tests.

```html
<h3 data-bind="title.fr | fallback:'Sans titre'">Product name</h3>
```

**Updating a few words in a line:** wrap just those words in an element that carries the binding. A `<span>` is the usual choice:

```html
<p>Hello <span data-bind="user.firstName">there</span>, you have
   <span data-bind="cart.count | number">0</span> items in your cart.</p>
```

### Lists

A component that renders a list declares it on its template, and names the item and index. Item components stay agnostic and never assume they'll be repeated.

```html
<template data-component="product-rows"
          data-accepts="array" data-item="product" data-index="i" data-key="id">
  <li>
    <span data-bind="i">1</span>
    <span data-bind="product.name">Product name</span>
  </li>
</template>
```

- `data-accepts="array"`: the template is stamped once per item.
- `data-item`: the name used to bind the current item.
- `data-index`: the name used to bind the position.
- `data-key`: the field that holds each item's stable id, **relative to the item** (`data-key="id"`, not `product.id`). It's evaluated exactly the way a tag's `key` is, so the two always match. Live updates change items in place instead of re-rendering the list.
- The runtime writes each item's key onto its root element, so event handlers can find it with `event.target.closest('[data-key]')`.

**Nested lists, grouped data and tables** are templates inside templates. Inner names must differ from outer ones:

```html
<template data-component="category-list"
          data-accepts="array" data-item="category" data-index="i" data-key="id">
  <section>
    <h2 data-bind="category.name">Category</h2>
    <ul>
      <template data-accepts="array" data-from="category.products"
                data-item="product" data-index="j" data-key="id">
        <li data-bind="product.name">Product name</li>
      </template>
    </ul>
  </section>
</template>
```

`data-from="path"` points an inner template at the array (or object) it reads from, relative to the enclosing item.

### Conditionals: `data-if` and `data-if-not`

Templates can show or hide an element based on **truthiness of paths**, and nothing more.

```html
<p data-if="product.inStock">In stock</p>
<p data-if-not="product.inStock">Sold out</p>

<!-- several paths: all must pass -->
<button data-if="context.hasMore context.loggedIn">Load more</button>
<span data-if="product.onSale" data-if-not="product.soldOut">Sale!</span>
```

- `data-if="a b c"`: shown only if **every** listed path is truthy.
- `data-if-not="a b c"`: shown only if **every** listed path is falsy.
- Both on one element: both must pass.
- Paths are space-separated in one attribute, because HTML doesn't allow the same attribute twice on an element (the parser keeps the first and drops the rest).
- Falsy: `false`, `null`, missing, `0`, `""` and **empty arrays**. So `data-if="products"` covers "the list is empty" without a comparison.
- **There is no `data-else`.** It implies a hidden link to a previous sibling. Write the opposite condition explicitly with `data-if-not`.
- **Not allowed:** expressions, comparisons (`>`, `==`), OR, or function calls. Anything beyond "all of these truthy / all of these falsy" is computed in the action's `context` function (see Actions) and exposed as a plain boolean on `context`.
- Every branch must be reachable by flipping a value in a fixture, so the editor can preview each one.
- **Failing a condition hides the element with `display: none`.** It stays in the DOM, so listeners and structure are unchanged when it reappears. The runtime (via `<render-template>`) applies it.

### Runtime composition: `<render-template>`

At runtime, every component, with or without data, is placed with `<render-template>`. (For build-time composition, see **Component tags** below.)

```html
<!-- a component with no data: name the template, fill its slots -->
<render-template template="product-card">
  <span slot="title">Wool scarf</span>
  <p>Hand-knitted, one size.</p>
</render-template>

<!-- a component fed by an action -->
<render-template load-from-action="loadProducts" on-success="product-rows"></render-template>
```

- `template="name"` renders that component directly. Child elements fill its slots: `slot="name"` for named slots, everything else for the default slot.
- `load-from-action="fn"` loads data from an action once; `subscribe-to-action="fn"` also keeps it up to date. Either renders the template named for the current state (`on-success`, …; see Rendering).
- At runtime, one element covers static placement, data placement and nesting.

### Fixtures

`*.fixtures.json` maps variant names to data, in the same shape the component receives at runtime (nested objects and arrays included):

```json
{
  "long-title": { "title": "An extremely long product name that wraps", "price": 1299 },
  "missing-french": { "title": { "en": "Scarf" } }
}
```

The editor uses fixtures as stories. Fixtures never ship in build output.

---

## Component tags (part 2: builder & editor)

**Starting point: existing HTML.** The builder parses ordinary HTML files as they are, so an existing static site can be brought in without rewriting it. In v1 it takes pages as they are; suggesting or generating components automatically is left to opt-in agents over MCP (v2+). Pages then compose components with plain tags, in the style of Astro or Django Cotton:

```html
<!-- pages/shop.html -->
<site-header></site-header>

<product-card>
  <span slot="title">Wool scarf</span>
  <p>Hand-knitted, one size.</p>
</product-card>

<render-template load-from-action="loadProducts" on-success="product-rows"></render-template>
```

- The tag name is the component name. Names must contain a hyphen, so they never collide with native elements. No project prefix: pages are owned by the site owner.
- Named slot content uses `slot="name"`. Everything else fills the default slot.
- **The build expands component tags into static HTML.** They never reach the browser, so static content works without JS and is fully visible to search engines.
- `<render-template>` elements inside a page pass through untouched and render in the browser. That's how a static page gets live, data-driven regions.
- Component tags and `<render-template template="…">` use the same component folders; the difference is only *when* they're rendered.

---

## Actions: `api/`

All fetching and mutation lives in `api/` as **plain, readable, named functions**. An action is an HTTP request: GET, POST, PUT, DELETE, and so on. (WebSockets are not supported for now.) We're building a templating layer, not an HTMX clone: actions are ordinary JS functions that work in plain HTML and can also be called from HTMX or any other tooling.

Responsibilities are split four ways:

- **The action function** fetches and mutates data, and hands **plain objects** to the template layer. It knows nothing about templates or where anything appears on the page.
- **`<render-template>`** marks *where* an action's result renders and *which template* renders for each state (pending, success, no content, error). See Rendering.
- **The template** only knows the shape of the data it renders: structure, slots and `data-if` / `data-if-not` checks.
- **The invoking element** (`data-action`) only says *which function to call*.

```js
// api/products.js
import { provider, mutation } from '../runtime/action.js';

export const loadProducts = provider({
  url: '/api/products',
});

export const addToCart = mutation({
  method: 'POST',
  url: '/api/cart',
});
```

- `action()` is the **baseline**, available to everybody: a thin helper that returns an ordinary async function and accepts every option. Hand-written functions with the same signature are equally valid.
- An action moves through four states: `pending`, `success`, `no-content` and `error`. Which template shows for each is decided by `<render-template>`, not the action.
- `no-content` is about the **response**, not the data: it fires on a 204 or an empty body. There's no special case for empty arrays; an empty array is a normal `success` and a list simply renders zero items.

### Providers and mutations

Two thin layers on top of `action()` cover almost every case:

| Helper | HTTP methods | What it's for | Options it adds or allows |
|---|---|---|---|
| `provider()` | `GET`, `QUERY` | Reading data | `provides`, `items`, `sort`, `paginated`, `refetchAfter`, `keepUnusedFor`, `persist`, and `send` for `QUERY` bodies |
| `mutation()` | everything else: `POST`, `PUT`, `PATCH`, `DELETE`, … | Changing data | `invalidates`, `reconciles`, `send` |

- `provider()` defaults to `GET`; `mutation()` defaults to `POST`.
- `QUERY` is the HTTP method for safe, read-only requests that carry a body (e.g. a complex search), standardized as RFC 10008. It belongs with providers because it reads, never changes.
- Options that don't fit the role are rejected: a provider can't `invalidates`, a mutation can't `provides`.
- Both return the same kind of function as `action()`, so `data-action`, `<render-template>` and events treat them identically.
- `action()` stays available for anything that doesn't fit either role.

### Linting templates against actions (v1.1)

Actions **don't declare a schema in our format**. Linting has two halves:

1. **Template side (ours).** The system scans every template and builds a rough usage case from it: every `data-bind`, `data-bind-<attr>`, `data-if` / `data-if-not` and list path it reads. That's the template's set of required fields. From it we can **generate an expected type**, e.g. a TypeScript type for each template.
2. **Action side (TypeScript's).** The developer types what the action returns, `{ response, context }` (see Context), with TypeScript or a schema library that produces TypeScript types. TypeScript then does the comparison: for every `<render-template>`, the action's return type must satisfy the generated type of each template it maps to.

- **Lint hooks**, loaded only while linting, do the work:
  1. Generate the shape of every template.
  2. For each `<render-template load-from-action="…">` or `subscribe-to-action="…"`, take the action's return type. It may be a union of several types (e.g. `void`, a success type, a failure type).
  3. Check that **every template the element registers** (`on-pending`, `on-success`, `on-no-content`, `on-error`) is satisfied by **at least one** of those return types.
- The `context` function itself is not tested. Only the action's `{ response, context }` return types are checked against the templates.
- This is engineering and demo tooling, not part of the runtime. The required fields also let the editor generate fixtures.
- **Not a blocker for 1.0.** Planned for v1.1 (or v2).

### Behavior functions

Following principle 8, every behavior an action can customize is a function, and the runtime exports a default for each:

| Option | Signature | Default |
|---|---|---|
| `items` | `(response) => array of objects` | the response itself (assumed to be an array of objects) |
| `merge` | `(cached, page) => merged` | concatenates (infinite) or replaces (pages) |
| `sort` | `(a, b) => number`, applied after each upsert | `null` (no sorting; new items go at the end) |
| `context` | `(response, status, args) => object` (extra fields) | no extra fields; built-in context only |
| `send` | `(body) => { body, headers }` | `multipart` for forms |
| `accepts` | `(response: Response) => Promise<data>` | `json` |
| `persist` | store object `{ get, set, remove }` | `false` (no persistence) |

Defaults are exported functions (`json`, `text`, `multipart`, `urlencoded`, `localStore()`, …), so a project imports only what it uses and a bundler tree-shakes the rest.

### Invoking actions

```html
<button data-action="loadCart">Refresh cart</button>
<form data-action="addToCart">…</form>
```

- `data-action` names the function. That's all the element knows.
- The event defaults to `click`, or `submit` on forms. `data-on="…"` overrides it when needed (e.g. `load`, `change`).
- Because actions are plain functions, `onclick="loadCart()"` or an HTMX hook calling the same function works too.

**Arguments.** Actions ideally take no arguments. `data-action` never passes any (a form passes its own fields as the body). When an action does need arguments, call it as a **regular JS function** from an ordinary event handler:

```html
<button onclick="deleteProduct({ id: this.closest('[data-key]').dataset.key })">Delete</button>
```

Anything else an action needs (a URL parameter, a filter value) is read by the action itself in its own logic, or passed by whatever JS event handler calls it. There is no `data-args` attribute.

### Context: what templates actually see

Every template rendered from an action receives **one object with two parts**:

```js
{
  response,   // the decoded response data (null when there isn't one, e.g. pending or error)
  context,    // built-in information + any fields the action adds
}
```

**Built-in `context` fields**, always present in every state:

| Field | Meaning |
|---|---|
| `context.pending` | `true` while the request is in flight |
| `context.success` | `true` after a successful response |
| `context.noContent` | `true` after a 204 or empty body |
| `context.error` | `true` after a failed request (network or HTTP 400+) |
| `context.statusCode` | the HTTP status code, when there is one |
| `context.nextPage` | for paginated actions: the next page param, or `null` |

There's no separate state object: the state is already covered by these fields.

**Additional fields** come from the action's optional `context` function. It receives the raw outcome of the request and returns extra fields, which are merged into `context`:

```js
export const loadProducts = provider({
  url: '/api/products',
  context: (response, status, args) => ({
    hasMore: response.page < response.pages,
    isFiltered: Boolean(args?.category),
  }),
});
```

```html
<p data-bind="response.total">0</p>
<span data-if="context.isFiltered">Filtered</span>
```

- The runtime doesn't interpret the response for you. The `context` function does, in plain JS.
- **This is where logic goes.** Derived values, comparisons and OR conditions become plain fields on `context` (`hasMore`, `isOnSale`), which templates test with `data-if`.
- Built-in field names are reserved; the `context` function can't override them.
- Because `context` always exists, `on-pending` and `on-error` templates have something defined to read even when `response` is `null`.
- Fixtures mirror the same `{ response, context }` object.
- **Lists at the top level** read from `response` by default (when it's an array). `data-from` points them elsewhere, e.g. `data-from="response.results"` or `data-from="context.products"`.

### Rendering: `<render-template>`

A custom element marks where a component or an action's data appears on the page:

```html
<render-template
  subscribe-to-action="loadProducts"
  on-pending="product-skeleton"
  on-success="product-rows"
  on-no-content="no-products"
  on-error="error-message">
</render-template>
```

- **Two ways to get data from an action:**
  - **`load-from-action="fn"`: load and forget.** The runtime calls the action once and renders the result. The element doesn't subscribe to tags, so invalidation and `refetchAfter` never refresh it.
  - **`subscribe-to-action="fn"`: stay up to date.** The element subscribes to the action's tags. Invalidation, reconciliation, `refetchAfter` and pagination all keep it current.
- The element stays in the page either way.
- **`on-pending`, `on-success`, `on-no-content`, `on-error`.** The template to render for each state. **A state with no template does nothing**: there are no system defaults and no assumptions, and the element keeps whatever it currently shows.
- **`template="name"`.** Renders a component directly, with no action. Children fill its slots. (See Composition.)
- The action provides the data (and builds the `context`); the element decides placement and templates. Two `<render-template>` elements using the same action can render it with different templates, e.g. a full list in one place and a count badge in another.
- Subscriptions and refreshes come from the tag system (see Tags). The element only has to render in time when its action's data changes.
- `<render-template>` applies text bindings, attribute bindings and `data-if` hiding to what it renders.
- Any number of `<render-template>` elements can share an action. Every one of them receives its results.
- **Mounting:** only a `<render-template subscribe-to-action="…">` registers its action's tags in the tag registry and counts as a subscriber for the cache. Removing it unregisters them. That's what "mounted" means for invalidation.
- Actions don't take an `into` target. The element replaces it.
- It's a plain custom element: no shadow DOM, no framework.

### Pagination

Two distinct kinds, because they invalidate differently. Both follow existing practice (RTK Query's infinite queries, TanStack's `useInfiniteQuery`).

```js
export const loadProducts = provider({
  url: (page) => `/api/products?page=${page}`,
  paginated: {
    mode: 'infinite',                     // 'pages' | 'infinite'
    firstPage: 1,
    nextPage: (response, page) => (response.page < response.pages ? page + 1 : null),
    refreshBehind: 1,                     // infinite only: older pages refreshed with the current one
  },
});
```

```html
<!-- page -->
<render-template subscribe-to-action="loadProducts" on-success="product-list"></render-template>

<!-- components/product-list/product-list.html -->
<template data-component="product-list">
  <ul><!-- product rows --></ul>
  <button data-action="loadProducts" data-if="context.nextPage">Load more</button>
</template>
```

**Common to both:**

- **`nextPage`** is a function, so the page param is whatever the project's API uses: a page number, a cursor string, an offset. It returns `null`, `undefined` or `false` when there's nothing left. Its current value is exposed as `context.nextPage`.
- A `data-action` pointing at a paginated action loads the **next** page on each click. The template's `data-if="context.nextPage"` hides the button when it's falsy.
- The button has to live inside a template rendered by that action, so its `data-if` can see `context.nextPage`.
- Pages are combined with the `merge` behavior function. The default assumes each page is an array of objects. The merged result becomes `response`, and the `context` function runs on it.
- New items keep their tags, so invalidation and reconciliation work across pages.

**`mode: 'pages'`: regular pagination.** One page is shown at a time; loading another replaces it.

- **On invalidation, only the current page is refetched.** Other pages aren't kept, so there's nothing else to refresh.

**`mode: 'infinite'`: infinite scroll / load more.** Pages accumulate and the list grows.

- **On invalidation:**
  1. The runtime determines the **current page**: the one in view.
  2. It refetches the current page and the `refreshBehind` pages just before it (default `1`). If the current page is the first, it simply refreshes it.
  3. Pages **after** the current one are never refetched.
  4. All other older pages are **marked invalidated**, not refetched yet.
  5. An `IntersectionObserver` is activated. As the user scrolls up, each invalidated page is refetched before it comes into view, always staying `refreshBehind` pages ahead.
  6. The observer is removed once the top is reached and every page is fresh, or when the whole page reloads.

### Request and response formats

Encoding and decoding happen **in the action layer only**. Templates only ever see plain decoded data.

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

- **`send`** encodes the request body. Forms default to `multipart` (handles file uploads, and it's what forms naturally produce). `json` converts the form or args to JSON instead.
- **`accepts`** decodes the response. Default `json`. Only `json` and `text` are built in; JSON is the assumed default everywhere.
- Any other format (MessagePack, protobuf for gRPC-web, …) is a **convention, not a built-in**: pass a function with the decoder interface, `(response: Response) => Promise<data>`. The user brings the library.

```js
import { decode } from './vendor/msgpack.js';

export const loadReadings = provider({
  url: '/api/readings',
  accepts: async (res) => decode(new Uint8Array(await res.arrayBuffer())),
});
```

- `send` and `accepts` are never visible in HTML or to templates.
- An API that returns `[]` instead of 204 for "nothing here" is the API's choice. It renders as a normal success with zero items, and that's expected.

### Tags: caching, invalidation and reconciliation

Inspired by RTK Query and TanStack Query, but **not copied one-to-one**. Tags live only in the action layer. Templates never see them.

#### Two-level tags: global and per-item

A list can hold hundreds of items, so a flat tag per item gets too big. Instead, a query provides **one global tag plus a key** that identifies each item under it:

```js
// api/products.js
export const loadProducts = provider({
  url: '/api/products',
  provides: { tag: 'Product', key: 'id' },  // global tag "Product", one entry per item id
  items: (response) => response.results,    // only needed when the response isn't an array of objects
});
```

- The `key` is evaluated exactly like the list template's `data-key`, so a tag entry and its rendered element always line up.
- **Tags work on the API side, on the raw response.** Tags manage state; `context` only carries extra information to templates. They don't overlap.
- Tags find their items with the `items` behavior function. The default assumes the response is already an array of objects.

#### The tag registry

The runtime keeps one compact object of the tags currently in use:

```js
{
  Product: { queries: ['loadProducts'], ids: Set { 1, 2, 42 } },
}
```

- An entry is **added** when a query renders and **removed** when its tag is invalidated or its rendered region goes away.
- **"Is this data still mounted?" is a lookup in the registry.** If the tag (or tag + id) is there, it's in use.
- The registry sits on top of the cache described in **Cache lifetime and persistence** below.

#### Cache lifetime and persistence

Follows what RTK Query and TanStack Query do rather than inventing something new:

- **In memory by default.** Cached data is keyed by action name plus its serialized args, so every `<render-template>` using the same action and args shares one copy.
- **Reference-counted.** Each mounted `<render-template subscribe-to-action>` counts as a subscriber. When the count drops to zero, a timer of `keepUnusedFor` seconds starts; if nothing subscribes again before it ends, the data is dropped from memory.
  - **Default: `respectCacheOr(Infinity)`.** Unused data is kept as long as its HTTP caching headers say it's fresh, and for the life of the page if there are none (see Sentinel values). Set a number to free memory sooner.

**`refetchAfter` vs `keepUnusedFor`.** They look similar but answer different questions, the same split as TanStack's `staleTime` vs `gcTime`:

| Option | Question | Applies to | Default |
|---|---|---|---|
| `refetchAfter` | How old can data get before it's fetched again? | Data in use | `respectCacheOr(Infinity)` |
| `keepUnusedFor` | How long is data nobody is using kept in memory? | Data not in use | `respectCacheOr(Infinity)` |

Once `keepUnusedFor` drops data, a region that remounts refetches it, even if nothing was invalidated. With both at `Infinity`, the only triggers are invalidation and page reload.

**Accepted values.** Besides a number of seconds, both options take:

| Value | `refetchAfter` | `keepUnusedFor` |
|---|---|---|
| `Infinity` | never refetch on age; only invalidation or reload | keep unused data for the life of the page |
| `respectCacheOr(fallback)` | refetch when the response's HTTP freshness runs out; `fallback` without headers | drop unused data when its HTTP freshness runs out; `fallback` without headers |

- **The library default for both options is `respectCacheOr(Infinity)`.** The server already knows how fresh its data is, so it decides; without caching headers, nothing expires on age (refetch only on invalidation or reload).
- It follows the response's own HTTP caching headers: `Cache-Control: max-age`, `Expires`, `no-cache` (always refetch on use) and `no-store` (never keep).
- **`respectCacheOr` is the only form.** There's no separate bare `respectCache`: the default lives in the library, and passing `respectCacheOr(300)` is simply an override meaning "follow the headers; without them, 300 seconds".

```js
import { respectCacheOr } from '../runtime/cache.js';

// library default, no need to write it: respectCacheOr(Infinity)
refetchAfter: respectCacheOr(300)     // override: follow headers; without them, 300 seconds
```

- `respectCacheOr` is exported from `runtime/cache.js`, not a string, following principle 8. A named function is used instead of a tuple (`[cache, 300]`), so the fallback's meaning is in the name.

**Persistence** is opt-in, chosen globally with per-action overrides:

```js
import { localStore, sessionStore, indexedDbStore } from '../runtime/stores.js';

// runtime config (global default)
configure({ persist: sessionStore() });

// per action
export const loadCatalog = provider({ /* … */ persist: indexedDbStore() });
export const loadCart    = provider({ /* … */ persist: localStore() });
export const loadSearch  = provider({ /* … */ persist: false });
```

- `persist` takes a **store object, never a string**. Default `false` (no persistence).
- Built-in stores are plain exported functions: `localStore()`, `sessionStore()`, `indexedDbStore()`. Because they're imported explicitly, a bundler can tree-shake the ones a project never uses, and projects can wrap or modify them freely.
- Any other store follows the same **convention, not a plugin**: an object with `{ get(key), set(key, value), remove(key) }`, returning promises.
- `maxAge`: persisted entries older than this are discarded on restore. Default 24 hours, as in TanStack.
- `buster`: a version string. Changing it discards every persisted entry (useful after a deploy that changes data shapes).

#### One shape for tags: `{ tag, key }`

Providing, invalidating and reconciling all describe tags the same way:

- **`tag`**: the global tag, i.e. the type (`'Product'`, `'ProductDetail'`, …).
- **`key`**: the path to the id. Where it's read from depends on the option:
  - in `provides`, relative to each item (same as `data-key`): `'id'`
  - in `invalidates` and `reconciles`, relative to the **mutation's response body**: `'id'`, `'resource.id'`, `'results.0.id'`, …

#### Invalidation

```js
// everything tagged Product: every query providing it is cleared
export const importProducts = mutation({
  method: 'POST',
  url: '/api/products/import',
  invalidates: 'Product',
});

// several tags at once
export const checkout = mutation({
  method: 'POST',
  url: '/api/checkout',
  invalidates: ['Cart', 'Order'],
});

// one item: the id is read from the response
export const archiveProduct = mutation({
  method: 'POST',
  url: (args) => `/api/products/${args.id}/archive`,
  invalidates: { tag: 'Product', key: 'resource.id' },
});

// one item, when the response has no body (e.g. DELETE → 204): the id comes from a function
export const deleteProduct = mutation({
  method: 'DELETE',
  url: (args) => `/api/products/${args.id}`,
  invalidates: { tag: 'Product', id: (args) => args.id },
});
```

- **A string** (or an array of strings) clears the whole tag: every query providing it, across all actions.
- **`{ tag, key }`** targets one item, with its id read from the mutation's response.
- **`{ tag, id }`** targets one item when the response can't carry the id. `id` is a function, following principle 8.
- If the id can't be found, the runtime falls back to clearing the whole tag.
- Queries that provided the tag refetch if they're still mounted. Updates are applied per `data-key`, so only changed items re-render.
- Paginated queries refetch according to their mode (see Pagination).
- Data that isn't mounted is never fetched.
- By default the current content stays until fresh data arrives. `onInvalidate: 'pending'` on a query makes its `<render-template>` elements show their `on-pending` template during the refetch instead.

#### Reconciliation (upsert)

A mutation can **reconcile** instead of invalidate: the response is upserted into the cache with no refetch. It uses the same `{ tag, key }` shape, so the runtime knows exactly **what** to upsert and **which id** to match:

```js
export const renameProduct = mutation({
  method: 'PUT',
  url: (args) => `/api/products/${args.id}`,
  reconciles: { tag: 'Product', key: 'id' },            // the body itself is the item
});

export const createProduct = mutation({
  method: 'POST',
  url: '/api/products',
  reconciles: { tag: 'Product', key: 'resource.id' },   // the item is body.resource
});
```

- **The item to upsert is the object that holds the key.** With `key: 'id'` it's the whole body; with `key: 'resource.id'` it's `body.resource`.
- **Contract:** that item has the same shape as the items the tag provides elsewhere (or at least a shape that satisfies the templates rendering them).
- `reconciles` always needs the `key`. A bare string isn't enough, because the runtime wouldn't know where the id or the item is.

1. The request goes out. If the target id is known (an update), that item is **marked** for reconciliation.
2. **Response received:** the runtime reads the id at `key` and looks it up under the global tag in the registry.
   - **Id exists:** the item replaces the matching one in the **cached response**.
   - **Id is new:** the item is inserted into the cached response of every mounted query that provides the tag, and its id is added to the registry. It lands **at the end** of the list.
   - **Sorting:** a provider can set a `sort` function, a normal comparator `(a, b) => number`, applied after each upsert. Default `null`: no sorting, new items stay at the end. The function decides how to handle ids or fields that aren't numbers.
   - Changing the cached response **automatically re-runs that query's `context` function**, so the template re-renders with the same derived fields as every other item. Only the affected item re-renders, matched by `data-key`.
   - Either way, nothing refetches.
3. **Reconcile failure:** the mutation succeeded, but there's nothing to upsert with: the key path doesn't exist in the response, the id is missing, or the item's shape is wrong. There is no option for this: it **falls back to invalidating the whole tag**, so mounted queries refetch.
4. **Mutation failure** (the request itself failed): nothing changes, since nothing was applied optimistically. The `error` event fires.

No optimistic updates: the UI only changes once the server has answered.

### Freshness and refetch failure

```js
export const loadProducts = provider({
  // …
  refetchAfter: 300,              // seconds, Infinity, or respectCacheOr(x); default respectCacheOr(Infinity)
  onRefetchFailure: 'keep',       // 'keep' | 'throw'
  timeout: 10,                    // seconds; default none
});
```

- **`refetchAfter`** (seconds). After this long, mounted data refetches. Cached data that isn't mounted is refetched the next time something uses it.
  - **Default: `respectCacheOr(Infinity)`.** Data refetches when its HTTP caching headers say it's stale, and whenever one of its tags is invalidated. Without headers, only invalidation or reload refetch it.
- **`onRefetchFailure`** decides what happens when a *refetch* fails (not the first load):
  - `'keep'`: keep showing the old data. **Default.**
  - `'throw'`: render the element's `on-error` template.
- **`timeout`**: when exceeded, the `timeout` event fires and the request ends in the `error` state. **Default: none.** We don't override `fetch`'s own behavior; an action only times out if it sets `timeout`.

### Events

Actions and `<render-template>` elements emit DOM events so other code can react (notifications, spinners, analytics, closing a modal) without the action knowing about it.

**Naming follows two rules:**

- **States use the same names as `<render-template>`'s attributes**: `on-success` ↔ `success`, `on-error` ↔ `error`, and so on.
- **Lifecycle timing follows htmx 4's convention** of colon-separated `before:` / `after:` / `finally:` segments (`htmx:before:request`, `htmx:after:swap`, …), so anyone who knows htmx reads them instantly.

**Name:** `functionName:event`. No HTTP method prefix: action names are unique, so the function name alone identifies the action.

| Event | Fires when |
|---|---|
| `before:request` | Just before `fetch()` is called |
| `pending` | The action enters the pending state |
| `after:request` | The response has been read and decoded |
| `success` | The action enters the success state |
| `no-content` | The action enters the no-content state (204 or empty body) |
| `error` | The request failed: network error or HTTP status 400+ |
| `timeout` | The action's `timeout` elapsed |
| `finally:request` | The request lifecycle ended, whatever the outcome |
| `before:render` | A `<render-template>` is about to update the DOM |
| `after:render` | A `<render-template>` has updated the DOM |

```js
document.addEventListener('createProduct:success', () => showToast('Product created'));
document.addEventListener('createProduct:error', () => showToast('Could not create product'));
```

- Success and error share the same `functionName` prefix. Only the last segment differs.
- Action names must be unique across the project.
- **Invalidation:** one `invalidate:Type` event per invalidated tag (e.g. `invalidate:Product`), with the item id in the event detail when there is one. The tag system itself runs on these events.
- **User-defined:** `event: 'product-created'` on an action replaces the `functionName` prefix, so you get `product-created:success` and so on.
- Events are `CustomEvent`s dispatched on `document`. The detail carries `{ action, method, args, event, result | error, tags }`, plus `element` for render events.

---

## CSS

- **Scoped:** `component.css` is scoped by **attribute**, not by hashing. The build prefixes the component's selectors, and the component's elements carry a `data-c="product-card"` attribute (added by the build for component tags, and by `<render-template>` at runtime): `.card` → `.card[data-c="product-card"]`. Class names stay exactly as written, so hand-written markup needs no name mapping.
- **Global:** `styles/global/` holds tokens (custom properties), resets, typography and layout. Use it only for things that are clearly global.

## JavaScript

- **Local:** `component.js` holds behavior for one component. It is bundled and minified for reuse.
- **Data:** all fetching lives in `api/` (see Actions). Component JS never fetches.

---

## Project layout

The repository is split along the two parts, so the runtime library can be published on its own:

```
packages/
  runtime/         # part 1: binder, <render-template>, action / provider / mutation, tags, cache,
                   #         default behavior functions. Published as a standalone library.
  builder/         # part 2: HTML parsing, component tags, build pipeline (browser and CLI)
  editor/          # part 2: the browser editor
```

A site built with it looks like:

```
components/        # one folder per component
pages/             # page HTML files (existing HTML can be dropped in as is)
styles/global/     # tokens, resets, layout
api/               # actions: providers and mutations
```

### Distribution

- **Runtime library:** an ES module, usable from a CDN `<script type="module">` or a package manager. Tree-shakable: projects import only the helpers and default functions they use.
- **Builder & editor:** the browser-based editor, plus a CLI build for CI.

---

## Build output

- **Static HTML pages**, with component tags expanded into their markup.
- `<render-template>` elements left in place, rendered in the browser.
- **Bundled, minified CSS and JS**, including only the runtime pieces and default functions a project actually imports.
- **`<template>` blocks** kept where the browser clones them (lists, action results). Everything else is plain markup.

---

## Editor (browser-only)

- **Library panel:** discovers `<template data-component>` blocks and reads slots, `data-bind` / `data-bind-<attr>` paths, conditionals and list declarations as the component's interface. Renders preview content and fixture variants.
- **States:** the editor can preview each state template a `<render-template>` maps (pending, success, no content, error).
- **Linting (later):** templates are checked against what the action feeding them returns (see Linting templates against actions).
- **Canvas:** composes components into pages visually, using component tags. Every edit writes back to the source files.
- **Importing components:** the editor can load components written in plain HTML/CSS (preferred), or in React, Vue and similar, to view them, compare them side by side and iterate quickly. Framework code runs **only inside the editor's preview**; nothing framework-based ships in build output.
- **Split view:** code and design stay in two-way sync.
- **Preview:** rendered in a sandboxed `<iframe>`.
- **Files:** File System Access API where available (Chromium). Elsewhere, fall back to OPFS plus zip/folder import and export.
- **Build in browser:** WASM tooling (e.g. esbuild-wasm) so no local server is required.

---

## Roadmap

- **v1:** part 1, the runtime library (component format, binder, `<render-template>`, actions, tags and cache), and part 2, the builder (HTML parsing, component tags, build) and the browser editor.
- **v1.1:** the template/action linter (lint hooks + TypeScript). Not a blocker for 1.0.
- **v2:** an MCP server that exposes the project to external agents (see below).

---

## MCP (v2)

There is **no built-in agent**. The project exposes its capabilities over MCP, and any external agent (Claude or others) does the work through it. Everything here is **opt-in** and not a v1 concern.

Planned uses:

- **Generate components from data.** Pass data through (real or fake), let the agent parse its shape, and propose candidate components, fixtures and actions for it.
- **Port React/Vue → vanilla.** Agents read framework code and produce component folders in this format.
- **Suggest components from existing HTML.** Agents look at pages the builder has parsed (e.g. repeated markup) and propose components to extract.

### Porting rules (for agents working through MCP)

- Input: a framework component. Output: a component folder in this format.
- Preserve the interface: props become slots or `data-bind` / `data-bind-<attr>`, and events stay events.
- Move data fetching and loading/error states out of the component and into an `api/` action.
- Add a `PORT_REPORT.md` in the component folder that lists:
  - what ported cleanly
  - what was restructured (e.g. state moved to attributes, hooks replaced)
  - what dependencies were replaced, and with what
  - what needs human review
- Never add a framework dependency to make a port work.

---

## Rules for coding agents working on this repo

- Every slot and binding must have preview content.
- Template logic is limited to `data-if` / `data-if-not` truthiness checks. Anything more goes in the action's `context`.
- Bindings write text or sanitized attributes only. Never `innerHTML`.
- Don't introduce shadow DOM, a virtual DOM, or a framework runtime.
- Don't add server rendering or server template-engine integration.
- Customizable behavior is a function with an exported default, never a string looked up by name.
- Keep component JS free of data fetching. Use `api/`.
- Generated or hand-written code must stay readable enough to maintain by hand.
- If a task needs a new convention, propose it here before implementing it.
- Don't build v2 features (MCP) while v1 is in progress.
- `packages/runtime` must never import from `packages/builder` or `packages/editor`.

---

## Non-goals

- Exporting to React, Vue or any framework.
- Server-side rendering, and integration with server template engines (Django, Blade, Jinja, …). Backends keep their own templating.
- Desktop apps or native bindings.
- A general-purpose reactive framework.
- Full web apps, and polymorphic feeds (mixed item types in one list).
- Virtualized rendering of very large lists (for now).
- Recursive trees and depth guards (for now). Cyclic data is developer error.
- WebSockets (for now).
- Passing action arguments from HTML (`data-args`). Use regular JS event handlers.

## Open questions

- Importing React/Vue components into the editor: v1, or v2 alongside MCP porting? And what "comparison" shows (original vs ported version, variants side by side, both?).
- Linter: how the generated template types are exposed to TypeScript.
- (v2) Where the MCP server runs, given the editor is browser-only with no required local server: a remote MCP endpoint, or an optional local bridge?

## Decisions log

- **Two parts.** Part 1 is a purely client-side runtime library, distributable on its own and never dependent on part 2. Part 2 parses existing HTML files and builds them with an Astro-style component renderer, with the visual editor on top.
- **Client-side only.** No server rendering, no host adapters or partials. Backends keep their own templating. (Replaces `load-on-server`, `{{ }}` bindings and the Django/Blade/PHP adapters.)
- `action()` is the baseline for everyone. Two thin layers sit on it: `provider()` for `GET` / `QUERY` (reading; `provides`, pagination, freshness, persistence) and `mutation()` for every other method (`invalidates`, `reconciles`, `send`).
- Every customizable behavior is a function with a runtime-provided default (`items`, `merge`, `context`, `send`, `accepts`, `persist`). Nothing is looked up by string.
- Binding is split by role: `{{ }}` is build-time only (part 2, outside `<template>`; the build skips template contents). Runtime uses `data-bind` for text and `data-bind-<attr>` for attributes.
- Bindings: Always `textContent`, never HTML; URL attributes sanitized.
- Lists: a list component declares `data-accepts="array"` with `data-item`, `data-index` and `data-key`. Item components stay agnostic. (Replaces `data-each`.)
- `data-key` is relative to the item (`data-key="id"`) and evaluated the same way as a tag's `key`.
- Nested lists, grouped data and tables are templates inside templates. Inner templates use `data-from="path"` to point at their data.
- Keyed objects are bound by path, not iterated.
- **Filters**: one shared pipeline syntax (`value | filter:arg`) and one set of filter functions for build time (`{{ }}`) and runtime (`data-bind`, `data-bind-<attr>`). Only `fallback` ships by default; every other filter (provided `Intl` formats and text helpers, or custom ones) is opt-in, registered with `configure({ filters: { … } })`. Single-value transforms only. (Replaces `data-format` and `data-fallback`.)
- Missing values are skipped unless a `fallback` filter is given.
- To bind a few words inside a line, wrap them in an element (usually a `<span>`) with `data-bind`.
- The binder handles values, slots, lists and `data-if` / `data-if-not` truthiness checks. No `data-else`, no expressions. (Replaces "no conditionals in templates".)
- A failing `data-if` / `data-if-not` hides with `display: none`; the element stays in the DOM.
- Two layers. **Runtime:** `<render-template template="name">` (slot children) and `<render-template load-from-action="fn">` (data), rendered in the browser. **Build & editor:** Astro-style component tags, expanded into static HTML by the build and never shipped to the browser.
- The editor may load React/Vue components for preview and comparison only; build output stays framework-free.
- CSS is scoped by attribute. No build-time hashing.
- State templates live on `<render-template>` as `on-pending`, `on-success`, `on-no-content` and `on-error`. Actions know nothing about templates. (Replaces both `data-state` on templates and the action's `pending` / `success` / `noContent` / `failure` options.)
- Actions don't declare a schema. A later linter derives each template's required fields and generates a type from them; the developer types the action's return with TypeScript, and TypeScript does the comparison. Lint hooks check that every template an element registers is satisfied by at least one of the action's return types, typed as `{ response, context }`. The `context` function itself is not tested. The linter is v1.1, not a 1.0 blocker. (Replaces OpenAPI-style schemas and the `shape` option.)
- No special `empty` state. `no-content` fires on a response with no content (204 or empty body); an empty array is ordinary success.
- Unmapped action states do nothing. No system defaults.
- Elements invoke actions with `data-action="functionName"` (optional `data-on`). The element knows nothing about data. (Replaces HTMX-style `data-source` / `data-target` / `data-swap` attributes.)
- Actions take no arguments from HTML. `data-action` calls with none (forms send their fields); anything needing args is called from a regular JS event handler.
- Templates rendered from an action receive `{ response, context }`. `response` is the decoded data (`null` when there isn't any); `context` always holds built-in fields (`pending`, `success`, `noContent`, `error`, `statusCode`, `nextPage`) plus extra fields from the optional `context(response, status, args)` function. No separate state object.
- Placement lives in HTML via `<render-template load-from-action="fn">` (renamed from `load-on-client`, then `load-on-action`). Actions hand plain objects to templates and don't know where they render. (Replaces the action's `into` option.)
- Pagination has two modes. `pages`: invalidation refetches only the current page. `infinite`: invalidation refetches the current page plus `refreshBehind` older pages, never newer ones, marks the rest invalidated and refreshes them through an `IntersectionObserver` as the user scrolls up. `refreshBehind` defaults to 1. `nextPage` is a function returning any page param (number, cursor, …) or `null` / `undefined` / `false` when done; exposed as `context.nextPage` for `data-if="context.nextPage"`.
- Upserted new items land at the end of the list. An optional `sort` comparator on the provider (default `null`) re-sorts after each upsert.
- Tags are two-level: a global tag plus a per-item key (`provides: { tag, key }`), not RTK's flat list. Tags operate on the raw response via the `items` function; `context` only carries data to templates.
- A tag registry object tracks tags in use. "Mounted" means present in the registry.
- Tags use one shape everywhere: `{ tag, key }`. `tag` is the global type; `key` is the id path (relative to each item in `provides`, relative to the mutation's response in `invalidates` / `reconciles`).
- `invalidates` takes a string or array (clear whole tags across all actions), `{ tag, key }` (one item, id from the response) or `{ tag, id: fn }` (one item, id from args, e.g. DELETE with no body). An id that can't be found clears the whole tag.
- `reconciles` always takes `{ tag, key }`; the item upserted is the object holding the key. If the key or id isn't in the response, the upsert fails and the whole tag is invalidated. No refetch on success.
- No optimistic updates. `onInvalidate: 'pending'` is opt-in.
- Events are `functionName:event`, with no HTTP method prefix; action names are unique. State events reuse `<render-template>`'s names (`pending`, `success`, `no-content`, `error`); lifecycle events follow htmx 4's `before:` / `after:` / `finally:` convention (`before:request`, `after:request`, `finally:request`, `before:render`, `after:render`), plus `timeout` and `invalidate:Type`. (Replaces `pre-request` / `sent` / `received` / `failed` / `timed-out`.)
- `<render-template>` has `load-from-action` (load once, no subscription) and `subscribe-to-action` (subscribes to tags and stays current). Only subscribing elements count as mounted.
- Freshness: `refetchAfter` and `keepUnusedFor` are separate options. Both default to `respectCacheOr(Infinity)` in the library: follow the response's HTTP caching headers (`Cache-Control`, `Expires`), and without them never expire on age. `respectCacheOr(x)` is the only form (no bare `respectCache`); passing it with another fallback is an override. Both options also accept plain seconds or `Infinity`.
- No default `timeout`: `fetch`'s own behavior is not overridden.
- `onRefetchFailure: 'keep' | 'throw'`, default `'keep'`.
- Cache follows RTK Query / TanStack: in memory, keyed by action + args, reference-counted by mounted elements. Persistence is opt-in via store objects (`localStore()`, `sessionStore()`, `indexedDbStore()` or any `{ get, set, remove }` object), globally and per action, with `maxAge` (default 24h) and `buster`.
- Request encoding via `send` and response decoding via `accepts`, both functions (`multipart`, `json`, `urlencoded`, `text` built in; anything else by convention). Templates see decoded data only.
- Target: mostly static sites and light SPAs. Not full web apps.
- WebSockets are out of scope for now.
- No built-in agent. Agent features are exposed over MCP for external agents, opt-in, in v2+. That includes generating components from React/Vue and suggesting components from existing HTML; the v1 builder takes pages as they are.
