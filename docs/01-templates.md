# 01 · Templates (part 1)

How a component is written: its folder, its `<template>`, and everything a template can contain.

**Contents:** [Component folder](#component-folder) · [Template](#template) · [When to use what](#when-to-use-what) · [Bindings](#bindings) · [Slots](#slots) · [Filters](#filters) · [Missing values](#missing-values) · [Lists](#lists) · [Conditionals](#conditionals) · [Fixtures](#fixtures) · [CSS and JS](#css-and-js)

---

## Component folder

```
components/product-card/
  product-card.html           # <template> defining structure
  product-card.css            # styles, written plainly and scoped automatically (optional)
  product-card.js             # local behavior (optional)
  product-card.fixtures.json  # named sample-data variants (optional)
```

- **Convention, not declaration.** The HTML file holds only the template. Whichever of `<name>.css` and `<name>.js` exists beside it is picked up when the component is used; nothing links them by hand.
- **Wherever the component is used, its files come with it.** In a built site, the build detects each component a page uses (as a tag or through a `<render-template>`) and puts its CSS and JS into that page's single minified bundle ([04](04-builder-and-editor.md#component-files)).
- **Components are a builder concept.** The runtime's `<render-template>` only renders templates already in the page and loads nothing; a page used without the builder writes its templates inline and styles them with any global CSS ([02](02-rendering-and-actions.md#render-template)).

## Template

A component whose content all comes from data uses **bindings only**:

```html
<template data-component="product-card">
  <article class="card">
    <h3 data-bind="name">Product name</h3>
    <p class="price" data-bind="price | currency:EUR">€0.00</p>
    <img data-bind-src="image_url" data-bind-alt="image_alt" src="placeholder.png" alt="Product photo">
    <p data-bind="description">Optional description.</p>
  </article>
</template>
```

- `<template data-component="name">` declares a component. The name must match the folder.
- A template declares **structure**. It is not a separate templating language. Its only logic is truthiness checks ([Conditionals](#conditionals)) and single-value [filters](#filters). It renders only what it's given.
- **Every binding and slot has preview content** ("Product name", "€0.00" above). That's what the editor and tests show when there's nothing to fill it. It is never shown to real users in place of missing data.

## When to use what

Four tools, two jobs. **Filling** a hole inside a component, and **placing** a component on a page.

| Use | Job | For | Example |
|---|---|---|---|
| **`data-bind`** / `data-bind-<attr>` | Fill | A **value from data**, inserted as text or an attribute | a product's name, price, image URL |
| **`<slot>`** | Fill | **Markup written by whoever uses the component**: elements, other components, a free-form block | a modal's body, a page layout's content, a card's footer buttons |
| **`<render-template>`** | Place | A component **in the browser**, with or without data | a live product list, a modal opened at runtime |
| **Component tag** (`<modal-dialog>`) | Place | A component **at build time** (part 2) | the site header, the page layout |

**Rules of thumb:**

- Comes from data → `data-bind`.
- Written by the person using the component → slot.
- Needs to render in the browser, or needs an action's data → `<render-template>`.
- Static, known at build time → component tag ([04](04-builder-and-editor.md#component-tags)).

A component can use both bindings and slots. A product card might bind its name and price from data and offer a slot for the buttons each page wants underneath.

## Bindings

Bindings fill a hole with a **value from data**. Binding is split by role:

| Syntax | Filled | By | Where |
|---|---|---|---|
| `data-bind`, `data-bind-<attr>` | At runtime | `<render-template>` | Inside `<template>` |
| `{{ value }}` | At build time | Part 2's build | Pages and component tags, **outside** `<template>` ([04](04-builder-and-editor.md#build-time-values)) |

The build skips everything inside `<template>`, so the two never meet. Part 1 understands only `data-*` attributes, which is why it needs no build.

**Runtime bindings:**

- `data-bind="path"` sets the element's text.
- `data-bind-<attr>="path"` sets an attribute: `data-bind-src`, `data-bind-href`, `data-bind-alt`, …
- **Text only, never HTML.** Values are written with `textContent`, never `innerHTML`, so markup in data shows as text. (Markup belongs in [slots](#slots).)
- **URL attributes are sanitized.** `href`, `src` and similar never accept `javascript:` URLs.
- **Paths use dots:** `product.name`, `title.en`. Keyed objects like `{ "en": …, "fr": … }` are addressed by key, not iterated.
- An array of primitives binds the item itself: `data-bind="tag"`, where `tag` is the item name.
- **To bind a few words inside a line**, wrap just those words in an element, usually a `<span>`:

```html
<p>Hello <span data-bind="user.firstName">there</span>, you have
   <span data-bind="cart.count | number">0</span> items in your cart.</p>
```

## Slots

Slots let **whoever uses a component** pass in their own markup. Use them for wrappers and layouts; use `data-bind` for values from data.

**1. Definition** (once, in the component). `<slot>` marks a hole:

```html
<!-- components/modal-dialog/modal-dialog.html -->
<template data-component="modal-dialog">
  <div class="modal">
    <header><slot name="header">Title</slot></header>   <!-- a hole called "header" -->
    <div class="body"><slot>Content</slot></div>         <!-- the default hole -->
  </div>
</template>
```

**2. Use** (on any page, as often as needed). `slot="…"` says which hole an element goes into; anything without it goes into the default hole:

```html
<modal-dialog>
  <h2 slot="header">Delete product?</h2>
  <p>This can't be undone.</p>
  <button data-action="deleteProduct">Delete</button>
</modal-dialog>
```

**3. Result** after the build (or `<render-template>`) puts them together:

```html
<div class="modal">
  <header><h2>Delete product?</h2></header>
  <div class="body">
    <p>This can't be undone.</p>
    <button data-action="deleteProduct">Delete</button>
  </div>
</div>
```

- `<slot name="header">` is the **socket**, in the component. `slot="header"` is the **plug**, on the page.
- Text inside a `<slot>` is preview content, shown only when the user doesn't fill that hole.
- Slot content is the user's own markup, so it may contain anything: elements, bindings, component tags, `<render-template>`.
- There's **no shadow DOM**, so native slotting doesn't apply. The build (component tags) and `<render-template>` (runtime) fill slots themselves, using the same rules from the `shared` package ([04](04-builder-and-editor.md#packages)).

## Filters

One pipeline syntax and one set of filter functions, shared by runtime bindings and build-time `{{ }}`. They live in the `shared` package, so a filter behaves identically on both sides.

```html
<!-- runtime (part 1) -->
<p data-bind="price | currency:EUR | fallback:'—'">€0.00</p>
<a data-bind-href="product.url | fallback:'#'">View</a>

<!-- build time (part 2) -->
<h1>{{ site.title | upper }}</h1>
```

- **Syntax:** `path | filter | filter:arg | filter:arg1:arg2`, applied left to right.
- **Single-value transforms only:** formatting, fallbacks, case, truncation. No expressions, comparisons or conditions. Those belong in the action's `context` ([02](02-rendering-and-actions.md#context)).
- **No collisions with backends:** at runtime the pipeline lives inside a `data-*` attribute value, which no server template engine parses.
- **Opt-in.** Only `fallback` ships by default. Every other filter is imported and registered by the developer, so nothing unused ships:

```js
import { configure } from '../runtime/index.js';
import { currency, number, upper } from '../runtime/filters.js';   // re-exported from shared
import { slugify } from './my-filters.js';   // a project's own filter is just a function

configure({ filters: { currency, number, upper, slugify } });
```

| Filter | Availability |
|---|---|
| `fallback:'text'` | Always available |
| `currency:EUR`, `number`, `percent`, `date:long`, `relativeTime:day` | Provided, opt-in. `Intl`-based, locale from `<html lang>` |
| `upper`, `lower`, `truncate:40` | Provided, opt-in |
| Your own | Register any function; the key is its name in HTML (`{ 'relative-time': relativeTime }` would rename one) |

- Using a filter that isn't registered is an **error** the editor and linter flag, not a silent no-op.

## Missing values

- With no `fallback` filter, a missing or `null` value is **skipped**: the element renders empty.
- Add `fallback` for text instead: `<h3 data-bind="name.fr | fallback:'Sans titre'">Product name</h3>`.

## Lists

A component that renders a list says so on its template. Item components stay agnostic and never assume they'll be repeated.

```html
<template data-component="product-rows"
          data-accepts="array" data-item="product" data-index="i" data-key="id">
  <li>
    <span data-bind="i">1</span>
    <span data-bind="product.name">Product name</span>
  </li>
</template>
```

| Attribute | Meaning |
|---|---|
| `data-accepts="array"` | Stamp the template once per item |
| `data-item="product"` | Name used to bind the current item |
| `data-index="i"` | Name used to bind the position |
| `data-key="id"` | The item's stable id, **relative to the item**. Evaluated exactly like a tag's `key` ([03](03-data-layer.md#tags)), so items update in place |
| `data-from="path"` | Where an inner (or top-level) list reads its array |

- The runtime writes each item's key onto its root element, so handlers can find it with `event.target.closest('[data-key]')`.
- A list at the top level of an action's template reads from `response` by default. Use `data-from` to point elsewhere, e.g. `data-from="response.results"` or `data-from="context.products"`.

**Nested lists, grouped data and tables** are templates inside templates. Inner names must differ from outer ones, and `data-from` is relative to the enclosing item:

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

## Conditionals

Show or hide an element based on **truthiness of paths**, and nothing more.

```html
<p data-if="product.inStock">In stock</p>
<p data-if-not="product.inStock">Sold out</p>

<button data-if="context.hasMore context.loggedIn">Load more</button>
<span data-if="product.onSale" data-if-not="product.soldOut">Sale!</span>
```

- `data-if="a b c"`: shown only if **every** path is truthy. `data-if-not="a b c"`: shown only if **every** path is falsy. Both on one element: both must pass.
- Paths are space-separated in one attribute, because HTML drops repeated attributes on the same element.
- **Falsy:** `false`, `null`, missing, `0`, `""` and **empty arrays**. So `data-if="products"` covers "the list is empty".
- **No `data-else`.** Write the opposite condition explicitly with `data-if-not`.
- **Not allowed:** expressions, comparisons, OR, function calls. Compute them in the action's `context` and test the resulting boolean.
- A failing condition hides the element with **`display: none`**. It stays in the DOM, so listeners and structure survive when it reappears.
- Every branch must be reachable by flipping a value in a fixture, so the editor can preview each one.

## Fixtures

`*.fixtures.json` maps variant names to sample data in the same shape the component receives at runtime. For components rendered from an action, that's `{ response, context }` ([02](02-rendering-and-actions.md#context)).

```json
{
  "long-name": { "name": "An extremely long product name that wraps", "price": 1299 },
  "missing-french": { "name": { "en": "Scarf" } }
}
```

- The editor uses fixtures as stories. Fixtures never ship in build output.
- Fixtures fill **bindings**. Slots are previewed with their own preview content, or with sample markup chosen in the editor.

## CSS and JS

- **Scoped CSS by attribute, not hashing.** The component's elements carry `data-c="product-card"`, added by the build: to markup expanded from component tags, and written into component templates it ships for the runtime, so runtime-rendered copies carry it too. Write plain selectors in `product-card.css`; the bundler scopes them on each selector's last compound: `.card` → `.card[data-c="product-card"]`, `.card .title::before` → `.card .title[data-c="product-card"]::before`. Rules inside `@media`, `@supports`, `@container` and `@layer` are scoped; `@keyframes` and `@font-face` are not; a selector that already mentions `[data-c` is left as written. Class names stay exactly as written.
- **Global CSS** lives in `styles/global/`: tokens (custom properties), resets, typography, layout. Only for things that are clearly global.
- Component CSS comes after the page's own styles, so it can override global rules.
- **Component JS** (`product-card.js`) is an ordinary ES module holding behavior for one component. It runs **once** per page, bundled into the page's script, and typically attaches delegated listeners scoped by `[data-c="product-card"]`. It may import its own helper modules; the bundler includes them. It **never fetches data**; that's what actions are for.
