# 07 · Decisions

What was decided, grouped by topic, and what each decision replaced. When a decision changes, update the relevant doc and add or edit the row here.

**Contents:** [Scope and architecture](#scope-and-architecture) · [Templates](#templates) · [Rendering and actions](#rendering-and-actions) · [Data layer](#data-layer) · [Builder, editor and tooling](#builder-editor-and-tooling)

---

## Scope and architecture

| Decision | Replaces |
|---|---|
| Two parts: a standalone client-side **runtime library**, and a **builder & editor** that builds on it. The runtime never depends on part 2 | A single editor-centric project |
| Four packages: `shared` (filters, pipeline parser, path resolution, slot rules), `runtime`, `builder`, `editor`. `runtime` and `builder` import `shared` but never each other | Filters and shared logic inside `runtime` |
| The runtime is **client-side only**. No server rendering, host adapters or partials. Backends keep their own templating | `load-on-server`, server-side `{{ }}`, Django/Blade/PHP adapters |
| Target: mostly static sites and light SPAs, not full web apps | n/a |
| Every customizable behavior is a function with a runtime-provided default; nothing is looked up by string | String options like `'json'`, `'local'` |
| No built-in agent. Agent features are opt-in over MCP, in v2+ | A built-in porting agent |
| Out of scope for now: WebSockets, virtualized lists, recursive trees | n/a |

## Templates

| Decision | Replaces |
|---|---|
| **Bindings fill holes with data; slots fill holes with markup from the component's user.** Never use a slot for a value from data | Slots used for data values (e.g. a card's title) |
| Placement is separate from filling: `<render-template>` places at runtime, component tags place at build time | n/a |
| Binding is split by role: `{{ }}` at build time (part 2, outside `<template>`), `data-bind` / `data-bind-<attr>` at runtime (inside `<template>`). The build skips template contents | One `{{ }}` syntax for every time |
| Bindings always use `textContent`; URL attributes are sanitized | n/a |
| **Filters:** one pipeline syntax (`value \| filter:arg`) and one set of functions in `shared`, used by build and runtime. Single-value transforms only | `data-format`, `data-fallback` |
| Only `fallback` ships by default; every other filter is opt-in via `configure({ filters })`. Unregistered filters are an error | Built-in formatters always shipped; custom formatters as a v3 feature |
| Missing values are skipped unless a `fallback` filter is given | n/a |
| To bind a few words inside a line, wrap them in a `<span>` | n/a |
| Lists: the list component declares `data-accepts="array"`, `data-item`, `data-index`, `data-key`. Item components stay agnostic | `data-each` at the point of use |
| `data-key` is relative to the item and evaluated like a tag's `key` | `data-key="product.id"` |
| Nested lists, grouped data and tables are templates inside templates, using `data-from` | n/a |
| Keyed objects are bound by path, not iterated | n/a |
| Conditionals: `data-if` / `data-if-not` with space-separated paths, all must pass. No `data-else`, no expressions. Failing hides with `display: none` | "No conditionals in templates"; `data-else` |
| CSS is scoped by attribute (`data-c`), not hashing | Build-time class hashing |

## Rendering and actions

| Decision | Replaces |
|---|---|
| `<render-template>` places every component at runtime: `template="name"`, `load-from-action`, `subscribe-to-action`. Its children always fill slots | Runtime component tags; `load-on-client`, `load-on-action` |
| `load-from-action` loads once; `subscribe-to-action` subscribes to tags. Only subscribers count as mounted | n/a |
| State templates live on the element: `on-pending`, `on-success`, `on-no-content`, `on-error`. Actions know nothing about templates | `data-state` on templates; the action's `pending` / `success` / `noContent` / `failure` options; the action's `into` |
| Unmapped states do nothing. No system defaults | System default templates |
| No `empty` state. `no-content` means a 204 or empty body; an empty array is ordinary success | `empty` |
| `action()` is the baseline. `provider()` (`GET`, `QUERY`) and `mutation()` (everything else) are thin layers that reject options outside their role | One generic `action()` only |
| Elements invoke actions with `data-action` (optional `data-on`) and pass no arguments; anything needing arguments is called from a regular JS handler | HTMX-style `data-source` / `data-target` / `data-swap`; `data-args` |
| Templates receive `{ response, context }`. `context` always has built-in state fields (`pending`, `success`, `noContent`, `error`, `statusCode`, `nextPage`) plus extra fields from the optional `context` function. No separate state object | Templates receiving the raw response or a custom object only |
| Pagination: `pages` refetches only the current page on invalidation; `infinite` refetches the current page plus `refreshBehind` (default 1) older pages, never newer, and refreshes the rest via `IntersectionObserver` | A single append/swap mode |
| `nextPage` is a function returning any page param (number, cursor, …) or a falsy value when done; the load-more button hides with `data-if="context.nextPage"` | Runtime auto-hiding the button |
| `send` / `accepts` are functions; `json`, `text`, `multipart`, `urlencoded` built in; other formats by convention | String formats and registered decoders |
| Events are `functionName:event`, with no HTTP method. States reuse `<render-template>` names; lifecycle follows htmx 4 (`before:`, `after:`, `finally:`) | `METHOD:fn:phase` with `pre-request` / `sent` / `received` / `failed` / `timed-out` |
| Action names are unique across the project | n/a |
| The action's `context` function runs in every state and may receive `response: null`; a throwing `context` is reported and adds no fields | A throwing `context` aborting the request with an unhandled rejection |
| A `data-action` on a non-paginated provider forces a refetch; JS calls read through the cache | Triggers silently returning fresh cached data |
| A subscriber or render failure is reported (`reportError`) and does not change the request's state or events | Render exceptions turning a successful request into `error` |

