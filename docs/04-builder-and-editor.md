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
    <render-template subscribe-to-action="loadProducts" on-success="product-rows"></render-template>
  </ul>
  <p slot="footer">Free shipping over €50.</p>
</page-layout>
```

- The tag name is the component's folder name. It must contain a hyphen, so it never collides with native elements. No project prefix: pages belong to the site owner.
- Children fill slots: `slot="name"` for named slots, everything else for the default slot.
- **The build expands component tags into static HTML.** They never reach the browser, so static content works without JS and is visible to search engines.
- `<render-template>` elements pass through untouched and render in the browser. That's how a static page gets live, data-driven regions.
- Component tags and `<render-template template="…">` read the same component folders and fill slots by the same rules. The only difference is *when* they render: at build time vs in the browser. See [01 · When to use what](01-templates.md#when-to-use-what).

## Build-time values

- `{{ value }}` is filled at **build time**, in pages and component tags **outside** `<template>`.
- The build **skips everything inside `<template>`**, which is where runtime `data-bind` lives, so the two never meet.
- It uses the same filter pipeline and functions as the runtime, from the `shared` package: `{{ site.title | upper }}` ([01](01-templates.md#filters)).
- A backend serving these pages can resolve `{{ }}` with its own templating instead. That's its business; the runtime never sees `{{ }}`.

## Build output

- **Static HTML pages**, with component tags expanded into markup and slots filled.
- **`<render-template>` elements** left in place for the browser.
- **`<template>` blocks** kept only where the browser clones them (lists, action results).
- **Bundled, minified CSS and JS**, including only the runtime pieces, filters and default functions a project imports.

## The editor

Runs entirely in the browser.

| Feature | What it does |
|---|---|
| **Library panel** | Discovers `<template data-component>` blocks and reads their bindings, slots, filters, conditionals and lists as the component's interface. Renders preview content and fixture variants |
| **States** | Previews each template a `<render-template>` maps: pending, success, no content, error |
| **Canvas** | Composes pages visually with component tags; every edit writes back to source files |
| **Split view** | Code and design stay in two-way sync |
| **Importing components** | Loads plain HTML/CSS components (preferred), or React, Vue and similar, to view, compare side by side and iterate. Framework code runs **only in the editor's preview**; nothing framework-based ships |
| **Preview** | A sandboxed `<iframe>` |
| **Files** | File System Access API where available (Chromium); elsewhere OPFS plus zip/folder import and export |
| **Build in browser** | WASM tooling (e.g. esbuild-wasm), so no local server is required |
| **Linting** (v1.1) | Checks templates against the actions that feed them ([06](06-roadmap.md#linting-v11)) |

## Packages

The code is split so that logic needed on both sides is written once, and the runtime can be published on its own:

```
packages/
  shared/    # used by both sides; no DOM-only or build-only code
             #   filters, the filter-pipeline parser, path resolution (product.name),
             #   slot-filling rules
  runtime/   # part 1, client only: <render-template>, binder, actions / providers / mutations,
             #   tags, cache, events, default behavior functions. Published standalone.
  builder/   # part 2, build only: HTML parsing, component tags, {{ }}, build pipeline (browser and CLI)
  editor/    # part 2: the browser editor
```

**Import rules:**

| Package | May import from |
|---|---|
| `shared` | nothing else in the repo |
| `runtime` | `shared` |
| `builder` | `shared` |
| `editor` | `shared`, `runtime`, `builder` |

- `runtime` and `builder` **never import from each other**.
- A filter or slot rule is written once in `shared`, so it's guaranteed to behave the same at build time and in the browser.
- The runtime re-exports what users need from `shared` (e.g. `runtime/filters.js`), so projects import from one place. Its bundle only includes the parts of `shared` actually used.

## Site layout and distribution

A site built with it:

```
components/      # one folder per component
pages/           # page HTML files (existing HTML can be dropped in as is)
styles/global/   # tokens, resets, layout
api/             # providers and mutations
```

- **Runtime library:** an ES module, from a CDN `<script type="module">` or a package manager. Tree-shakable.
- **Builder & editor:** the browser-based editor, plus a CLI build for CI.
