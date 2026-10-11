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
npm run dev
```

Open http://127.0.0.1:4173/examples/vanilla/index.html for the runtime shop, or
http://127.0.0.1:4173/examples/builder/index.html for static component expansion.
The development server serves compiled files and a demonstration API; it is not
part of the library. Example requests live in `examples/vanilla/api/`.

## Use the runtime on a vanilla page

Run `npm run build`, then copy `dist/packages/runtime/` and
`dist/packages/shared/` together to your static assets, preserving their relative
paths. Serve JavaScript with the correct MIME type. Consumers need no build step.

```html
<template data-component="greeting">
  <p>Hello <span data-bind="response.name">Visitor</span></p>
</template>
<render-template subscribe-to-action="loadProfile" on-success="greeting"></render-template>
<script type="module">
  import { configure } from './runtime/index.js';
  import { provider } from './runtime/action.js';
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
`<template>` and `<render-template>` blocks pass through. This first stage does
not yet bundle assets or provide a CLI/editor; see [the builder spec](docs/04-builder-and-editor.md).

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
