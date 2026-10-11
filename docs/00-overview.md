# 00 · Overview

**Contents:** [Why](#why) · [The two parts](#the-two-parts) · [Goals](#goals) · [Non-goals](#non-goals) · [Principles](#principles) · [Glossary](#glossary) · [End-to-end example](#end-to-end-example)

---

## Why

AI can generate whole sites, but generating isn't the hard part anymore. Understanding, curating and steering a site is. This project gives the web's own stack (HTML, CSS, JS) a small, readable structure: components you can see and test without data, data fetching that stays out of your markup, and a visual editor over real files you own.

## The two parts

| | **Part 1: Runtime library** | **Part 2: Builder & editor** |
|---|---|---|
| **What** | Client-side rendering: templates, bindings, filters, `<render-template>`, providers and mutations, tags and cache | Parses existing HTML files, composes them with component tags, builds static HTML, with a visual editor on top |
| **Places components with** | `<render-template>` | Component tags (Astro-style) |
| **Fills values with** | `data-bind`, `data-bind-<attr>` | `{{ }}` (build time) |
| **Runs** | In the browser | At build time and in the editor |
| **Shipped as** | A standalone ES module (CDN or package manager) | The browser-based editor plus a CLI build |
| **Needs the other part?** | **No.** Drop it into any page. | Yes. Its output uses the runtime for live regions. |

- Component tags never reach the browser: the build expands them into static HTML. `<render-template>` is the only thing the runtime understands.
- Both parts use the same **filters** and **slot rules**, written once in a shared package ([04](04-builder-and-editor.md#packages)).

## Goals

- Build mostly static sites, plus light SPAs (dashboards, charts), from plain HTML, CSS and JS.
- Components that are readable, previewable and testable **without data**.
- Data fetching modeled on RTK Query / TanStack Query: tags, caching, invalidation, reconciliation, pagination.
- A runtime that ships only what a page uses.
- Bring existing HTML sites in as they are, then compose them with components.
- A visual editor that runs entirely in the browser and writes back to real source files.

## Non-goals

- Exporting to React, Vue or any framework. (Ports are one-way, into this format.)
- Server-side rendering, or integration with server template engines (Django, Blade, Jinja, …). Backends keep their own templating.
- Full web apps, and polymorphic feeds (mixed item types in one list).
- A general-purpose reactive framework.
- Desktop apps or native bindings.
- Passing action arguments from HTML (`data-args`). Use regular JS event handlers.
- **For now:** WebSockets, virtualized rendering of very large lists, recursive trees and depth guards (cyclic data is developer error).

## Principles

1. **The web platform is the source of truth.** Output is HTML, CSS and JS. No framework runtime ships to users.
2. **Ports are one-way.** React/Vue → vanilla, never back.
3. **Structure is readable and testable without data.** Every component renders meaningfully from its preview content alone.
4. **Browser-only.** The editor runs entirely in the browser. No Electron, no Tauri, no required local server.
5. **Small over clever.** Prefer a few obvious conventions to a framework. If the binder starts turning into a framework, stop and discuss.
6. **Know the target.** Mostly static sites and light SPAs, not full web apps.
7. **Client-side runtime.** The runtime never renders on a server. Static pre-rendering happens only in our own build, through component tags.
8. **Every behavior is a function, with a default.** Decoding, encoding, finding items, merging pages, sorting, storage: each is a plain function the runtime provides a default for. Nothing is looked up by string name, and projects import only what they use.

## Glossary

| Term | Meaning | Doc |
|---|---|---|
| **Component** | A folder with a `<template>`, scoped CSS, optional JS and optional fixtures | [01](01-templates.md) |
| **Preview content** | The placeholder content inside every binding and slot; what the editor shows with no data | [01](01-templates.md) |
| **Binding** | `data-bind` (text) or `data-bind-<attr>` (attribute): fills a hole with a **value from data**, at runtime | [01](01-templates.md#bindings) |
| **Slot** | `<slot>` in a component: a hole filled with **markup written by whoever uses the component** | [01](01-templates.md#slots) |
| **Filter** | A single-value transform in a binding pipeline: `price \| currency:EUR` | [01](01-templates.md#filters) |
| **Fixture** | Named sample data for previewing a component | [01](01-templates.md#fixtures) |
| **`<render-template>`** | The runtime element that **places** a component in the browser, with or without data | [02](02-rendering-and-actions.md#render-template) |
| **Component tag** | `<modal-dialog>` in a page: **places** a component at build time; expanded into static HTML | [04](04-builder-and-editor.md#component-tags) |
| **Action** | A named function in `api/` that makes an HTTP request. `action()` is the baseline helper | [02](02-rendering-and-actions.md#actions) |
| **Provider** | An action that reads (`GET`, `QUERY`) | [02](02-rendering-and-actions.md#actions) |
| **Mutation** | An action that changes data (`POST`, `PUT`, `PATCH`, `DELETE`, …) | [02](02-rendering-and-actions.md#actions) |
| **Context** | Built-in state fields plus extra fields an action computes; templates read `{ response, context }` | [02](02-rendering-and-actions.md#context) |
| **Tag** | `{ tag, key }`: a global type plus an id path, used for caching and invalidation | [03](03-data-layer.md#tags) |
| **Mounted** | Present in the tag registry because a subscribing `<render-template>` is on the page | [03](03-data-layer.md#tag-registry) |
| **Invalidate** | Drop cached data for a tag (or one item) so mounted queries refetch | [03](03-data-layer.md#invalidation) |
| **Reconcile** | Upsert a mutation's response into the cache, with no refetch | [03](03-data-layer.md#reconciliation) |

## End-to-end example

A product list that loads from an API, shows a skeleton while loading, and updates in place when a product is renamed.

**1. A component** (`components/product-rows/product-rows.html`). Everything comes from data, so it uses bindings only:

```html
<template data-component="product-rows"
          data-accepts="array" data-item="product" data-index="i" data-key="id">
  <li>
    <span data-bind="product.name">Product name</span>
    <span data-bind="product.price | currency:EUR">€0.00</span>
  </li>
</template>
```

**2. Actions** (`api/products.js`):

```js
import { provider, mutation } from '../runtime/action.js';

export const loadProducts = provider({
  url: '/api/products',
  provides: { tag: 'Product', key: 'id' },
});

export const renameProduct = mutation({
  method: 'PUT',
  url: (args) => `/api/products/${args.id}`,
  reconciles: { tag: 'Product', key: 'id' },
});
```

**3. Placing it on a page:**

```html
<ul>
  <render-template
    subscribe-to-action="loadProducts"
    on-pending="product-skeleton"
    on-success="product-rows"
    on-error="error-message">
  </render-template>
</ul>
```

**4. Registering the filters the page uses:**

```js
import { configure } from '../runtime/index.js';
import { currency } from '../runtime/filters.js';

configure({ filters: { currency } });
```

What happens: the element calls `loadProducts`, shows `product-skeleton`, then stamps `product-rows` once per product. When `renameProduct` succeeds, its response is upserted into the cache by `id`, and only that one `<li>` re-renders.
