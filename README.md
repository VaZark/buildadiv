# Buildadiv

A toolkit for ordinary HTML, CSS and JavaScript websites. The runtime, shared
utilities, and initial component builder are written in strict TypeScript.
`tsc` emits native ES modules and declaration files into `dist/`; the browser
loads ordinary JavaScript with relative imports. There is no bundler, framework,
or runtime dependency. The editor and remaining build pipeline are still planned.

## Try the examples

Development uses [Vite+](https://viteplus.dev) (`vp`) for the environment and
static checks. `package.json` pins the development Node.js and npm versions in
`devEngines`, so `vp env` selects them automatically; consumers of the emitted
runtime still only need Node.js 22 or newer to build.

```sh
vp install        # or: npm install
npm run serve-examples
```

The server prints its URLs on start:

- http://127.0.0.1:4173/examples/vanilla/index.html: the runtime shop.
- http://127.0.0.1:4173/examples/runtime/index.html: the runtime gallery, a reference for
  `<render-template>`: every state (pending, success, no content, HTTP error, timeout),
  keyed lists with nested templates, `subscribe-to-action` vs `load-from-action`, both
  pagination modes and a direct template with `.data`, using only the standalone file.
- http://127.0.0.1:4173/examples/builder/index.html: static component expansion.
- http://127.0.0.1:4173/examples/playground/index.html: a manual test page with one
  scenario per runtime behavior, its steps and expected result, live server request
  counts and a document-event log. Keep the browser console open; two scenarios
  report deliberate errors there.
  The development server serves compiled files and a demonstration API; it is not
  part of the library. Example requests live in `examples/vanilla/api/`.

## Use the runtime on a vanilla page

Run `npm run build`, then copy the single file `dist/lib/buildadiv-runtime.min.js`
(about 10 kB gzipped; typings in `buildadiv-runtime.min.d.ts`) to your static assets
and import everything from it. Serve JavaScript with the correct MIME type. Consumers
need no build step. The per-module files in `dist/packages/runtime/` and
`dist/packages/shared/` also work when copied together.

```html
<template data-component="greeting">
  <p>Hello <span data-bind="response.name">Visitor</span></p>
</template>
<render-template subscribe-to-action="loadProfile" on-success="greeting"></render-template>
<script type="module">
  import { configure, provider } from './buildadiv-runtime.min.js';
  const loadProfile = provider({ url: '/api/profile' });
  configure({ actions: { loadProfile } });
</script>
```

In a real project, keep action definitions in `api/` and import them into the page
module. `configure` registers imported functions for HTML references and event
names, plus optional filters and persistence settings. TypeScript applications
can specify argument and response types; compilation retains `.js` import paths:

```ts
import { mutation } from './runtime/action.js';
import { json } from './runtime/formats.js';
interface Product {
  id: number;
  name: string;
}
const renameProduct = mutation<{ id: number; name: string }, Product>({
  method: 'PUT',
  url: (args) => `/api/products/${args.id}`,
  send: json,
  reconciles: { tag: 'Product', key: 'id' },
});
```

`<render-template>` renders only templates already in the page and adds no styling
hooks, so a standalone page can use any global CSS (Bootstrap, Tailwind, your own).
Components with their own scoped CSS and JS are a builder feature (below).

For direct rendering, use `template="greeting"` and assign the element's `.data`
property. Preview content remains until data is supplied. Actions return
`{ response, context }`; request failures return an error context and emit events.
See [the runtime specification](docs/02-rendering-and-actions.md) and
[the attribute reference](docs/05-reference.md).

Implemented: sanitized bindings, all documented opt-in filters, slots, scoped
attributes, nested/keyed lists, conditionals, state templates, forms/custom
triggers, shared requests, tag invalidation/reconciliation, freshness/retention,
storage adapters, pagination, and document lifecycle events.
Styles are linked normally with explicit `[data-c="component"]` selectors.

## Static component expansion

The browser-compatible builder expands component tags in place on a parsed DOM,
or compiles a separate HTML string. It uses only `shared`, preserving the runtime
as an independent library.

```ts
import { buildHtml } from './builder/index.js';
import { upper } from './shared/filters.js';
const output = buildHtml(
  `
  <!doctype html><html><body>
    <template data-component="welcome-card">
      <article><h1>{{ props.title }}</h1><slot>Welcome content</slot></article>
    </template>
    <welcome-card title="{{ site.title | upper }}"><p>Hello!</p></welcome-card>
  </body></html>
`,
  { data: { site: { title: 'My site' } }, filters: { upper } },
);
```

Supports nested definitions, multiple roots, attribute props, caller-scoped slots,
shared filter pipelines, sanitization, and cycle/duplicate diagnostics. Runtime
`<template>` and `<render-template>` blocks pass through; definitions used only by
component tags are rendered at build time and left out of the output.
Components live in folders (`components/<name>/<name>.html`, plus optional `.css` and
`.js` that are picked up automatically; CSS is written plainly and scoped for you).
Build a whole site in Node:

```sh
node dist/packages/builder/node/cli.js build --config buildadiv.config.js
```

Each page in `pages/` gets its component tags rendered and one minified stylesheet and
script holding only the components it uses, named from the project and page prefixes
(`shop-index.min.css`; the name is customisable). Bundling uses Vite+ (Rolldown,
Lightning CSS); parsing in Node uses jsdom. `examples/site/` is a complete example,
built by `npm run build` into `dist/examples/site-output/`. The editor is not built
yet; see [the builder spec](docs/04-builder-and-editor.md#component-files).

## Verification

```sh
npm run typecheck                # Strict checks of libraries, examples and tests
npm run lint                     # Oxlint with type-aware rules (fails on warnings)
npm run format                   # Oxfmt
npm test                         # Build and run shared/data-layer tests
npx playwright install chromium  # One-time browser setup
npm run test:browser              # Compile and exercise vanilla pages in Chromium
npm run check                    # Both suites, including compilation
```

TypeScript, Vite+ (bundling Oxlint and Oxfmt) and Playwright are development dependencies. Browser tests use actual
compiled modules and a local HTTP server, verifying DOM identity/focus, request
counts, slots, nested lists, forms, unsafe data, states, persistence, pagination,
and static component composition. Function comments explain purpose and expected
behavior, particularly lifecycle and scope ownership.

## Review and contribution

[The code map](docs/08-code-map.md) lists each module's responsibility and matching
tests. Runtime internals use nested `contracts/`, `actions/`, `data/`, `dom/` and
`configuration/` folders; the builder separates parsing, definitions, interpolation
and expansion. Public import paths stay at the package roots.

See [CONTRIBUTING.md](CONTRIBUTING.md) for coding guidelines. `npm run check` runs
one clean build, import-boundary/cycle validation, the format and lint checks, and
unit and browser tests. Individual commands are documented in the code map.
