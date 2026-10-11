# 04 · Builder and editor (part 2)

How existing HTML becomes a component-based site, what the build outputs, what the editor does, and how the code is split into packages.

**Contents:** [Starting from existing HTML](#starting-from-existing-html) · [Component tags](#component-tags) · [Build-time values](#build-time-values) · [Build output](#build-output) · [The editor](#the-editor) · [Packages](#packages) · [Site layout and distribution](#site-layout-and-distribution)

---

## Starting from existing HTML

The builder parses ordinary HTML files **as they are**, so an existing static site can be brought in without rewriting it. In v1 it takes pages as they are; suggesting or generating components automatically is left to opt-in agents over MCP (v2+, see [06](06-roadmap.md#mcp-v2)).

## Component tags

Component tags **place** a component **at build time**. Their main use is layouts and wrappers, where the page supplies the content through [slots](01-templates.md#slots):

```html
<!-- components/page-layout/page-layout.html -->
<template data-component="page-layout">
  <site-header></site-header>
  <main><slot>Page content</slot></main>
  <footer><slot name="footer">© Shop</slot></footer>
</template>
```

```html
<!-- pages/shop.html -->
<page-layout>
  <h1>Shop</h1>
  <ul>
    <use-template subscribe="loadProducts" on-success="product-rows"></use-template>
  </ul>
  <p slot="footer">Free shipping over €50.</p>
</page-layout>
```

- The tag name is the component's folder name. It must contain a hyphen, so it never collides with native elements. No project prefix: pages belong to the site owner.
- Children fill slots: `slot="name"` for named slots, everything else for the default slot.
- **The build expands component tags into static HTML.** They never reach the browser, so static content works without JS and is visible to search engines.
- `<use-template>` elements pass through untouched and render in the browser. That's how a static page gets live, data-driven regions.
- Component tags and `<use-template template="…">` read the same component folders and fill slots by the same rules. The only difference is *when* they render: at build time vs in the browser. See [01 · When to use what](01-templates.md#when-to-use-what).

## Build-time values

- `{{ value }}` is filled at **build time**, in pages and component tags **outside** `<template>`.
- The build **skips everything inside `<template>`**, which is where runtime `data-bind` lives, so the two never meet.
- It uses the same filter pipeline and functions as the runtime, from the `shared` package: `{{ site.title | upper }}` ([01](01-templates.md#filters)).
- A backend serving these pages can resolve `{{ }}` with its own templating instead. That's its business; the runtime never sees `{{ }}`.

## Build output

- **Static HTML pages**, with component tags expanded into markup and slots filled.
- **`<use-template>` elements** left in place for the browser.
- **`<template>` blocks** kept only where the browser clones them (lists, action results).
- **Bundled, minified CSS and JS**, including only the runtime pieces, filters and default functions a project imports.

## The editor

Runs entirely in the browser.

| Feature | What it does |
|---|---|
| **Library panel** | Discovers `<template data-component>` blocks and reads their bindings, slots, filters, conditionals and lists as the component's interface. Renders preview content and fixture variants |
| **States** | Previews each template a `<use-template>` maps: pending, success, no content, error |
| **Canvas** | Composes pages visually with component tags; every edit writes back to source files |
| **Split view** | Code and design stay in two-way sync |
| **Importing components** | Loads plain HTML/CSS components (preferred), or React, Vue and similar, to view, compare side by side and iterate. Framework code runs **only in the editor's preview**; nothing framework-based ships |
| **Preview** | A sandboxed `<iframe>` |
| **Files** | File System Access API where available (Chromium); elsewhere OPFS plus zip/folder import and export |
| **Build in browser** | WASM tooling (e.g. esbuild-wasm), so no local server is required |
| **Linting** (v1.1) | Checks templates against the actions that feed them ([06](06-roadmap.md#linting-v11)) |

## Packages

The repository is an npm workspace. Each package is its own project, with its own
`package.json`, tsconfig and build, so the runtime and the builder ship and version
independently:

```
packages/
  shared/    @buildadiv/shared          private, never published
             filters, the filter-pipeline parser, path resolution, slot rules,
             template references. No DOM-only or build-only code.
  runtime/   @buildadiv/query-template  part 1, client only: <use-template>, binder,
             query / mutation / action, tags, cache, events. Published standalone.
  builder/   @buildadiv/builder         part 2: HTML parsing, component tags, {{ }},
             component folders, CSS scoping, page bundles, the Node site build and
             the `buildadiv` CLI.
  editor/    @buildadiv/editor          part 2: the browser editor (planned)
```

**Import rules:**

| Package | May import from |
|---|---|
| `shared` | nothing else in the repo |
| `runtime` | `shared` |
| `builder` | `shared` |
| `editor` | `shared`, `runtime`, `builder` |

- `runtime` and `builder` **never import from each other**.
- Inside a package, imports are relative native `.js` paths. **Another package is
  reached only by name** (`import { resolvePath } from '@buildadiv/shared/path.js'`),
  never with `../`, and must be declared in the importing package's `package.json`.
  `npm run validate:architecture` enforces both.
- A filter or slot rule is written once in `shared`, so it's guaranteed to behave the same at build time and in the browser.
- **`shared` is private.** Each product's `vp pack` build inlines the shared code it
  uses, so users install one package with no internal dependencies. That's why
  `@buildadiv/shared` is a **`devDependency`** of each product even though its code
  runs at runtime: it's needed to *build* the package, and is already inside the
  published file. As a `dependency` it would be left external (the published file
  would import it) and npm would try to install a package that is never published.
  The packaging test checks it never appears in a product's `dependencies`.
  - `@buildadiv/query-template` publishes `lib/query-template.min.js` (+ typings), one
    minified ES module with **no dependencies**. It re-exports the filters, so projects
    import everything from one place.
  - `@buildadiv/builder` publishes `lib/index.mjs` (browser-compatible API),
    `lib/node.mjs` (`@buildadiv/builder/node`: `buildSite`, `viteBundler`, …) and the
    `buildadiv` CLI. Its only dependencies are `jsdom` and `vite-plus`.
  - The pack configs allowlist what may be inlined (`@buildadiv/shared` only) and what
    the output may import, so an accidental dependency fails the build.
- For development, each package also compiles per module into its own `dist/`
  (`tsc -b`, project references). The repository's pages and tests use those modules;
  pages that load them directly map `@buildadiv/shared/` with an import map.

## Site layout and distribution

A site built with it:

```
components/      # one folder per component
pages/           # page HTML files (existing HTML can be dropped in as is)
styles/global/   # tokens, resets, layout
api/             # queries and mutations
```

- **Runtime library:** an ES module, from a CDN `<script type="module">` or a package manager. Tree-shakable.
- **Builder & editor:** the browser-based editor, plus a CLI build for CI.

## Component files

Components live in folders: `components/<name>/<name>.html` with optional
`<name>.css` and `<name>.js` beside it ([01](01-templates.md#component-folder)).

### Building a site (Node)

```sh
npm run build                 # also builds the example site below
node dist/packages/builder/node/cli.js build --config path/to/buildadiv.config.js
```

The config module's default export holds the `buildSite` options; `root` and `outDir`
resolve against the config file:

```js
// buildadiv.config.js
import { currency, upper } from './shared/filters.js';

export default {
  root: '.',              // holds pages/ and components/
  outDir: '../public',
  project: 'shop',        // bundle prefix
  base: '/',              // URL where outDir is served (default '/')
  assets: 'assets',       // bundle folder inside outDir (default 'assets')
  data: { site: { title: 'Shop' } },
  filters: { currency, upper },
};
```

For every page in `pages/` (subfolders included) the build:

- loads every component the page mentions (component tags and `<use-template>`
  references, following the components those mention), once each;
- renders **component tags** into static HTML; their templates don't ship;
- ships the **templates the runtime renders** in the page, so the browser never fetches them;
- puts the CSS and JS of every component the page uses, either way, into **one
  minified stylesheet and one minified script for that page**, and links just those,
  at the end of `<head>` after the page's own styles. A component no page uses never
  ships; a page with no component CSS/JS gets no bundle and no links;
- writes the page to `outDir` at the same relative path, and its bundle files to
  `outDir/<assets>/`.

**Bundle names** come from the project and page prefixes: `shop-index.min.css`,
`shop-blog-post.min.js` for `pages/blog/post.html`. The `name({ project, page })`
option customises them; the exported default `bundleName` gives `${project}-${page}`.
Names must be file-safe (`[\w.-]`).

**Bundling** uses Vite+ (`viteBundler`): Rolldown bundles each component's JS
(including modules it imports) and Lightning CSS minifies the CSS. Before that, every
stylesheet is scoped to its component with `scopeCss` ([01](01-templates.md#css-and-js)).
The runtime knows nothing about this: component templates the build ships for
`<use-template>` get their `data-c` scope written into their markup, so the copies
the runtime renders match the scoped CSS. Styles come before scripts, each
in first-use order, so the cascade follows component use. Only root-relative files
inside `root` are bundled.

**Parsing** in Node uses jsdom, which follows the browser's HTML parsing rules, so a
page builds the same in Node as in the browser editor.

### The building blocks

The site build composes browser-compatible functions, which the editor uses too:

- `buildPage(html, { loadComponent, bundle?, parse?, ...options })` builds one page
  and returns `{ html, components, bundle? }`. `components` lists `{ name, style?,
  script? }` for each component the page uses.
- `loadComponent` is a function `(name) => Promise<{ url, html, style?, script? } |
  undefined>`: `componentFolder(base)` over HTTP (optional files found with `HEAD`
  requests) or `nodeComponentFolder(root, base)` on disk. Pass a root-relative base so
  reported URLs are root-relative.
- `bundle: { bundler, project, page, name?, base? }` makes one bundle per page; the
  bundler is a function `({ name, components }) => Promise<{ css?, js? }>` and the
  build returns the files instead of writing them, so the core owns no I/O.
- `siteComponents(pages)` merges every page's components (each once, first-use order)
  for one site-wide bundle instead of per-page ones.
- Node-only pieces live in `packages/builder/node/`: `viteBundler`, `nodeComponentFolder`,
  `parseHtmlNode` (jsdom), `buildSite` and the CLI.
- Unknown names (the loader resolves nothing) stay unknown custom elements.
- `buildHtml` accepts the same files in `components` when they're already loaded, and
  stays synchronous.

## Initial component expansion API

The first builder stage is a native ES module compiled from `packages/builder/index.ts` to `dist/packages/builder/index.js`.
It works on browser DOM documents or fragments, without importing the runtime.
`expandComponents(root, { components, data, filters })` modifies a parsed DOM in
place and returns it. `buildHtml(html, options)` parses a separate document and
returns static HTML. `removeStaticDefinitions(root)` drops static definitions the
browser no longer needs; `buildHtml` runs it after expansion, while
`expandComponents` alone keeps every definition so an editor can expand again.
`parseHtml` and `serializeHtml` are exported defaults; pass
`parse` and `serialize` functions to `buildHtml` to supply another DOM adapter.
This stage does not bundle assets or implement the editor or CLI.

Inline `<template data-component="name">` declarations provide definitions.
`components` optionally supplies additional template elements or HTML strings
containing declarations. Only names with a hyphen are static component tags;
single-word runtime template names remain declarations. Duplicate definitions
are errors, unknown custom elements stay intact, and recursive definition
composition reports the cycle rather than overflowing the stack.

Component attributes become strings in `props`, available in that component's
`{{ }}` expressions. Interpolation in an attribute is evaluated in the caller's
scope before passing the value. Global `data` remains available to each component.
A nested component gets its own `props`; supplied slot markup evaluates in the
caller's scope. This resolves the static-values open question using attributes:

```html
<template data-component="product-card">
  <article><h2>{{ props.title }}</h2><slot>Card content</slot></article>
</template>
<product-card title="{{ product.name | upper }}"><p>{{ site.note }}</p></product-card>
```

Expansion removes the component tag, inserts all its template roots at that
position, and adds `data-c` to the component's own elements. It does not transfer
host classes or ids to arbitrary roots; use explicit `{{ props.class }}` /
`{{ props.id }}` on the desired element. Slots follow the same shared rules as
the runtime, including fallback content. Components can compose other components.
Supplied markup keeps its caller's scope attributes.

`{{ }}` writes text and sanitized attributes; returned strings are never reparsed
as markup or expressions. Only `fallback` is registered by default. Script/style
contents, comments, runtime `<template>` declarations and `<use-template>`
subtrees stay untouched. Templates used as definitions are expanded only through
their cloned content.

Component tags render at build time, so `buildHtml` output does not ship their
definitions. A hyphenated definition stays only when a `<use-template>` names it
(`template`, `on-pending`, `on-success`, `on-no-content`, `on-error`), including
hosts inside other shipped templates. Single-word runtime declarations always stay.
A template that page scripts reference only from JavaScript must therefore be
named by a `<use-template>` in markup or use a single-word name. Full-document parsing follows the browser's HTML rules
(including repairs to malformed HTML); custom component tags need explicit
closing tags. The builder is static composition, not a Jinja server adapter.

## Source organization and review

Each implemented package keeps its documented import paths as small entry points.
Runtime internals are grouped by responsibility: `contracts/` describes interfaces
and method/role unions, `actions/` constructs actions and executes requests,
`data/` owns cached queries and mutation effects, `dom/` renders native nodes and
handles triggers, and `configuration/` holds explicit registration/settings.
The builder separates parsing/serialization, definitions, interpolation and
expansion. Shared utilities remain small, independent modules.

Request execution receives a typed query-refetch function for mutation effects
and timers. It does not import the query coordinator, keeping value imports
acyclic. Type-only contract references may cross domains. Tests mirror these
responsibilities: unit tests for shared/data behavior, compile-time API contracts,
and browser tests for runtime and builder behavior. See `docs/08-code-map.md` for
entry points, dependency flow and matching validation commands.