## Data layer

| Decision | Replaces |
|---|---|
| Tags use one shape, `{ tag, key }`: a global type plus an id path (per item in `provides`, in the mutation response for `invalidates` / `reconciles`) | RTK-style flat per-item tags |
| Tags work on the raw response via the `items` function; `context` only serves templates | n/a |
| A tag registry tracks tags in use; "mounted" means present in it | DOM-based mount detection |
| `invalidates`: `'Tag'` or `['A', 'B']` (whole tags), `{ tag, key }` (one item from the response), `{ tag, id: fn }` (one item from args). A missing id clears the whole tag | `invalidates: 'Product'` only |
| `reconciles` is an upsert and always takes `{ tag, key }`; the upserted item is the object holding the key. New items land at the end; an optional `sort` comparator (default `null`) re-sorts | `reconciles: 'Product'`; `onReconcileFailure` |
| A failed reconcile falls back to invalidating the whole tag | A configurable `retry` / `ignore` |
| Tag ids match by value (`42` equals `'42'`) so DOM `data-key` strings identify cached items | Strict `===` comparison |
| An explicit page argument never joins an in-flight request for a different page | Dropping the request while another page loads |
| No optimistic updates. `onInvalidate: 'pending'` is opt-in | n/a |
| Cache: in memory, keyed by action + args, reference-counted by mounted elements | n/a |
| `refetchAfter` and `keepUnusedFor` are separate options. Both default to `respectCacheOr(Infinity)`: follow HTTP caching headers, and never expire on age without them. `respectCacheOr` is the only form; passing it is an override | Defaults of `Infinity` or 60 s; a bare `respectCache` |
| Persistence is opt-in via store objects (`localStore()`, `sessionStore()`, `indexedDbStore()` or any `{ get, set, remove }`), globally and per action, with `maxAge` (24 h) and `buster` | String store names |
| `onRefetchFailure` defaults to `'keep'` | n/a |
| No default `timeout`; `fetch`'s own behavior stands | n/a |

## Builder, editor and tooling

| Decision | Replaces |
|---|---|
| The builder parses existing HTML as is. Component tags (Astro-style) are expanded into static HTML at build time and never shipped. Their main use is layouts and wrappers filled through slots | Component tags at runtime |
| Component tags and `<render-template template>` share component folders and slot rules; only *when* they render differs | n/a |
| The editor may load React/Vue components for preview and comparison only; output stays framework-free | n/a |
| No declared schemas. A v1.1 linter derives each template's required fields and generates types; TypeScript checks every registered template against at least one of the action's `{ response, context }` return types. The `context` function isn't tested | OpenAPI-style schemas; a `shape` option |
| Ports map data props to bindings and `children` / render props to slots | Props mapped to "slots or bindings" without a rule |
| Automatic component suggestions and React/Vue generation are opt-in MCP features (v2+) | Automatic suggestions in the v1 builder |

## Runtime implementation conventions

