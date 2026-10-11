# Buildadiv

Helpers to scale up your regular Vanilla to use some of the SPA-like behaviour with minimal javascript.

## query-template · `@buildadiv/query-template`

Supercharging your HTML templates with a query fetcher inspired by TanStack Query and RTK Query.

installation : `npm i @buildadiv/query-template`, or copy the single file `query-template.min.js` (no build step, no dependencies).

```html
<template data-component="product-rows" data-accepts="array" data-item="product" data-key="id">
  <li>
    <span data-bind="product.name">Product name</span>
    <span data-bind="product.price | currency:EUR">€0.00</span>
  </li>
</template>
<template data-component="loading"><li>Loading…</li></template>

<ul>
  <use-template subscribe="loadProducts" on-pending="loading" on-success="product-rows">
  </use-template>
</ul>

<script type="module">
  import { configureActions, query, mutation, currency } from '@buildadiv/query-template';

  const loadProducts = query({ url: '/api/products', provides: { tag: 'Product', key: 'id' } });
  const renameProduct = mutation({
    method: 'PUT',
    url: (args) => `/api/products/${args.id}`,
    reconciles: { tag: 'Product', key: 'id' },
  });
  configureActions({ actions: { loadProducts, renameProduct }, filters: { currency } });
</script>
```

### What does it give you

- Templates live in the page; `<use-template>` renders them for each state: `on-pending`, `on-success`, `on-no-content`, `on-error`.
- Queries cache by tag; mutations invalidate or reconcile, so only changed rows re-render.
- Keyed and nested lists, `data-if`, slots, pagination, locale-aware filters. Style with any CSS.

## Builder · `@buildadiv/builder`

```html
<!-- components/product-card/product-card.html  (+ optional product-card.css / .js) -->
<template data-component="product-card">
  <article class="card">
    <h2>{{ props.name }}</h2>
    <slot>Details</slot>
  </article>
</template>

<!-- pages/index.html -->
<product-card name="{{ featured.name | upper }}"><p>Featured this week.</p></product-card>
```

```sh
npx buildadiv build --config buildadiv.config.js
```

A template expander for static pages: component tags are expanded into plain HTML at build time.

- Each page gets one minified CSS and JS bundle with only the components it uses (`shop-index.min.css`). Component CSS is scoped automatically.
- Pages keep `<use-template>` regions for live data; the templates they need ship with the page.
- Same filters as query-template, formatted for each page's `lang`.

Docs: [builder](docs/04-builder-and-editor.md)

## Development

```sh
vp install                       # or npm install
npm run serve-examples           # examples and a demo API on http://127.0.0.1:4173
npm run check                    # build, architecture, format, lint, unit and browser tests
```

Examples: `examples/runtime/` (every `<use-template>` pattern), `examples/vanilla/`,
`examples/playground/` (manual scenarios), `examples/site/` (a site built by the CLI).
Start with [AGENTS.md](AGENTS.md), [CONTRIBUTING.md](CONTRIBUTING.md) and the
[code map](docs/08-code-map.md).
