# 05 · Reference

Every attribute, option, default and event on one page. Explanations live in the linked docs.

**Contents:** [Bindings vs slots vs placement](#bindings-vs-slots-vs-placement) · [Template attributes](#template-attributes) · [`<render-template>`](#render-template) · [Action helpers](#action-helpers) · [Action options](#action-options) · [Behavior functions](#behavior-functions) · [Context fields](#context-fields) · [Filters](#filters) · [Events](#events) · [Exports](#exports) · [Packages](#packages)

---

## Bindings vs slots vs placement

From [01 · When to use what](01-templates.md#when-to-use-what).

| Use | Job | For |
|---|---|---|
| `data-bind` / `data-bind-<attr>` | Fill | A value from data (text or attribute), at runtime |
| `{{ value }}` | Fill | A value known at build time (part 2), outside `<template>` |
| `<slot>` / `slot="name"` | Fill | Markup written by whoever uses the component |
| `<render-template>` | Place | A component in the browser, with or without data |
| Component tag | Place | A component at build time (part 2) |

## Template attributes

From [01 · Templates](01-templates.md).

| Attribute / element | On | Meaning |
|---|---|---|
| `data-component="name"` | `<template>` | Declares a component; matches its folder |
| `data-bind="path \| filters"` | any element | Sets text (always `textContent`) |
| `data-bind-<attr>="path \| filters"` | any element | Sets an attribute; URLs sanitized |
| `<slot>` / `<slot name="x">` | inside a component | A hole for the user's markup; its content is preview content |
| `slot="x"` | child of a component tag or `<render-template>` | Puts this element into the named slot |
| `data-accepts="array"` | `<template>` | Stamp once per item |
| `data-item="name"` | `<template>` | Name for the current item |
| `data-index="name"` | `<template>` | Name for the position |
| `data-key="path"` | `<template>` | Item id, relative to the item |
| `data-from="path"` | `<template>` | Where a list reads its array |
| `data-if="a b"` | any element | Shown if every path is truthy |
| `data-if-not="a b"` | any element | Shown if every path is falsy |
| `data-action="fn"` | button, form, any element | Calls an action on click / submit |
| `data-on="event"` | with `data-action` | Overrides the triggering event |

## `<render-template>`

From [02 · Rendering and actions](02-rendering-and-actions.md#render-template).

| Attribute | Meaning |
|---|---|
| `template="name"` | Render a component directly, no action |
| `load-from-action="fn"` | Load once, no subscription |
| `subscribe-to-action="fn"` | Subscribe to tags, stay current, count as mounted |
| `on-pending` / `on-success` / `on-no-content` / `on-error` | Template per state; unmapped states do nothing |
| children | Fill the rendered component's slots |

## Action helpers

| Helper | Methods | Default method |
|---|---|---|
| `action()` | any | none (required) |
| `provider()` | `GET`, `QUERY` | `GET` |
| `mutation()` | `POST`, `PUT`, `PATCH`, `DELETE`, … | `POST` |

## Action options

| Option | On | Default | Doc |
|---|---|---|---|
| `method` | all | per helper | [02](02-rendering-and-actions.md#actions) |
| `url` | all | required; string or `(args) => string` | [02](02-rendering-and-actions.md#actions) |
| `context` | all | none (built-ins only) | [02](02-rendering-and-actions.md#context) |
| `send` | mutation, `QUERY` provider | `multipart` for forms | [02](02-rendering-and-actions.md#request-and-response-formats) |
| `accepts` | all | `json` | [02](02-rendering-and-actions.md#request-and-response-formats) |
| `timeout` | all | none (seconds) | [03](03-data-layer.md#failure-handling) |
| `event` | all | function name (event prefix) | [02](02-rendering-and-actions.md#events) |
| `provides` | provider | none; `{ tag, key }` | [03](03-data-layer.md#tags) |
| `items` | provider | the response itself | [03](03-data-layer.md#tags) |
| `sort` | provider | `null` | [03](03-data-layer.md#reconciliation) |
| `paginated` | provider | none; `{ mode, firstPage, nextPage, refreshBehind }` | [02](02-rendering-and-actions.md#pagination) |
| `paginated.refreshBehind` | provider | `1` | [02](02-rendering-and-actions.md#pagination) |
| `refetchAfter` | provider | `respectCacheOr(Infinity)` | [03](03-data-layer.md#freshness) |
| `keepUnusedFor` | provider | `respectCacheOr(Infinity)` | [03](03-data-layer.md#freshness) |
| `persist` | provider | `false` | [03](03-data-layer.md#persistence) |
| `onRefetchFailure` | provider | `'keep'` (or `'throw'`) | [03](03-data-layer.md#failure-handling) |
| `onInvalidate` | provider | keep content (or `'pending'`) | [03](03-data-layer.md#invalidation) |
| `invalidates` | mutation | none; `'Tag'`, `['A', 'B']`, `{ tag, key }`, `{ tag, id }` | [03](03-data-layer.md#invalidation) |
| `reconciles` | mutation | none; `{ tag, key }` | [03](03-data-layer.md#reconciliation) |

Global options via `configure({ … })`: `actions` (explicit name → function registration), `filters`, `persist`, persistence `maxAge` (default 24 h), `buster`, and `components` (a component-file loader; default none, so only templates in the page render).

## Behavior functions

Principle 8: every customizable behavior is a function with a default.

| Option | Signature | Default |
|---|---|---|
| `items` | `(response) => array of objects` | the response itself |
| `merge` | `(cached, page) => merged` | concatenate (infinite) or replace (pages) |
| `sort` | `(a, b) => number`, after each upsert | `null` (new items at the end) |
| `context` | `(response, status, args) => extra fields`, every state (`response` may be `null`) | no extra fields |
| `send` | `(body) => { body, headers }` | `multipart` for forms |
| `accepts` | `(response: Response) => Promise<data>` | `json` |
| `nextPage` | `(response, page) => next param \| null` | required when paginated |
| `invalidates.id` | `(args) => id` | n/a |
| `persist` | store `{ get, set, remove }` | `false` |

## Context fields

What templates rendered from an action receive: `{ response, context }`.

| Field | Meaning |
|---|---|
| `response` | Decoded data; `null` while pending or after an error |
| `context.pending` / `.success` / `.noContent` / `.error` | Current state |
| `context.statusCode` | HTTP status, when there is one |
| `context.nextPage` | Next page param for paginated actions; falsy when done |
| `context.<anything>` | Extra fields from the action's `context` function |

## Filters

Defined once in `shared`; used by runtime bindings and build-time `{{ }}`.

| Filter | Availability |
|---|---|
| `fallback:'text'` | Always available |
| `currency:CODE`, `number`, `percent`, `date:style`, `relativeTime:unit` | Provided, opt-in (`Intl`, locale from `<html lang>`) |
| `upper`, `lower`, `truncate:n` | Provided, opt-in |
| custom | Any function registered via `configure({ filters })` |

## Events

`functionName:event` on `document`. See [02](02-rendering-and-actions.md#events).

`before:request` → `pending` → `after:request` → `success` | `no-content` | `error` (`timeout` first, if it applies) → `finally:request`, with `before:render` / `after:render` around each `<render-template>` update, and `invalidate:Type` per invalidated tag.

## Exports

What a project imports from the runtime package:

| Module | Exports |
|---|---|
| `runtime/index.js` | `configure` |
| `runtime/action.js` | `action`, `provider`, `mutation`, `HttpMethod` |
| `runtime/formats.js` | `json`, `text`, `multipart`, `urlencoded` |
| `runtime/cache.js` | `respectCacheOr`, `defaultItems`, `mergeInfinite`, `mergePages` |
| `runtime/stores.js` | `localStore`, `sessionStore`, `indexedDbStore` |
| `runtime/components.js` | `componentFolder` |
| `lib/buildadiv-runtime.min.js` | Everything above, as one standalone minified file |
| `runtime/filters.js` | `currency`, `number`, `percent`, `date`, `relativeTime`, `upper`, `lower`, `truncate` (re-exported from `shared`) |

## Packages

From [04 · Packages](04-builder-and-editor.md#packages).

| Package | Contains | May import from |
|---|---|---|
| `shared` | Filters, filter-pipeline parser, path resolution, slot-filling rules | nothing else in the repo |
| `runtime` | Part 1: `<render-template>`, binder, actions, tags, cache, events | `shared` |
| `builder` | Part 2: HTML parsing, component tags, `{{ }}`, build pipeline | `shared` |
| `editor` | Part 2: the browser editor | `shared`, `runtime`, `builder` |

TypeScript exports include separate request/query/write interfaces, GET/QUERY
provider interfaces, mutation options, typed provider/mutation action functions,
and the normalized role union. Forbidden role fields are `never`; GET encoders
and read methods on mutations fail type checking. HTTP extension methods remain
available through the baseline `action()` helper.