| Decision | Replaces |
|---|---|
| Native browser ES modules; `configure({ actions })` explicitly registers imported functions under unique HTML/event names | Unspecified discovery of module-local action exports |
| Helper actions return `{ response, context }` in every state; direct components accept `.data`, retaining previews until data is supplied | Unspecified JavaScript rendering/call interface |
| Component CSS is written plainly and scoped automatically on each selector's last compound (`.card` → `.card[data-c="x"]`) by the builder's `scopeCss` while bundling; explicit `[data-c` selectors are left as written | Hand-written `[data-c]` selectors; CSS Modules class renaming |
| Folder convention: `<name>.css` / `<name>.js` beside `<name>.html` are picked up when the component is used; the HTML holds only the template. Node checks the disk; the HTTP loader uses `HEAD` requests | `<link>` / `<script>` declarations inside the component file |
| `<render-template>` only renders templates already in the page: it loads nothing and adds no scope attributes, so standalone pages can use any global CSS (Bootstrap, Tailwind, …). Components (template + CSS + JS, scoping) are purely a builder concept | The runtime loading component folders and adding `data-c` |
| The builder writes `data-c` into the component templates it ships for the runtime, so runtime-rendered copies match scoped CSS | Runtime-added scope attributes |
| `buildPage` loads component folders for tags and runtime references, renders tags, ships only runtime templates and reports the components each page uses; component files are never linked one by one | Components only as inline templates; per-component `<link>`/`<script>` tags |
| Component loading is a builder function (`componentFolder(base)` over HTTP, `nodeComponentFolder` on disk); the builder core still owns no I/O itself | String folder settings |
| Component JS is an ordinary module imported once per page; its rules are unchanged (no data fetching) | n/a |
| `buildPage` can unify and minify a page's component CSS/JS into one file each, named by a customisable `name({ project, page })` (default `${project}-${page}`), linked once from the page and returned for the caller to write | Per-component links; a single unnamed global bundle |
| Bundling is a `Bundler` function; the default implementation uses Vite+ (Rolldown, Lightning CSS) and is Node-only | esbuild-wasm; a built-in concatenating bundler |
| Node-only adapters live in `packages/<package>/node/`, may import `node:*`, `vite-plus` and `jsdom`, and are never imported by browser modules (enforced by the architecture check) | All package code restricted to relative imports |
| Site builds run in Node with the DOM-based builder and jsdom (browser HTML parsing rules); `buildSite` and a `buildadiv build --config` CLI write pages and per-page bundles | A text-only builder; builds only inside a browser |
| `buildSite` separates `base` (URL where the output is served) from `assets` (bundle folder in the output) | One asset path used as both URL and output folder |
| The runtime also ships as one standalone minified ES module, `dist/lib/buildadiv-runtime.min.js` (packed by `vp pack`), with bundled typings | Copying `dist/packages/runtime` and `dist/packages/shared` together |
| Browser tests serve on port 4174 (`TEST_PORT`), separate from `npm run serve-examples` on 4173 (`PORT`) | Both fixed to 4173 |
| Infinite providers share a sequence; explicit arguments select pages; exported `mergeInfinite` / `mergePages` defaults and `items` enable envelope responses | Unspecified pagination call / viewport integration |

## Initial static expansion

| Decision | Replaces |
|---|---|
| Builder first stage exposes in-place DOM expansion and HTML parsing/serialization functions; no runtime dependency | Unspecified first implementation boundary |
| Component attributes become string `props`; slot markup retains caller scope; `{{ }}` results are never reparsed | Open question about passing static values to component tags |
| Runtime templates and render hosts, script/style text and comments pass through unchanged; unknown custom tags are preserved | Unspecified preservation rules for existing vanilla pages |
| Build output omits static definitions unless a `<render-template>` (directly or inside a shipped template) names them; in-place expansion keeps them | Every definition shipped in build output |
| The `<render-template>` attributes that name templates live in `shared`, used by the runtime element and the builder | A runtime-only attribute list |
| Scope attributes belong to component-owned elements; host attributes are used explicitly through `props` | Unspecified root/host attribute forwarding |

## TypeScript implementation

| Decision | Replaces |
|---|---|
| All library source, examples, test server and tests use strict TypeScript; `tsc` emits ordinary ES modules, declarations and source maps to `dist/` | JavaScript-only implementation source |
| Keep `.js` import specifiers in `.ts` source; vanilla websites load the emitted files without bundling | Unspecified TypeScript/browser distribution path |
| Public contracts describe actions/results, providers/mutations, filters, stores and component expansion; request data remains untrusted `unknown` internally | Implicit JavaScript contracts |
| Function comments state purpose and expected behavior, including lifecycle and scope ownership | Implementation-only comments |
| Action role contracts use request/query/write interfaces, derived forbidden `never` fields, typed method vocabulary, role-specific return types and a normalized discriminator | Runtime arrays of read/write option names and a method set |
| Standard methods are typed by role; custom HTTP extension methods use the baseline `action()` | Unrestricted string methods on the mutation convenience helper |

## Development tooling

| Decision | Replaces |
|---|---|
| Vite+ (`vite-plus`) is the single development toolchain dependency; `vp fmt` (Oxfmt) formats and `vp lint` (Oxlint) lints, configured in `vite.config.ts` | Prettier with `.prettierrc.json`; no linter |
| Lint runs type-aware rules plus type checking and fails on warnings. `no-base-to-string` is off because bindings stringify unknown data on purpose | n/a |
| Builds stay on `tsc` (no `vp build` / `vp pack`), so output remains unbundled native ES modules | n/a |
| `vp env` manages the development runtime from `devEngines` (Node.js 24, npm 12); `engines.node` stays the consumer-facing range | An unpinned "Node.js 22 or newer" requirement |

## Semantic source organization

| Decision | Replaces |
|---|---|
| Keep documented entry points as thin facades over nested contracts, actions, data, DOM and configuration modules | Large mixed-responsibility runtime action/type files |
| Inject a typed refetch callback into request execution, cache timers and tag effects to keep value imports acyclic | Request/query/tag logic living in one file |
| Separate builder parsing, definitions, interpolation and expansion; group validation by domain with a code map | Single builder implementation and flat validation files |
